// Dayline · "In place"
//
// The idea: Dayline takes a list and gives each thing its place in the day. The film is that one
// gesture, a thing landing in its slot on the beat, at every scale: tasks land in the timeline, words
// land on the cards, the week lands a sixteenth at a time, and the name lands last with its dot.
// The app is real: every product shot is recorded, and it was built to move on this film's tempo.
//
// The form is a groove: a steady 92 BPM pocket, with every landing on an eighth. It never drops out
// and never speeds up; it thickens for the week and resolves under the name.
//
// The camera works like an editor's: close on the control as the pointer reaches it, following the
// block that moves, pulling back only when the whole day or week is the point.
import {film} from 'slate';

const F = film({fps: 60, width: 1920, height: 1080, bpm: 92, title: 'Dayline · In place'});
const {tl, b} = F;
const $ = (s, el = document) => el.querySelector(s);
const E = b(0.5); // an eighth note: the app's own landing grid

F.notes({
  idea: 'Dayline gives each thing its place in the day. Things land in their slots, on the beat.',
  motif: 'The landing: a short drop that settles with a little overshoot. Tasks, words, the week, the name.',
  proof: 'Every product shot is the working app, recorded: placing the day, moving one thing, opening the week.',
  form: 'A groove. One steady pocket, cards and shots on the bar, every landing on an eighth. No build to a drop, no speed-up, no stop.',
  sound: 'A warm, unhurried groove at 92: soft electric piano or Rhodes chords, a round sub bass, a relaxed kick and a brushed snare or clap on two and four, light hats. Calm and confident, like a good morning. Not cheesy, no ukulele or whistling, no corporate-stock brightness. Every landing in the picture is a soft paper tap from the foley, not a note. It settles under the name and rings out on one chord.',
  rejected: [
    'Headline letters typed out on white with one coloured word: a reference move.',
    'A prompt typed into a box while the camera pulls back: a reference move, and Dayline has no prompt.',
    'App windows floating in a dark space: a reference move, and it would lose the paper the app lives on.',
    'Solo piano and room tone: too quiet and thin for an ad; the references are produced, with a real low end.',
  ],
});

// ------------------------------------------------------------------ footage
const clips = {};
for (const n of ['place', 'move', 'week']) {
  try { clips[n] = await F.footage(n); } catch (e) { console.warn(e.message); clips[n] = {name: n, duration: 7, events: [], marks: {}}; }
}
const HANDLER = 2 / 60; // the recorder's click reaches the app's handler two frames after the press

/**
 * Show clip `name` from `at` to `end`, with clip time `sync` falling on film time `on`. The camera
 * frames the part of the app that is acting: keys are [clip time, x, y, zoom, ease] in the app's own
 * pixels, so it can aim at the rects the recorder stored. Returns clip time -> film time.
 */
function shot(name, {at, end, sync, on, camera = []}) {
  const el = $(`[data-scene="${name}"]`), v = $('video', el), clip = clips[name];
  const from = sync - (on - at);
  const film = (clipT) => on + (clipT - sync);
  v.dataset.at = at; v.dataset.from = from;
  F.scene(name, {start: at, end, kind: 'product', energy: 0.6});
  F.camera(v, camera.map(([c, x, y, zoom, ease]) => ({t: film(c), x, y, zoom, ease})), {of: clip});
  F.cueClip(clip, at, {from, to: from + (end - at), gain: 0.7});
  return film;
}
const mid = (r) => [r.x + r.width / 2, r.y + r.height / 2];

// ------------------------------------------------------------------ cards: each word lands on an eighth
// A word drops into its line from above, through a mask, and settles: fast in, long soft stop, no bounce.
// It reaches its place on the eighth, so the sound and the stop are one event.
const SETTLE = 'expo.out';
function card(name, {at, end, first = at + E}) {
  const el = $(`[data-scene="${name}"]`), h = $('h1', el);
  const words = h.textContent.split(' ');
  h.innerHTML = words.map((w) => `<span class="m"><span class="w">${w}</span></span>`).join(' ');
  const spans = el.querySelectorAll('.w');
  F.scene(name, {start: at, end, kind: 'type', words: words.join(' ')}, (sub) => {
    spans.forEach((s, i) => {
      const t = first - at + i * E;
      sub.fromTo(s, {yPercent: -105}, {yPercent: 0, duration: E * 2.2, ease: SETTLE}, t - E * 0.35);
    });
  });
  spans.forEach((_, i) => F.cue('land', first + i * E, {i: i * 2, n: 14, soft: true}));
}

