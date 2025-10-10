# NextJS Plugin Output - Full Detection Example

This shows what the NextJS plugin returns when it detects a comprehensive Next.js project.

## Scenario
- Next.js 14.2.0 in dependencies
- Both `app/` and `pages/` directories (hybrid routing)
- TypeScript enabled (tsconfig.json + .tsx files)
- Tailwind CSS configured
- next.config.ts present
- Environment files (.env.local)
- Some scripts missing (start, lint)

## Plugin Output

## Next.js
Detected Next.js 14.2.0 with both routing.

| Attribute | Value |
| --------- | ----- |
| Version | 14.2.0 |
| Routing | both |
| TypeScript | yes |
| Tailwind | yes |
| Config File | next.config.ts |
| Env Files | .env.local |
| Scripts | dev✓ build✓ start✗ lint✗ |

> Note: Both `app/` and `pages/` directories detected. This indicates a hybrid or migration state between routing systems.

> Warning: Missing script: start

> Warning: Missing script: lint