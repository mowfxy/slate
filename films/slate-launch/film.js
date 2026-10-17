// Slate · "Take one"
//
// The idea: a slate is the board that claps shut at the start of every take, so picture and sound
// line up. Slate the product does the same job in code: one timeline drives the picture and the
// sound. So the film is built from the clap. Two halves meet on the beat, at every scale: the matte
// bars close like the sticks, each line of type arrives as a top half and a bottom half, and the
// name lands the same way. Every proof is real footage of this film being made.
import {film} from 'slate';

const F = film({fps: 30, width: 1920, height: 1080, bpm: 100, title: 'Slate · Take one'});
const {tl, b} = F;
const $ = (s, el = document) => el.querySelector(s);

F.notes({
  idea: 'Slate makes picture and sound from one timeline, like the clapperboard it is named after. Two halves meet on the beat.',
  motif: 'The clap: two halves snap together on a beat. The bars, every line of type, and the name.',
  proof: 'Every shot is recorded footage of this film: its code, the studio playing it, its render, its frames, its score, its critic.',
  rejected: [
    'A prompt typed into a box while the camera pulls back: a reference move.',
    'Generated films drifting past as a wall: a reference move, and it shows volume, not craft.',
    'Screens floating in a dark space: a reference move.',
    'A hairline with a serif line above it: too close to a reference that locks one serif line over a horizon.',
  ],
});

// ------------------------------------------------------------------ the sticks
const top = $('#barTop'), bottom = $('#barBottom'), seam = $('#seam'), slug = $('.slug'), caption = $('#caption');
const OPEN = 400, SHUT = 0, GONE = 540; // how far each bar sits from the seam

/** The bars snap shut, landing exactly on time t (a clap). */
function shut(t, {from = OPEN} = {}) {
  tl.fromTo(top, {y: -from}, {y: -SHUT, duration: 0.36, ease: 'power3.in', immediateRender: false}, t - 0.36);
  tl.fromTo(bottom, {y: from}, {y: SHUT, duration: 0.36, ease: 'power3.in', immediateRender: false}, t - 0.36);
  tl.to(slug, {opacity: 0, duration: 0.2, ease: 'none'}, t - 0.36);
  flash(t);
  F.cue('clap', t);
}
/** The bars part from t, revealing the picture. */
function open(t) {
  tl.fromTo(top, {y: -SHUT}, {y: -OPEN, duration: 0.9, ease: 'expo.out', immediateRender: false}, t);
  tl.fromTo(bottom, {y: SHUT}, {y: OPEN, duration: 0.9, ease: 'expo.out', immediateRender: false}, t);
  tl.to(slug, {opacity: 1, duration: 0.5, ease: 'power1.out'}, t + 0.35);
  F.cue('whoosh', t, {len: 0.5, soft: true});
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
function line(name, {meet, leave, end = leave + 0.6, travel = OPEN, dur = 0.36, words, kind = 'type'}) {
  const el = $(`[data-scene="${name}"]`);
  const [up, down] = halves(el);
  F.scene(name, {start: meet - dur, end, kind, words, cut: false}, (sub) => {
    sub.fromTo(up, {y: -travel}, {y: 0, duration: dur, ease: 'power3.in'}, 0);
    sub.fromTo(down, {y: travel}, {y: 0, duration: dur, ease: 'power3.in'}, 0);
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
  frames: '1,206 frames',
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
// Bars start out of frame. On black they are invisible; only the words travel.
tl.set([top, bottom], {y: (i) => (i ? GONE : -GONE)}, 0);

// 1. "This film is a web page." The first sound is the clap.
line('l-page', {meet: b(2), leave: b(6), travel: 330, dur: 0.6, words: 'This film is a web page.'});
tl.set(top, {y: -SHUT}, b(2)); tl.set(bottom, {y: SHUT}, b(2));
flash(b(2)); F.cue('clap', b(2));
open(b(6));
shot('code', {at: b(6), end: b(14), from: 0.9});
shot('studio', {at: b(14), end: b(18), from: 'start', push: 0.03});

// 2. "Every frame, captured."
shut(b(18));
line('l-frames', {meet: b(18), leave: b(21), words: 'Every frame, captured.'});
open(b(21));
shot('render', {at: b(21), end: b(26), from: clips.render.marks.m1 - 0.8});
shot('frames', {at: b(26), end: b(30), from: 'm1', push: 0.05});

// 3. "Every sound, on its frame."
shut(b(30));
line('l-sound', {meet: b(30), leave: b(34), words: 'Every sound, on its frame.'});
open(b(34));
shot('score', {at: b(34), end: b(42), from: 'start'});

// 4. "Checked before you watch."
shut(b(42));
line('l-check', {meet: b(42), leave: b(45), words: 'Checked before you watch.'});
open(b(45));
shot('critic', {at: b(45), end: b(51), from: clips.critic.marks.m1 - 0.6});

// 5. The peak: every proof again, half a beat each. The bars and the slug hold still, so the cuts read.
const montage = $('#montage');
const picks = [['code', 'm1'], ['render', 'm1'], ['studio', 'm1'], ['frames', 'm1'], ['score', 'm1'], ['critic', 'm1'],
  ['code', 'm2'], ['frames', 'm2'], ['render', 'm2'], ['score', 'm2'], ['studio', 'm2'], ['frames', 'm3']];
const M0 = b(51), STEP = b(0.5);
F.scene('montage', {start: M0, end: M0 + picks.length * STEP, kind: 'product', energy: 0.9});
picks.forEach(([name, mark], i) => {
  const v = document.createElement('video');
  Object.assign(v, {src: `footage/${name}.webm`, muted: true, playsInline: true, preload: 'auto'});
  const at = M0 + i * STEP;
  v.dataset.at = at; v.dataset.from = clips[name].marks[mark] ?? clips[name].marks.start ?? 0;
  v.style.visibility = 'hidden';
  montage.append(v);
  tl.set(v, {visibility: 'visible'}, at);
  tl.set(v, {visibility: 'hidden'}, at + STEP);
  tl.fromTo(v, {scale: 1.06}, {scale: 1.02, duration: STEP, ease: 'none', immediateRender: false}, at);
  tl.set(caption, {textContent: CAPTIONS[name]}, at);
  F.cue('tick', at, {i: i % 3});
});
const END_M = M0 + picks.length * STEP; // b(57)

// 6. Shut. Silence. The name arrives the way everything did.
shut(END_M);
F.cue('drop', END_M);
line('mark', {meet: b(59), leave: b(67), end: b(67), travel: 420, dur: 0.6, words: 'Slate', kind: 'logo'});
flash(b(59));
F.cue('clap', b(59)); F.cue('thud', b(59), {soft: true}); F.cue('resolve', b(59));
F.scene('sign', {start: b(61), end: b(67), kind: 'logo', words: 'Launch films, written as code.', cut: false}, (sub, el) => {
  sub.fromTo($('.tagline', el), {opacity: 0, y: 14}, {opacity: 1, y: 0, duration: 1.1, ease: 'power2.out'}, 0);
  sub.fromTo($('.url', el), {opacity: 0}, {opacity: 1, duration: 1.2, ease: 'power1.out'}, b(1.5));
});

F.music({key: 'D', style: 'glass', arc: [[0, 0], [b(2), 0.25], [b(14), 0.35], [b(18), 0.45], [b(30), 0.55], [b(42), 0.65], [b(51), 0.9], [END_M, 0.95], [b(59), 0.2], [b(67), 0]]});
F.post({grain: 5, vignette: 0.3, blur: 4, shutter: 0.5});
F.end(b(67));
await F.ready();
