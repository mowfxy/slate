// Dayline · "In place"
//
// The idea: Dayline takes a list and gives each thing its place in the day. The film is that one
// gesture, a thing landing in its slot on the beat, at every scale: tasks land in the timeline, words
// land on the cards, the week lands a sixteenth at a time, and the name lands last with its dot.
// The app is real: every product shot is recorded, and it was built to move on this film's tempo.
//
// The form is a groove: a steady 92 BPM pocket that the landings play on. Each landing is a note of
// the lead (vibraphone) so the picture plays the melody. It never drops out and never speeds up; it
// thickens for the week and resolves under the name.
import {film} from 'slate';

const F = film({fps: 30, width: 1920, height: 1080, bpm: 92, title: 'Dayline · In place'});
const {tl, b} = F;
const $ = (s, el = document) => el.querySelector(s);
const E = b(0.5); // an eighth note: the app's own landing grid

F.notes({
  idea: 'Dayline gives each thing its place in the day. Things land in their slots, on the beat.',
  motif: 'The landing: a short drop that settles with a little overshoot. Tasks, words, the week, the name.',
  proof: 'Every product shot is the working app, recorded: placing the day, moving one thing, opening the week.',
  form: 'A groove. One steady pocket, cards and shots on the bar, the landings playing the melody. No build to a drop, no speed-up, no stop.',
  sound: 'Groove in F at 92: warm pad, electric piano, an 808 kick and sub, claps on two and four. Every landing is a vibraphone note, climbing as the day fills. Rings out under the name.',
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
const HANDLER = 2 / 30; // the recorder's click reaches the app's handler two frames after the press

/** Show clip `name` from `at` to `end`, with clip time `sync` falling on film time `on`. The picture lands on the cut. */
function shot(name, {at, end, sync, on, camera}) {
  const el = $(`[data-scene="${name}"]`), v = $('video', el), clip = clips[name];
  const from = sync - (on - at);
  v.dataset.at = at; v.dataset.from = from;
  F.scene(name, {start: at, end, kind: 'product', energy: 0.6}, (sub) => {
    sub.fromTo(el, {y: 36}, {y: 0, duration: E * 2, ease: 'back.out(1.6)'}, 0);
    camera(sub, v, end - at);
  });
  F.cueClip(clip, at, {from, to: from + (end - at), gain: 0.7});
  return (clipT) => on + (clipT - sync); // clip time -> film time
}

// ------------------------------------------------------------------ cards: each word lands on an eighth
function card(name, {at, end, first = at + E}) {
  const el = $(`[data-scene="${name}"]`), h = $('h1', el);
  const words = h.textContent.split(' ');
  h.innerHTML = words.map((w) => `<span class="w">${w}</span>`).join(' ');
  const spans = el.querySelectorAll('.w');
  F.scene(name, {start: at, end, kind: 'type', words: words.join(' ')}, (sub) => {
    spans.forEach((s, i) => {
      const t = first - at + i * E;
      sub.fromTo(s, {y: -30, opacity: 0}, {y: 0, opacity: 1, duration: E * 1.5, ease: 'back.out(2.2)'}, t - E * 0.75);
    });
  });
  spans.forEach((_, i) => F.cue('land', first + i * E, {i: i * 2, n: 14, soft: true}));
}

// ------------------------------------------------------------------ the film, in beats (92 BPM: a beat is 0.652s)
// 1. "Nine things. One day."
card('c-day', {at: 0, end: b(4), first: b(1)});

// 2. Place my day: the press lands on beat 5, then one task per eighth.
const place = shot('place', {at: b(4), end: b(12), sync: clips.place.marks.click + HANDLER, on: b(5),
  camera: (sub, v, d) => { v.style.transformOrigin = '62% 52%'; sub.fromTo(v, {scale: 1}, {scale: 1.14, duration: d, ease: 'power1.inOut'}, 0); }});
for (let i = 0; i < 9; i++) F.cue('land', b(5) + (i + 2) * E, {i: i + 2, n: 14});

// 3. "Plans change."
card('c-change', {at: b(12), end: b(15), first: b(13)});

// 4. Move one thing: grab on beat 16, drop on 18, the rest make room an eighth apart.
const move = shot('move', {at: b(15), end: b(21), sync: clips.move.marks.grab, on: b(16),
  camera: (sub, v, d) => { v.style.transformOrigin = '75% 55%'; sub.fromTo(v, {scale: 1.08}, {scale: 1.14, duration: d, ease: 'none'}, 0); }});
const drop = move(clips.move.marks.drop);
F.cue('click', b(16));
F.cue('land', drop, {i: 6, n: 14});
for (let k = 0; k < 4; k++) F.cue('land', drop + (k + 3) * E, {i: 7 + k, n: 14, soft: true});

// 5. "So does the week."
card('c-week', {at: b(21), end: b(24), first: b(22)});

// 6. The week: the press on beat 25, the columns open, then a block every sixteenth.
shot('week', {at: b(24), end: b(33), sync: clips.week.marks.click + HANDLER, on: b(25),
  camera: (sub, v, d) => { v.style.transformOrigin = '60% 50%'; sub.fromTo(v, {scale: 1.16}, {scale: 1, duration: d, ease: 'power2.inOut'}, 0); }});
for (let k = 0; k < 19; k++) F.cue('land', b(25) + 3 * E + k * E / 2, {i: k % 10 + 3, n: 14, soft: k % 2 === 1});

// 7. The name lands, then its dot, then the line.
const NAME = b(33);
F.scene('mark', {start: NAME, end: b(41), kind: 'logo', words: 'Dayline', cut: false}, (sub, el) => {
  sub.fromTo($('.word', el), {y: -40, opacity: 0}, {y: 0, opacity: 1, duration: E * 2, ease: 'back.out(1.8)'}, 0);
  sub.fromTo($('.dot', el), {y: -120, opacity: 0}, {y: 0, opacity: 1, duration: E * 1.5, ease: 'back.out(2.6)'}, b(1) - E * 0.75);
});
F.cue('resolve', NAME);
F.cue('land', b(34), {i: 13, n: 14});
F.scene('sign', {start: b(35), end: b(41), kind: 'logo', words: 'Your day, in place.', cut: false}, (sub, el) => {
  sub.fromTo($('.tagline', el), {opacity: 0, y: 12}, {opacity: 1, y: 0, duration: 1.2, ease: 'power2.out'}, 0);
});

F.music({key: 'F', style: 'groove', end: 'ring', arc: [[0, 0.3], [b(4), 0.42], [b(12), 0.5], [b(15), 0.56], [b(21), 0.6], [b(24), 0.7], [b(32), 0.72], [NAME, 0.4], [b(41), 0]]});
F.post({grain: 3, vignette: 0.12});
F.end(b(41));
await F.ready();
