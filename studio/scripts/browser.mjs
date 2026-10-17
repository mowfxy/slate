// Find a Chromium for capture and rendering. Order: env, Playwright cache, none (let the tool download its own).
import fs from 'node:fs';
import path from 'node:path';

export function findChrome({headlessShell = false} = {}) {
  const env = process.env.SLATE_CHROME || process.env.REMOTION_BROWSER_EXECUTABLE;
  if (env && fs.existsSync(env)) return env;
  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, path.join(process.env.HOME || '', '.cache/ms-playwright')].filter(Boolean);
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    const dirs = fs.readdirSync(root).sort().reverse();
    const want = headlessShell ? ['chromium_headless_shell-', 'chromium-'] : ['chromium-', 'chromium_headless_shell-'];
    for (const prefix of want) {
      for (const d of dirs.filter((x) => x.startsWith(prefix))) {
        for (const bin of ['chrome-linux/headless_shell', 'chrome-linux/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium']) {
          const p = path.join(root, d, bin);
          if (fs.existsSync(p)) return p;
        }
      }
    }
  }
  return null;
}
