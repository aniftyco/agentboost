import { exec } from 'node:child_process';
import pkg from '../package.json' with { type: 'json' };

function openUrl(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const command =
      process.platform === 'darwin'
        ? `open "${url}"`
        : process.platform === 'win32'
          ? `start "" "${url}"`
          : `xdg-open "${url}"`;

    exec(command, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

openUrl(pkg.repository)
  .then(() => {
    console.log('✅ Opened browser to', pkg.repository);
  })
  .catch((err) => {
    console.error('❌ Failed to open browser:', err?.message || err);
    process.exitCode = 1;
  });
