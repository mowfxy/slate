#!/usr/bin/env node
// Record real footage of a web app: drive it with a shot script and capture every frame.
//
// usage: node engine/record.mjs films/<name>/shots/<shot>.mjs [--out films/<name>/footage/<shot>.webm] [--draft]
//
// A shot script is an ES module:
//
//   export default {
//     url: '/films/my-film/index.html?preview',  // a path on the Slate server, or any http(s) URL
//     width: 1920, height: 820,                    // the viewport, in CSS pixels
//     scale: 1.25,                                 // device pixel ratio, so the film can push in without going soft
//     fps: 30,
//     async setup(page) {},                        // optional: before the clock starts (log in, set state)
//     ready: () => !!window.app,                   // optional: run the clock (uncaptured) until this is true in the page
//     async run(rec) { await rec.hold(1); await rec.type('#q', 'hello'); await rec.click('#go'); await rec.hold(2); },
//   };
//
// The page runs on a virtual clock (Date, timers, requestAnimationFrame, performance.now and CSS/Web
// animations), and the recorder advances it exactly one frame between captures. So the footage is
// smooth at full frame rate however slow the machine is, and records the same way every time.
// Output is VP9 WebM (the codec headless Chromium decodes and seeks frame-accurately) plus a JSON
// sidecar with the clip's duration, the times of every key press, click and mark, and any element
// rectangles you asked for, so the film can put sounds and moves on the footage's own events.
import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright-core';
import {serve} from './serve.mjs';
import {findChrome} from './browser.mjs';

const CURSOR = `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="32" viewBox="0 0 26 32"><path d="M2 2 L2 25 L8 19.5 L12.2 29 L16.4 27.2 L12.3 18 L20.5 18 Z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>`;

const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

