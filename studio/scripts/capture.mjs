#!/usr/bin/env node
// Capture a product UI (local HTML file or URL) as a crisp 2x screenshot for uiShot scenes.
// usage: node scripts/capture.mjs <file.html|url> <out.png> [--width 1440] [--height 900] [--scale 2] [--wait 300]
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright-core';
import {findChrome} from './browser.mjs';

const args = process.argv.slice(2);
const opt = (name, d) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? Number(args[i + 1]) : d;
};
const [src, out] = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
if (!src || !out) {
  console.error('usage: capture.mjs <file.html|url> <out.png> [--width 1440] [--height 900] [--scale 2]');
  process.exit(1);
}
const url = /^https?:/.test(src) ? src : pathToFileURL(path.resolve(src)).href;
const browser = await chromium.launch({executablePath: findChrome() ?? undefined});
const page = await browser.newPage({viewport: {width: opt('width', 1440), height: opt('height', 900)}, deviceScaleFactor: opt('scale', 2)});
await page.goto(url, {waitUntil: 'networkidle'});
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(opt('wait', 300));
await page.screenshot({path: out});
await browser.close();
console.log(`captured ${url} -> ${out}`);
