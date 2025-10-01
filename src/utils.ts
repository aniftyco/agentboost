import { glob } from 'glob';
import ignore from 'ignore';
import { readFile } from 'node:fs/promises';

/**
 * Determine whether a token is flag-like (starts with a dash).
 *
 * Contract
 * - input: a single argv token (already shell-split)
 * - output: boolean
 *
 * Behavior
 * - Returns true for tokens like: "-f", "--flag", "-ab" (combined short flags), "-", "--"
 * - Returns false for tokens like: "foo", "foo=bar"
 *
 * Notes
 * - This does not validate the rest of the token; any leading '-' qualifies.
 * - Numeric tokens like "-1" will be considered flag-like; caller may handle specially if needed.
 */
export const isFlagLike = (s: string) => s.startsWith('-');

/**
 * Detect whether a token is in a key=value form.
 *
 * Contract
 * - input: a single argv token (already shell-split)
 * - output: boolean
 *
 * Behavior
 * - Returns true for tokens containing '=' such as: "key=value", "--key=value", "-k=value"
 * - Returns false for spaced forms: "--key value", "-k value"
 *
 * Notes
 * - No trimming or validation is performed; the mere presence of '=' qualifies.
 * - Edge cases like "=value" or "key=" also return true.
 */
export const isKeyEqVal = (s: string) => s.includes('=');

/**
 * Parse argv into a command and params map.
 *
 * Contract
 * - input: argv as received by bin (process.argv.slice(2))
 * - output: { command?: string, params?: Record<string, string> }
 *   - command may appear before or after params; it's the first standalone non-flag/non key=value token not acting as a key.
 *   - params are parsed from:
 *     - key=value
 *     - --key=value or -k=value
 *     - --key value or -k value
 *     - key value (treated as key/value pair)
 *     - bare flags like --dry-run or -f become key: "true"
 *     - combined short flags like -ab become a: "true", b: "true"
 */
export const parseArgs = (argv: string[]): { command?: string; params?: Record<string, string> } => {
  if (!argv || argv.length === 0) return {};

  let command: string | undefined;
  const params: Record<string, string> = {};

  let i = 0;

  // First pass: detect a standalone command token anywhere (not a flag, not key=value,
  // not consumed as a value for a preceding flag, and not a key in a key value pair)
  let commandIndex: number | undefined;
  for (let j = 0; j < argv.length; j++) {
    const tok = argv[j];

    if (isKeyEqVal(tok)) continue;

    if (isFlagLike(tok)) {
      // Flags may consume the next token as a value if it's not another flag and not key=value.
      // Combined short flags like -ab do not consume the next token.
      if (!/^-[^-]{2,}$/.test(tok)) {
        const nxt = argv[j + 1];
        if (nxt && !isFlagLike(nxt) && !isKeyEqVal(nxt)) {
          // Skip checking the next token here; it's a value of this flag, not a command.
          j += 1;
        }
      }
      continue;
    }

    // Non-flag, not key=value. If followed by another non-flag token, treat this pair as key/value.
    const nxt = argv[j + 1];
    if (nxt && !isFlagLike(nxt) && !isKeyEqVal(nxt)) {
      j += 1; // skip value partner
      continue;
    }

    // Standalone non-flag token => candidate command. Choose the first one.
    commandIndex ??= j;
    break;
  }

  if (commandIndex !== undefined) {
    command = argv[commandIndex];
  }

  const setParam = (key: string, val: string) => {
    if (!key) return;
    params[key] = val;
  };

  while (i < argv.length) {
    const token = argv[i];

    // Skip the token identified as the command
    if (i === commandIndex) {
      i += 1;
      continue;
    }

    // Formats: --key=value, -k=value, key=value
    if (isKeyEqVal(token)) {
      const idx = token.indexOf('=');
      const rawKey = token.slice(0, idx);
      const value = token.slice(idx + 1);
      const key = rawKey.replace(/^--?/, '');
      setParam(key, value);
      i += 1;
      continue;
    }

    // Formats: --key value, -k value
    if (isFlagLike(token)) {
      // Combined short flags like -ab => a=true, b=true
      if (/^-[^-]{2,}$/.test(token)) {
        const shorts = token.slice(1);
        for (const ch of shorts) {
          setParam(ch, 'true');
        }
        i += 1;
        continue;
      }

      const key = token.replace(/^--?/, '');
      const next = argv[i + 1];
      if (next && !next.startsWith('-')) {
        setParam(key, next);
        i += 2;
      } else {
        // bare flag => true
        setParam(key, 'true');
        i += 1;
      }
      continue;
    }

    // Format: key value (treat as pair if next exists and isn't a flag)
    const key = token;
    const next = argv[i + 1];
    if (next && !next.startsWith('-')) {
      setParam(key, next);
      i += 2;
    } else {
      // Lone token without '=' and not the command: treat as boolean true
      setParam(key, 'true');
      i += 1;
    }
  }

  return {
    ...(command ? { command } : {}),
    ...(Object.keys(params).length ? { params } : {}),
  };
};

/**
 * Build a flat list of paths under the given root directory.
 *
 * Contract
 * - input: absolute path to a directory
 * - output: Promise<string[]> of normalized (forward-slash) paths relative to root
 *
 * Behavior
 * - Includes both directories and files (excluding the root itself)
 * - Paths are normalized to use '/'
 * - Order is lexicographic by entry name within each directory
 */
export const buildPathTree = async (rootDir: string): Promise<string[]> => {
  const gitignore = await readFile('.gitignore', 'utf8');
  const ig = ignore().add(gitignore.split('\n'));

  // Get all files with glob
  const files = await glob('**/*', { nodir: true });

  // Filter out ignored ones
  return files.filter((file) => !ig.ignores(file));
};
