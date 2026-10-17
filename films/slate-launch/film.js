// Slate · "Take one"
//
// The idea: a slate is the board that claps shut at the start of every take, so picture and sound
// line up. Slate the product does the same job in code: one timeline drives the picture and the
// sound. So the film is built from the clap. Two halves meet on the beat, at every scale: the matte
// bars close like the sticks, each line of type arrives as a top half and a bottom half, and the
// name lands the same way. Every proof is real footage of this film being made.
//
// The form is the take: one unhurried pass, shots that get longer rather than shorter, no montage and
// no stop before the name. The sticks clap once, hard, at the start, like a real slate; after that
// they close softly. The first half has no music at all: the room, the keys, the clicks. A piano
// arrives on the line about sound, plays freely, and rings under the name.
import {film} from 'slate';

const F = film({fps: 30, width: 1920, height: 1080, bpm: 100, title: 'Slate · Take one'});
const {tl, b} = F;
const $ = (s, el = document) => el.querySelector(s);

F.notes({
  idea: 'Slate makes picture and sound from one timeline, like the clapperboard it is named after. Two halves meet on the beat.',
  motif: 'The clap: two halves snap together on a beat. The bars, every line of type, and the name.',
  proof: 'Every shot is recorded footage of this film: its code, the studio playing it, its render, its frames, its score, its critic.',
  form: 'The take. Even and unhurried, slowing at the end: the last two shots are the longest. No montage, no drop before the name; a tool for craft should look confident, not loud.',
  sound: 'The product\'s own sounds first: one hard clap, then keys, clicks and the room. Music only arrives when the film says "Every sound, on its frame": one solo piano, rubato, in D. It ends by ringing under the name.',
  rejected: [
    'A prompt typed into a box while the camera pulls back: a reference move.',
    'Generated films drifting past as a wall: a reference move, and it shows volume, not craft.',
    'Screens floating in a dark space: a reference move.',
    'A hairline with a serif line above it: too close to a reference that locks one serif line over a horizon.',
    'The first cut: glass plucks building into a half-beat montage, a dead stop, then the name. The trailer habit; it made Slate sound like every launch.',
  ],
});

// ------------------------------------------------------------------ the sticks
const top = $('#barTop'), bottom = $('#barBottom'), seam = $('#seam'), slug = $('.slug'), caption = $('#caption'), dim = $('#dim');
const OPEN = 400, SHUT = 0, GONE = 540; // how far each bar sits from the seam

/** The bars close, touching exactly on time t. Softly, unless it's the clap that starts or ends the take. */
function shut(t, {dur = 0.7, gain = 0.28} = {}) {
  tl.fromTo(top, {y: -OPEN}, {y: -SHUT, duration: dur, ease: 'power3.inOut', immediateRender: false}, t - dur);
  tl.fromTo(bottom, {y: OPEN}, {y: SHUT, duration: dur, ease: 'power3.inOut', immediateRender: false}, t - dur);
  tl.to(slug, {opacity: 0, duration: 0.3, ease: 'none'}, t - dur);
  tl.fromTo(dim, {opacity: 0}, {opacity: 1, duration: dur * 0.6, ease: 'power1.inOut', immediateRender: false}, t - dur);
  F.cue('clap', t, {gain});
}
/** The bars part from t, revealing the picture. */
function open(t) {
  tl.fromTo(top, {y: -SHUT}, {y: -OPEN, duration: 0.9, ease: 'expo.out', immediateRender: false}, t);
  tl.fromTo(bottom, {y: SHUT}, {y: OPEN, duration: 0.9, ease: 'expo.out', immediateRender: false}, t);
  tl.to(slug, {opacity: 1, duration: 0.5, ease: 'power1.out'}, t + 0.35);
  tl.set(dim, {opacity: 0}, t);
}
function flash(t) {
  tl.fromTo(seam, {opacity: 0.85, scaleX: 0.25}, {opacity: 0, scaleX: 1.1, duration: 0.5, ease: 'power2.out', immediateRender: false}, t);
}

// ------------------------------------------------------------------ type in halves
function halves(el) {
  const h = $('h1', el);
  const up = document.createElement('div'), down = document.createElement('div');
  up.className = 'half up'; down.className = 'half down';
  down.dataset.audit = 'off'; // the same words twice; the checker reads the top copy
  down.setAttribute('aria-hidden', 'true');
  up.append(h); down.append(h.cloneNode(true));
  el.append(up, down);
  return [up, down];
}
/** A line whose halves ride in on the sticks and meet at `meet`, then part with them at `leave`. */
function line(name, {meet, leave, end = leave + 0.6, travel = OPEN, dur = 0.7, ease = 'power3.inOut', words, kind = 'type'}) {
  const el = $(`[data-scene="${name}"]`);
  const [up, down] = halves(el);
  F.scene(name, {start: meet - dur, end, kind, words, cut: false}, (sub) => {
    sub.fromTo(up, {y: -travel}, {y: 0, duration: dur, ease}, 0);
    sub.fromTo(down, {y: travel}, {y: 0, duration: dur, ease}, 0);
    // a breath of settling after contact, so it reads as two things meeting rather than a fade
    sub.fromTo([up, down], {scale: 1.006}, {scale: 1, duration: 0.7, ease: 'power2.out'}, dur);
    if (leave < end) {
      // the halves leave inside the sticks (same move, same ease), fading as they go
      sub.to(up, {y: -OPEN, duration: 0.9, ease: 'expo.out'}, leave - meet + dur);
      sub.to(down, {y: OPEN, duration: 0.9, ease: 'expo.out'}, leave - meet + dur);
      sub.to([up, down], {opacity: 0, duration: 0.35, ease: 'power1.in'}, leave - meet + dur);
    }
  });
}

