#!/usr/bin/env node
// Render a film page to MP4: seek every frame, screenshot it, encode, score, finish, critique.
//
// usage: node engine/render.mjs films/<name> [options]
//   --stills 1.5,4,9.2   only write PNG stills at these times (style frames, checks)
//   --draft              half resolution, no motion blur, fast encode
//   --from 3 --to 9      render a time range only (seconds)
//   --workers 4          parallel browser pages (default: CPU count)
//   --music track.wav    use a supplied track instead of the generated score (see sound-design)
//   --offset 0.42        seconds into --music where its first downbeat is (tools/beatgrid.py prints it)
//   --audit              only check the layout (type in title-safe, off pictures, off other type) and exit
//   --no-critic          skip the critic
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {serve, ROOT} from './serve.mjs';
import {findChrome} from './browser.mjs';
import {extractFrames} from './frames.mjs';

const args = process.argv.slice(2);
const flag = (k) => args.includes(`--${k}`);
const opt = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const filmDir = path.resolve(args.find((a) => !a.startsWith('--') && !args[args.indexOf(a) - 1]?.startsWith('--')) || '.');
const name = path.basename(filmDir);
const build = path.join(filmDir, 'build');
fs.mkdirSync(build, {recursive: true});
const log = (...m) => console.log('▸', ...m);

// ---- footage: extract every clip's frames once, so the page shows exact frames instead of seeking video
extractFrames(filmDir, build, log);

const {server, url} = await serve();
const pageUrl = `${url}/${path.relative(ROOT, filmDir).split(path.sep).join('/')}/index.html?render`;
const browser = await chromium.launch({
  executablePath: findChrome(),
  // software raster is about twice as fast as emulated GPU raster for CSS-heavy pages; WebGL still runs on SwiftShader
  args: ['--font-render-hinting=none', '--disable-lcd-text', '--force-color-profile=srgb', '--hide-scrollbars', '--enable-unsafe-swiftshader', '--disable-media-suspend', '--disable-background-media-suspend', '--autoplay-policy=no-user-gesture-required'],
});

async function openPage(scale) {
  // first load at 1x to learn the film's size, then size the viewport to it
  const ctx = await browser.newContext({viewport: {width: 1920, height: 1080}, deviceScaleFactor: scale});
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('page error:', e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) console.error('console:', m.text()); });
  await page.goto(pageUrl);
  await page.waitForFunction(() => window.__slate, null, {timeout: 60000});
  const man = await page.evaluate(() => window.__slate.manifest());
  if (man.width !== 1920 || man.height !== 1080) {
    await page.setViewportSize({width: man.width, height: man.height});
    await page.reload();
    await page.waitForFunction(() => window.__slate, null, {timeout: 60000});
  }
  const cdp = await ctx.newCDPSession(page);
  return {page, cdp, man, scale};
}

async function shot(p, file) {
  // a raw CDP capture is in CSS pixels whatever the device scale, so the scale is asked for explicitly
  const {data} = await p.cdp.send('Page.captureScreenshot', {format: 'png', optimizeForSpeed: true, fromSurface: true, clip: {x: 0, y: 0, width: p.man.width, height: p.man.height, scale: p.scale}});
  const buf = Buffer.from(data, 'base64');
  if (file) fs.writeFileSync(file, buf);
  return buf;
}

const draft = flag('draft');
const scale = draft ? 0.5 : 1;
const first = await openPage(scale);
const man = first.man;
fs.writeFileSync(path.join(build, 'manifest.json'), JSON.stringify(man, null, 2));
if (man.missing) console.error(`▸ warning: ${man.missing.length} footage file(s) missing, rendering black in their place: ${man.missing.join(', ')}`);
log(`${man.title}: ${man.duration.toFixed(2)}s @ ${man.fps}fps, ${man.width}×${man.height}, ${man.scenes.length} scenes, ${man.bpm} BPM`);

// ---- stills: style frames and spot checks
if (opt('stills')) {
  const dir = path.join(build, 'stills');
  fs.mkdirSync(dir, {recursive: true});
  for (const t of opt('stills').split(',').map(Number)) {
    await first.page.evaluate((x) => window.__slate.seek(x), t);
    const f = path.join(dir, `${String(t.toFixed(2)).padStart(6, '0')}.png`);
    await shot(first, f);
    log(`still ${t}s -> ${path.relative(process.cwd(), f)}`);
  }
  await browser.close(); server.close();
  process.exit(0);
}

