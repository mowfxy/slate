// Find a Chromium: SLATE_CHROME, then Playwright's browser cache, else Playwright's default lookup.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function findChrome() {
  const env = process.env.SLATE_CHROME;
  if (env && fs.existsSync(env)) return env;
  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, path.join(os.homedir(), '.cache/ms-playwright'), path.join(os.homedir(), 'Library/Caches/ms-playwright')].filter(Boolean);
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    for (const d of fs.readdirSync(root).filter((x) => x.startsWith('chromium')).sort().reverse()) {
      for (const bin of ['chrome-linux/chrome', 'chrome-linux/headless_shell', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium', 'chrome-win/chrome.exe']) {
        const p = path.join(root, d, bin);
        if (fs.existsSync(p)) return p;
      }
    }
  }
  return undefined; // fall back to Playwright's default lookup
}