export async function record(shotFile, {out, draft = false, log = console.log} = {}) {
  const shot = (await import(pathToFileURL(path.resolve(shotFile)).href)).default;
  const fps = shot.fps || 30;
  const width = shot.width || 1920, height = shot.height || 1080;
  const scale = draft ? 0.5 : (shot.scale || 1);
  out = out || path.join(path.dirname(path.dirname(path.resolve(shotFile))), 'footage', path.basename(shotFile).replace(/\.m?js$/, '.webm'));
  fs.mkdirSync(path.dirname(out), {recursive: true});

  const {server, url: base} = await serve();
  const browser = await chromium.launch({executablePath: findChrome(), args: ['--font-render-hinting=none', '--disable-lcd-text', '--force-color-profile=srgb', '--hide-scrollbars', '--enable-unsafe-swiftshader', '--disable-media-suspend', '--disable-background-media-suspend', '--autoplay-policy=no-user-gesture-required']});
  const ctx = await browser.newContext({viewport: {width, height}, deviceScaleFactor: scale});
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error('page error:', e.message));
  const T0 = new Date('2026-10-17T09:41:00');
  await page.clock.install({time: T0});
  const target = /^https?:/.test(shot.url) ? shot.url : base + shot.url;
  await page.goto(target);
  await page.clock.pauseAt(new Date(T0.getTime() + 1000)); // from here on, time moves only when the recorder says so
  await page.evaluate(() => document.fonts.ready);
  if (shot.setup) await shot.setup(page);
  const cdp = await ctx.newCDPSession(page);

  // CSS transitions and Web Animations run on the compositor's real clock, so the recorder owns them too
  await page.evaluate(() => {
    window.__rec = {
      step(dt) {
        for (const a of document.getAnimations()) {
          if (a.__t === undefined) a.__t = a.currentTime || 0;
          a.__t += dt;
          a.pause();
          a.currentTime = a.__t;
        }
      },
    };
  });

  const ff = spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'image2pipe', '-c:v', 'png', '-framerate', String(fps), '-i', '-',
    '-c:v', 'libvpx-vp9', '-crf', draft ? '34' : '18', '-b:v', '0', '-g', String(fps / 2), '-row-mt', '1', '-deadline', 'good', '-cpu-used', draft ? '8' : '3',
    '-pix_fmt', 'yuv420p', out], {stdio: ['pipe', 'inherit', 'inherit']});

  let frame = 0, owed = 0;
  const events = [];
  const rects = {};
  let cursor = null;
  const mouse = {x: width / 2, y: height / 2};

  async function capture() {
    const {data} = await cdp.send('Page.captureScreenshot', {format: 'png', optimizeForSpeed: true, fromSurface: true});
    const buf = Buffer.from(data, 'base64');
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    frame++;
    if (frame % fps === 0) process.stdout.write(`\r▸ ${path.basename(out)}: ${(frame / fps).toFixed(0)}s recorded   `);
  }
  async function tick() {
    await capture();
    await page.clock.runFor(1000 / fps);
    await page.evaluate((dt) => window.__rec.step(dt), 1000 / fps);
  }
  async function placeCursor(x, y, down = false) {
    if (!cursor) return;
    await page.evaluate(({x, y, down}) => {
      const c = document.getElementById('__rec_cursor');
      c.style.transform = `translate(${x - 2}px, ${y - 2}px) scale(${down ? 0.86 : 1})`;
    }, {x, y, down});
  }
  const now = () => frame / fps;
  const center = async (sel) => {
    const b = await page.locator(sel).first().boundingBox();
    if (!b) throw new Error(`record: nothing matches ${sel}`);
    return {x: b.x + b.width / 2, y: b.y + b.height / 2};
  };

  const rec = {
    page, fps, width, height,
    get t() { return now(); },
    /** Let the app run for this many seconds. */
    async hold(sec) {
      // keep the fractions, so many short waits (key gaps) add up to the right time
      owed += sec * fps;
      while (owed >= 1 - 1e-9) { owed -= 1; await tick(); }
    },
    /** Show a cursor (screenshots have none). */
    async cursor(x = mouse.x, y = mouse.y) {
      cursor = true; mouse.x = x; mouse.y = y;
      await page.evaluate((svg) => {
        if (document.getElementById('__rec_cursor')) return;
        const c = document.createElement('div');
        c.id = '__rec_cursor';
        c.innerHTML = svg;
        Object.assign(c.style, {position: 'fixed', left: 0, top: 0, zIndex: 2147483647, pointerEvents: 'none', transformOrigin: '2px 2px', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.35))'});
        document.documentElement.append(c);
      }, CURSOR);
      await placeCursor(x, y);
    },
    /** Glide the pointer to a point or an element's center, eased, moving the real mouse too (hover states fire). */
    async move(to, {dur = 0.7} = {}) {
      const p = typeof to === 'string' ? await center(to) : to;
      const a = {...mouse}, n = Math.max(1, Math.round(dur * fps));
      for (let i = 1; i <= n; i++) {
        const e = ease(i / n);
        // a slight arc, the way a hand moves a mouse
        const bow = Math.sin(Math.PI * e) * Math.min(40, Math.hypot(p.x - a.x, p.y - a.y) * 0.08);
        mouse.x = a.x + (p.x - a.x) * e; mouse.y = a.y + (p.y - a.y) * e - bow;
        await page.mouse.move(mouse.x, mouse.y);
        await placeCursor(mouse.x, mouse.y);
        await tick();
      }
    },
    /** Click where the pointer is, or move to a target first. */
    async click(to, opts = {}) {
      if (to) await rec.move(to, opts);
      events.push({type: 'click', t: now()});
      await page.mouse.down(); await placeCursor(mouse.x, mouse.y, true); await tick(); await tick();
      await page.mouse.up(); await placeCursor(mouse.x, mouse.y, false); await tick();
    },
    /** Type into the focused element (or a selector) one key at a time, with a human rhythm. */
    async type(sel, text, {cps = 14, sound = true} = {}) {
      if (sel) await page.focus(sel);
      let seed = 7;
      const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (const ch of text) {
        if (sound && ch !== ' ') events.push({type: 'key', t: now()});
        // letters go through real key events; punctuation is inserted as text, which every layout agrees on
        if (/[\w ]/.test(ch)) await page.keyboard.type(ch); else await page.keyboard.insertText(ch);
        const gap = (1 / cps) * (0.6 + 0.8 * rnd()) * (ch === ' ' ? 1.5 : 1) * (/[.,;:]/.test(ch) ? 2 : 1);
        await rec.hold(gap);
      }
    },
    /** Press one key (Enter, Backspace, Meta+S...). */
    async press(key) { events.push({type: 'key', t: now(), key}); await page.keyboard.press(key); await tick(); },
    /** Scroll an element (or the page) by dy pixels over dur seconds, eased. */
    async scroll(sel, dy, {dur = 1.5} = {}) {
      const n = Math.max(1, Math.round(dur * fps));
      const start = await page.evaluate((s) => (s ? document.querySelector(s) : document.scrollingElement).scrollTop, sel);
      for (let i = 1; i <= n; i++) {
        await page.evaluate(({s, y}) => { (s ? document.querySelector(s) : document.scrollingElement).scrollTop = y; }, {s: sel, y: start + dy * ease(i / n)});
        await tick();
      }
    },
    /** Run something in the page now (between frames). */
    async do(fn, arg) { return page.evaluate(fn, arg); },
    /** Name this moment; the film reads it from the sidecar (footage.marks.done). */
    mark(name, extra = {}) { events.push({type: 'mark', name, t: now(), ...extra}); },
    /** Store an element's rectangle (in CSS pixels of the recording) under a name, for matching cuts. */
    async rect(name, sel) { rects[name] = await page.locator(sel).first().boundingBox(); },
  };

  // let the app finish starting before the first captured frame: advance the clock, capture nothing
  for (let i = 0; i < fps * 10; i++) {
    await page.clock.runFor(1000 / fps);
    await page.evaluate((dt) => window.__rec.step(dt), 1000 / fps);
    const ok = shot.ready ? await page.evaluate(shot.ready) : i >= fps / 5;
    if (ok) break;
    if (i === fps * 10 - 1) console.error(`record: ${path.basename(shotFile)} never became ready`);
  }

  log(`▸ recording ${path.relative(process.cwd(), shotFile)} at ${width}×${height} @${scale}x, ${fps} fps`);
  await shot.run(rec);
  await capture(); // the final state
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  await browser.close();
  server.close();
  process.stdout.write('\n');

  const meta = {
    source: path.basename(shotFile), url: shot.url, width, height, scale, fps, frames: frame, duration: frame / fps,
    marks: Object.fromEntries(events.filter((e) => e.type === 'mark').map((e) => [e.name, e.t])),
    events: events.filter((e) => e.type !== 'mark'),
    rects,
  };
  fs.writeFileSync(out.replace(/\.webm$/, '.json'), JSON.stringify(meta, null, 2));
  log(`▸ footage -> ${path.relative(process.cwd(), out)} (${meta.duration.toFixed(2)}s, ${meta.events.length} events)`);
  return meta;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const opt = (k) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : undefined; };
  const files = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--out');
  if (!files.length) { console.error('usage: node engine/record.mjs <shot.mjs> [more shots] [--out file.webm] [--draft]'); process.exit(1); }
  for (const f of files) await record(f, {out: files.length === 1 ? opt('out') : undefined, draft: args.includes('--draft')});
}