// ---- layout audit: sample the film and check where every visible word sits
async function audit(p) {
  const step = 1 / 6, open = new Map(), runs = [];
  for (let t = 0; t < man.duration; t += step) {
    await p.page.evaluate((x) => window.__slate.seek(x), t);
    for (const i of await p.page.evaluate(() => window.__slate.audit())) {
      // one run per problem per stretch of time: the same word cut twice, a minute apart, is two problems
      const key = i.kind + i.what + (i.at || '');
      const f = open.get(key);
      if (f && t - f.to <= step * 1.5) f.to = t;
      else { const r = {...i, from: t, to: t}; open.set(key, r); runs.push(r); }
    }
  }
  // words in flight (an entrance, a wipe) may cross a margin for a moment; a problem that lasts is a layout problem
  const all = runs.map((i) => ({...i, from: +i.from.toFixed(2), to: +i.to.toFixed(2)}));
  const issues = all.filter((i) => i.to - i.from >= 0.3 - 1e-6);
  if (all.length > issues.length) log(`layout: ${all.length - issues.length} momentary crossing(s) under 0.3s, ignored`);
  fs.writeFileSync(path.join(build, 'layout.json'), JSON.stringify(issues, null, 2));
  if (!issues.length) log('layout: every word sits in title-safe, off pictures and off other words');
  for (const i of issues) console.log(`  ✗ layout ${i.from}–${i.to}s: ${i.what} ${i.kind}${i.on ? ` (${i.on})` : ''}${i.size ? ` (${i.size}px)` : ''}`);
  return issues;
}
if (flag('audit')) { await audit(first); await browser.close(); server.close(); process.exit(0); }
if (!draft && !opt('from')) await audit(first);

// ---- score (runs while frames render)
const python = process.env.PYTHON || 'python3';
// a film that composes its own score (films/<name>/score.py, built on tools/synth.py) uses it; otherwise the sketch scorer
const ownScore = path.join(filmDir, 'score.py');
const scorer = fs.existsSync(ownScore) && !opt('music') ? ownScore : path.join(ROOT, 'tools/score.py');
const scoreArgs = [scorer, path.join(build, 'manifest.json'), '--out', build];
if (opt('music')) scoreArgs.push('--music', path.resolve(opt('music')), '--offset', opt('offset', '0'));
const scoring = new Promise((res) => {
  const p = spawn(python, scoreArgs, {stdio: ['ignore', 'pipe', 'inherit']});
  let out = ''; p.stdout.on('data', (d) => (out += d));
  p.on('close', (code) => { process.stdout.write(out); res(code); });
});

// ---- frames
const fps = man.fps;
const from = Math.round(parseFloat(opt('from', 0)) * fps);
const to = Math.min(Math.round(parseFloat(opt('to', man.duration)) * fps), Math.round(man.duration * fps));
const shutter = man.post.shutter ?? 0.5;
const workers = Math.max(1, parseInt(opt('workers', os.cpus().length), 10));
const total = to - from;
// subframes per frame: the film's base blur, raised inside its F.blur() windows (fast moves only)
const blurAt = (f) => {
  if (draft) return 1;
  let n = Math.max(1, man.post.blur | 0);
  for (const w of man.post.windows || []) if (f / fps >= w.from - 1e-6 && f / fps < w.to - 1e-6) n = Math.max(n, w.samples | 0);
  return n;
};
// tasks: runs of frames with one subframe count, cut into pieces of about equal cost, rendered in order by a queue
const tasks = [];
for (let f = from; f < to;) {
  const n = blurAt(f);
  let e = f;
  while (e < to && blurAt(e) === n) e++;
  const piece = Math.max(12, Math.ceil(fps * 2 / n));
  for (let x = f; x < e; x += piece) tasks.push({a: x, b: Math.min(e, x + piece), blur: n});
  f = e;
}
const started = Date.now();
let done = 0, next = 0;

