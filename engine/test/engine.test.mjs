// Engine tests: cd engine && npm test   (needs ffmpeg, python3 with numpy/scipy, and a Chromium)
import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright-core';
import {serve} from '../serve.mjs';
import {findChrome} from '../browser.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const fixture = path.join(here, 'fixture');

async function withPage(fn, file = 'index.html') {
  const {server, url} = await serve();
  const browser = await chromium.launch({executablePath: findChrome(), args: ['--enable-unsafe-swiftshader']});
  try {
    const page = await browser.newPage({viewport: {width: 320, height: 180}});
    await page.goto(`${url}/engine/test/fixture/${file}?render`);
    await page.waitForFunction(() => window.__slate);
    return await fn(page);
  } finally {
    await browser.close();
    server.close();
  }
}

test('manifest carries scenes, cues and typed keys', async () => {
  const m = await withPage((p) => p.evaluate(() => window.__slate.manifest()));
  assert.equal(m.duration, 2);
  assert.deepEqual(m.scenes.map((s) => s.name), ['a', 'b']);
  assert.equal(m.events.filter((e) => e.type === 'key').length, 2);
  assert.ok(m.events.some((e) => e.type === 'resolve' && e.t === 1.5));
  assert.ok(m.events.some((e) => e.type === 'cut' && e.t === 1));
});

test('seeking is deterministic and order-independent', async () => {
  const shots = await withPage(async (p) => {
    const at = async (t) => { await p.evaluate((x) => window.__slate.seek(x), t); return (await p.screenshot()).toString('base64'); };
    const a = await at(0.5);
    await at(1.8);
    const b = await at(0.5); // backwards
    const c = await at(1.6);
    await at(0.1);
    const d = await at(1.6);
    return {a, b, c, d};
  });
  assert.equal(shots.a, shots.b);
  assert.equal(shots.c, shots.d);
  assert.notEqual(shots.a, shots.c);
});

test('typing is a pure function of time', async () => {
  const texts = await withPage(async (p) => {
    const keys = (await p.evaluate(() => window.__slate.manifest())).events.filter((e) => e.type === 'key').map((e) => e.t);
    const between = (keys[0] + keys[1]) / 2; // after the first letter, before the second
    const out = [];
    for (const t of [1.0, 1.9, between, 0.5, 1.9]) { await p.evaluate((x) => window.__slate.seek(x), t); out.push(await p.textContent('#t')); }
    return out;
  });
  assert.deepEqual(texts, ['', 'hi', 'h', '', 'hi']);
});

test('render writes a video with sound and the right frame count', () => {
  const r = spawnSync(process.execPath, [path.join(root, 'engine/render.mjs'), fixture, '--no-critic', '--workers', '2'], {encoding: 'utf8'});
  assert.equal(r.status, 0, r.stderr);
  const out = path.join(root, 'out/fixture.mp4');
  const probe = spawnSync('ffprobe', ['-v', 'error', '-count_frames', '-show_entries', 'stream=codec_type,nb_read_frames,width', '-of', 'json', out], {encoding: 'utf8'});
  const streams = JSON.parse(probe.stdout).streams;
  const v = streams.find((s) => s.codec_type === 'video');
  assert.equal(Number(v.nb_read_frames), 20);
  assert.equal(v.width, 320);
  assert.ok(streams.some((s) => s.codec_type === 'audio'));
  fs.rmSync(out);
});

test('the layout audit finds type over pictures and outside title-safe, and respects exceptions', async () => {
  const issues = await withPage(async (p) => { await p.evaluate(() => window.__slate.seek(0.5)); return p.evaluate(() => window.__slate.audit()); }, 'layout.html');
  const by = (w) => issues.filter((i) => i.what === `"${w}"`).map((i) => i.kind);
  assert.deepEqual(by('over'), ['over a picture']);
  assert.ok(by('edge').includes('outside title-safe'));
  assert.deepEqual(by('fine'), []);
  assert.deepEqual(by('allowed'), []);
  assert.deepEqual(by('hidden'), []);
});

test('record.mjs films a page on a virtual clock, with events and marks', async () => {
  const {record} = await import('../record.mjs');
  const out = path.join(fixture, 'build/app.webm');
  const meta = await record(path.join(fixture, 'shots/app.mjs'), {out, log: () => {}});
  assert.equal(meta.frames, 20); // 3 to glide, 3 to click, 12 to hold, 1 of typing, plus the final state
  assert.equal(meta.events.filter((e) => e.type === 'key').length, 2);
  assert.equal(meta.events.filter((e) => e.type === 'click').length, 1);
  assert.ok(meta.marks.clicked > 0.3);
  const probe = spawnSync('ffprobe', ['-v', 'error', '-count_frames', '-show_entries', 'stream=codec_name,nb_read_frames', '-of', 'json', out], {encoding: 'utf8'});
  const v = JSON.parse(probe.stdout).streams[0];
  assert.equal(v.codec_name, 'vp9');
  assert.equal(Number(v.nb_read_frames), meta.frames);
  fs.rmSync(path.dirname(out), {recursive: true});
});

test('the server answers byte ranges, so video can seek', async () => {
  const {server, url} = await serve();
  try {
    const res = await fetch(`${url}/engine/test/fixture/index.html`, {headers: {range: 'bytes=2-9'}});
    assert.equal(res.status, 206);
    assert.equal(res.headers.get('content-range').split('/')[0], 'bytes 2-9');
    assert.equal((await res.text()).length, 8);
  } finally { server.close(); }
});
