import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildTimeline, montageShots, validateSpec, wordCount} from '../src/lib/timeline.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const examples = path.resolve(here, '../../examples');
const specs = fs
  .readdirSync(examples)
  .filter((d) => fs.existsSync(path.join(examples, d, 'spec.json')))
  .map((d) => [d, JSON.parse(fs.readFileSync(path.join(examples, d, 'spec.json'), 'utf8'))]);

const base = (scenes, meta = {}) => ({meta: {title: 't', bpm: 120, fps: 30, ...meta}, brand: {name: 'X', accent: '#f00', ink: '#000', paper: '#fff'}, scenes});

test('every example spec is valid and builds', () => {
  assert.ok(specs.length >= 2);
  for (const [name, spec] of specs) {
    assert.deepEqual(validateSpec(spec), [], name);
    const tl = buildTimeline(spec);
    assert.ok(tl.totalFrames > 0, name);
  }
});

test('scene boundaries land on the beat grid', () => {
  for (const [name, spec] of specs) {
    const tl = buildTimeline(spec);
    const beat = 60 / tl.bpm;
    for (const s of tl.scenes) {
      const beats = s.start / beat;
      assert.ok(Math.abs(beats - Math.round(beats * 4) / 4) < 1e-6, `${name} scene ${s.index} starts off-grid`);
    }
  }
});

test('scenes tile the film with no gaps or overlaps', () => {
  for (const [, spec] of specs) {
    const tl = buildTimeline(spec);
    let frame = 0;
    for (const s of tl.scenes) {
      assert.equal(s.startFrame, frame);
      frame += s.durationFrames;
    }
    assert.equal(frame, tl.totalFrames);
  }
});

test('montage shots fill the scene and accelerate', () => {
  const shots = montageShots(16, 'accelerate', 1, 0.25);
  assert.equal(shots.reduce((a, b) => a + b, 0), 16);
  assert.equal(shots[0], 1);
  assert.equal(shots.at(-1), 0.25);
  for (let i = 1; i < shots.length; i++) assert.ok(shots[i] <= shots[i - 1] + 1e-9);
  for (const s of shots) assert.ok([8, 4, 2, 1, 0.5, 0.25].includes(s));
  assert.ok(montageShots(4, 'steady', 4).length === 1);
});

test('events are sorted and inside the film', () => {
  for (const [, spec] of specs) {
    const tl = buildTimeline(spec);
    for (let i = 1; i < tl.events.length; i++) assert.ok(tl.events[i].t >= tl.events[i - 1].t);
    for (const e of tl.events) assert.ok(e.t >= 0 && e.t <= tl.duration);
  }
});

test('typing produces one key tap per visible character', () => {
  const tl = buildTimeline(base([{type: 'typeTitle', beats: 8, text: 'Hi *there*'}]));
  assert.equal(tl.events.filter((e) => e.type === 'key').length, 'Hithere'.length);
  assert.ok(tl.scenes[0].typedAt > 0);
});

test('brackets pop and titles hit', () => {
  const tl = buildTimeline(base([{type: 'bracketTitle', beats: 8, text: 'Go [a] to (b).'}, {type: 'titleCard', beats: 4, text: 'X'}, {type: 'logoEnd', beats: 4}]));
  assert.equal(tl.events.filter((e) => e.type === 'pop').length, 2);
  assert.equal(tl.events.filter((e) => e.type === 'hit').length, 1);
  assert.equal(tl.events.filter((e) => e.type === 'resolve').length, 1);
});

test('invalid specs are rejected with useful errors', () => {
  const errs = validateSpec(base([{type: 'nope', beats: 2}, {type: 'typeTitle'}, {type: 'uiShot', beats: 2}]));
  assert.ok(errs.some((e) => e.includes('unknown type')));
  assert.ok(errs.some((e) => e.includes('needs "beats"')));
  assert.ok(errs.some((e) => e.includes('needs "image"')));
  assert.throws(() => buildTimeline(base([])));
});

test('word counting ignores markup', () => {
  assert.equal(wordCount('Go from [idea] to (deployment)'), 5);
  assert.equal(wordCount('Introducing *Slate*'), 2);
});