async function renderTask(task, i, page) {
  const {a, b, blur} = task;
  const file = path.join(build, `chunk${String(i).padStart(4, '0')}.mkv`);
  // subframes are averaged in ffmpeg: tmix blends the last `blur` samples, and select keeps the blend that ends on
  // each frame's last subframe (so a frame is the average of its own samples, never its neighbour's)
  const vf = blur > 1 ? [`tmix=frames=${blur}:weights=${'1 '.repeat(blur).trim()}`, `select=eq(mod(n\\,${blur})\\,${blur - 1})`, `setpts=N/(${fps}*TB)`] : [];
  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-c:v', 'png', '-framerate', String(fps * blur), '-i', '-',
    ...(vf.length ? ['-vf', vf.join(',')] : []), '-r', String(fps), '-c:v', 'libx264', '-preset', draft ? 'ultrafast' : 'veryfast', '-crf', draft ? '20' : '8', '-pix_fmt', 'yuv444p', file], {stdio: ['pipe', 'inherit', 'inherit']});
  for (let f = a; f < b; f++) {
    for (let k = 0; k < blur; k++) {
      // the shutter opens before the frame time and closes on it, so motion trails behind
      const t = f / fps - (blur > 1 ? shutter / fps * (1 - k / (blur - 1)) : 0);
      await page.page.evaluate((x) => window.__slate.seek(x), Math.max(0, t));
      const buf = await shot(page);
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    }
    done++;
    if (done % fps === 0) {
      const el = (Date.now() - started) / 1000;
      process.stdout.write(`\r▸ frames ${done}/${total} · ${(done / el).toFixed(1)} fps   `);
    }
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  return file;
}

const pages = [first, ...await Promise.all(Array.from({length: Math.min(workers, tasks.length) - 1}, () => openPage(scale)))];
const chunks = new Array(tasks.length);
await Promise.all(pages.map(async (p) => { while (next < tasks.length) { const i = next++; chunks[i] = await renderTask(tasks[i], i, p); } }));
const blurred = tasks.filter((t) => t.blur > 1).reduce((n, t) => n + t.b - t.a, 0);
if (blurred) log(`motion blur on ${blurred} of ${total} frames`);
process.stdout.write('\n');
log(`frames done in ${((Date.now() - started) / 1000).toFixed(0)}s`);
await browser.close();
server.close();

// ---- finish: concat, grain + vignette, mux the mix
const scoreCode = await scoring;
if (scoreCode !== 0) { console.error('score failed'); process.exit(1); }
const list = path.join(build, 'chunks.txt');
fs.writeFileSync(list, chunks.map((c) => `file '${c}'`).join('\n'));
const post = [];
if (man.post.vignette > 0) post.push(`vignette=angle=${(0.25 + 0.5 * man.post.vignette).toFixed(3)}`);
if (man.post.grain > 0) post.push(`noise=c0s=${man.post.grain}:c0f=t+u`);
post.push('format=yuv420p');
const outDir = path.join(ROOT, 'out');
fs.mkdirSync(outDir, {recursive: true});
const out = path.join(outDir, `${name}${draft ? '-draft' : ''}${from || to < Math.round(man.duration * fps) ? `-${from}-${to}` : ''}.mp4`);
const audioStart = from / fps;
const enc = spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-ss', String(audioStart), '-i', path.join(build, 'mix.wav'),
  '-map', '0:v', '-map', '1:a', '-vf', post.join(','), '-c:v', 'libx264', '-preset', draft ? 'veryfast' : 'slow', '-crf', draft ? '23' : '16', '-profile:v', 'high',
  // aq-mode 3 spends bits on flat, dark and gradient areas, where grain and soft backgrounds otherwise band and smear
  '-x264-params', 'aq-mode=3:aq-strength=0.9',
  '-color_primaries', 'bt709', '-color_trc', 'bt709', '-colorspace', 'bt709', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', out], {stdio: 'inherit'});
if (enc.status !== 0) process.exit(1);
for (const c of chunks) fs.rmSync(c);
log(`video -> ${path.relative(process.cwd(), out)}`);

// ---- critic
if (!flag('no-critic') && !draft && from === 0) {
  const c = spawnSync(python, [path.join(ROOT, 'tools/critic.py'), out, '--manifest', path.join(build, 'manifest.json'), '--out', path.join(build, 'critic')], {stdio: 'inherit'});
  process.exit(c.status ?? 1);
}