// ------------------------------------------------------------------ footage
const clips = {};
for (const n of ['code', 'studio', 'render', 'frames', 'score', 'critic']) {
  try { clips[n] = await F.footage(n); } catch (e) { console.warn(e.message); clips[n] = {name: n, duration: 10, events: [], marks: {}}; }
}
const CAPTIONS = {
  code: 'film.js · this film, as code',
  studio: 'The studio · playing this film',
  render: 'render.mjs · every frame from the browser',
  frames: '1,350 frames',
  score: 'The score · cues on the timeline',
  critic: 'The critic · sync, type, sound, originality',
};
/** Show clip `name` from film time `at` to `end`, starting at clip time `from` (or its mark), pushing in slowly. */
function shot(name, {at, end, from = 0, push = 0.04, sounds = true}) {
  const el = $(`[data-scene="${name}"]`);
  const v = $('video', el);
  const clip = clips[name];
  if (typeof from === 'string') from = clip.marks[from] ?? 0;
  v.dataset.at = at; v.dataset.from = from;
  F.scene(name, {start: at, end, kind: 'product', energy: 0.5}, (sub) => {
    sub.fromTo(v, {scale: 1}, {scale: 1 + push, duration: end - at, ease: 'none'}, 0);
  });
  tl.set(caption, {textContent: CAPTIONS[name]}, at);
  if (sounds) F.cueClip(clip, at, {from, to: from + (end - at), gain: 0.8});
}

// ------------------------------------------------------------------ the timecode in the slug
const tc = $('#tc');
F.onFrame((t) => {
  const f = Math.round(t * F.fps), s = Math.floor(f / F.fps);
  tc.textContent = `00:00:${String(s).padStart(2, '0')}:${String(f % F.fps).padStart(2, '0')}`;
});

// ------------------------------------------------------------------ the film, in beats (100 BPM: a beat is 0.6s)
// Shots: 6.0s, 3.6s | 4.2s, 3.6s | 7.2s | 5.4s, then the name. They lengthen toward the end.
// Bars start out of frame. On black they are invisible; only the words travel.
tl.set([top, bottom], {y: (i) => (i ? GONE : -GONE)}, 0);

// 1. "This film is a web page." The take starts with the one hard clap.
line('l-page', {meet: b(2), leave: b(6), travel: 330, dur: 0.36, ease: 'power3.in', words: 'This film is a web page.'});
tl.set(top, {y: -SHUT}, b(2)); tl.set(bottom, {y: SHUT}, b(2));
flash(b(2)); F.cue('clap', b(2));
open(b(6));
shot('code', {at: b(6), end: b(16), from: 0.9});
shot('studio', {at: b(16), end: b(22), from: 'start', push: 0.03});

// 2. "Every frame, captured."
shut(b(22));
line('l-frames', {meet: b(22), leave: b(25), words: 'Every frame, captured.'});
open(b(25));
shot('render', {at: b(25), end: b(32), from: 1.2});
shot('frames', {at: b(32), end: b(38), from: clips.frames.marks.m1 - 0.4, push: 0.05});

// 3. "Every sound, on its frame." The first note of music in the film is on this line.
shut(b(38));
line('l-sound', {meet: b(38), leave: b(42), words: 'Every sound, on its frame.'});
F.cue('land', b(38), {i: 4, n: 14, soft: true});
open(b(42));
shot('score', {at: b(42), end: b(54), from: 'start'});

// 4. "Checked before you watch." The longest look of the film is the last proof.
shut(b(54));
line('l-check', {meet: b(54), leave: b(57), words: 'Checked before you watch.'});
open(b(57));
shot('critic', {at: b(57), end: b(66), from: 0, push: 0.03});

// 5. The tail slate: the sticks close slowly over the last shot and the name meets in them.
const NAME = b(66);
shut(NAME, {dur: 1.4, gain: 0.45});
// the name's halves ride inside the sticks (same travel, time and ease), so nothing crosses the last shot
line('mark', {meet: NAME, leave: b(75), end: b(75), travel: OPEN, dur: 1.4, words: 'Slate', kind: 'logo'});
// the name is so large that its halves would start past the frame's safe edge: they surface as the sticks come in
const nameHalves = document.querySelectorAll('[data-scene="mark"] .half');
tl.set(nameHalves, {opacity: 0}, NAME - 1.4);
tl.fromTo(nameHalves, {opacity: 0}, {opacity: 1, duration: 0.4, ease: 'power1.out', immediateRender: false}, NAME - 0.9);
F.cue('resolve', NAME);
F.scene('sign', {start: b(68), end: b(75), kind: 'logo', words: 'Launch films, written as code.', cut: false}, (sub, el) => {
  sub.fromTo($('.tagline', el), {opacity: 0, y: 14}, {opacity: 1, y: 0, duration: 1.4, ease: 'power2.out'}, 0);
  sub.fromTo($('.url', el), {opacity: 0}, {opacity: 1, duration: 1.4, ease: 'power1.out'}, b(2));
});

// No music until the line about sound; then a solo piano that breathes, and rings under the name.
F.music({key: 'D', style: 'solo', end: 'ring', gain: 0.45, room: 4, arc: [[0, 0], [b(39.9), 0], [b(40), 0.3], [b(46), 0.45], [b(54), 0.55], [b(62), 0.3], [NAME, 0.18], [b(75), 0]]});
F.post({grain: 5, vignette: 0.3, blur: 4, shutter: 0.5});
F.end(b(75));
await F.ready();