// ------------------------------------------------------------------ the film, in beats (92 BPM: a beat is 0.652s)
// 1. "Nine things. One day."
card('c-day', {at: 0, end: b(4), first: b(1)});

// 2. Place my day: the press lands on beat 5, then one task per eighth.
// The camera opens close on the button as the pointer arrives, and pulls back as the day fills.
const R = clips.place.rects;
const click = clips.place.marks.click;
shot('place', {at: b(4), end: b(12), sync: click + HANDLER, on: b(5), camera: [
  [click - 1.1, mid(R.go)[0] - 60, mid(R.go)[1] + 40, 2.4],
  [click + 0.05, ...mid(R.go), 2.5, 'power2.inOut'],
  [click + 2.2, 1010, 480, 1.5, 'power2.inOut'],
  [click + 4.3, 1060, 560, 1.32, 'sine.inOut'],
]});
for (let i = 0; i < 9; i++) F.cue('land', b(5) + (i + 2) * E, {i: i + 2, n: 14});

// 3. "Plans change."
card('c-change', {at: b(12), end: b(15), first: b(13)});

// 4. Move one thing: grab on beat 16, drop on 18, the rest make room an eighth apart.
// Close on the block as it is picked up, following it down to the afternoon, then back to see the rest make room.
const M = clips.move.rects, grab = clips.move.marks.grab, dropped = clips.move.marks.drop;
// keep the blocks' left edge in frame, so no label is cut by the edge
const bx = M.block.x + 400, by = M.block.y + M.block.height / 2;
const move = shot('move', {at: b(15), end: b(21), sync: grab, on: b(16), camera: [
  [grab - 0.6, bx + 40, by + 40, 2.1],
  [grab + 0.1, bx, by + 20, 2.25, 'power2.inOut'],
  [dropped, bx, by + 4 * 56, 2.25, 'power2.inOut'],
  [dropped + 1.5, 1080, 520, 1.45, 'power3.inOut'],
]});
const drop = move(clips.move.marks.drop);
F.cue('click', b(16));
F.cue('land', drop, {i: 6, n: 14});
for (let k = 0; k < 4; k++) F.cue('land', drop + (k + 3) * E, {i: 7 + k, n: 14, soft: true});

// 5. "So does the week."
card('c-week', {at: b(21), end: b(24), first: b(22)});

// 6. The week: the press on beat 25, the columns open, then a block every sixteenth.
// From the day, the camera eases back as the week opens, ending on the whole week, wide.
const wk = clips.week.marks.click;
shot('week', {at: b(24), end: b(33), sync: wk + HANDLER, on: b(25), camera: [
  [wk - 0.65, 1180, 400, 1.7],
  [wk + 0.2, 1160, 470, 1.6, 'power2.inOut'],
  [wk + 4.2, 960, 560, 1.06, 'power2.inOut'],
  [wk + 6, 960, 560, 1.02, 'sine.out'],
]});
for (let k = 0; k < 19; k++) F.cue('land', b(25) + 3 * E + k * E / 2, {i: k % 10 + 3, n: 14, soft: k % 2 === 1});

// 7. The name lands, then its dot, then the line.
const NAME = b(33);
F.scene('mark', {start: NAME, end: b(41), kind: 'logo', words: 'Dayline', cut: false}, (sub, el) => {
  sub.fromTo($('.word', el), {yPercent: -105}, {yPercent: 0, duration: E * 2.6, ease: SETTLE}, -E * 0.35);
  // the dot is the one thing that lands with a little weight
  sub.fromTo($('.dot', el), {y: -140, opacity: 0}, {y: 0, opacity: 1, duration: E * 1.6, ease: 'back.out(1.3)'}, b(1) - E * 1.1);
});
F.cue('resolve', NAME);
F.cue('land', b(34), {i: 13, n: 14});
F.scene('sign', {start: b(35), end: b(41), kind: 'logo', words: 'Your day, in place.', cut: false}, (sub, el) => {
  sub.fromTo($('.tagline', el), {opacity: 0, y: 10}, {opacity: 1, y: 0, duration: 1.4, ease: 'power3.out'}, 0);
});

F.music({key: 'F', style: 'groove', end: 'ring', arc: [[0, 0.3], [b(4), 0.42], [b(12), 0.5], [b(15), 0.56], [b(21), 0.6], [b(24), 0.7], [b(32), 0.72], [NAME, 0.4], [b(41), 0]]});
F.post({grain: 3, vignette: 0.12}); // 60 fps reads smooth without blur; a few subframes would ghost the camera moves into copies
F.end(b(41));
await F.ready();
