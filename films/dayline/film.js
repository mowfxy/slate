// Dayline · "Give your list a day"
//
// The idea: Dayline's mark is a word and a dot, and the dot is the app's now-line: the one point in the
// day where you are. The film follows that dot. It ends the opening line, drops into the app as now,
// and comes back out as the dot in the name. In between, the app does the one thing it is for: a list
// gets a day. Nine things fly to their hours, one moves and the rest make room, the day becomes a week.
//
// Method: the app is live in the page (real HTML and CSS), not a recording, and the timeline drives
// it. So the camera can sit at 3x on a button with every edge sharp, and each block can move on its own.
//
// Form: one continuous take inside the app, cut by two lines of type on the downbeat. 120 BPM, so a
// beat is half a second and every landing is on an eighth.
import {film} from 'slate';

const F = film({fps: 60, width: 1920, height: 1080, bpm: 120, title: 'Dayline · Give your list a day'});
const {tl, b, gsap} = F;
const $ = (s) => document.querySelector(s);
const E = b(0.5); // an eighth

F.notes({
  idea: "The dot in Dayline's name is the now-line in the app. The film follows the dot: it ends the first line, becomes now, and comes back as the name.",
  motif: 'Things land in their hour on the eighth note. Fast out, long soft stop, no overshoot.',
  proof: 'The live app: nine things placed, one moved while the rest make room, the week filling in.',
  form: 'One continuous take inside the app, cut by two lines of type on downbeats. No montage, no speed-up.',
  sound: 'Electronic, warm and clean, 120 BPM in D: a soft pad and a filtered pluck that opens when the day is placed, a round sub and a light kick from the press, a breath for "Plans change.", the full groove for the week, and one low hit under the name that rings out.',
  // the originality check flags these against the white frames of a reference launch film; looked at frame by frame,
  // they are a small mark on a white page (the opening dot) and the brand's own wordmark and dot, not that film's shots
  reviewed: [
    {from: 0, to: 1.2, ref: 'ref1', why: 'opening: one orange dot on an empty page of hour lines'},
    {from: 23.9, to: 25.2, ref: 'ref1', why: "end card: Dayline's own wordmark and dot rising on white"},
  ],
  rejected: [
    'A screen recording zoomed 2.5x: soft text, compression, and the camera can only crop a flat picture.',
    'Warm beige paper with a vignette and grain: the app is white, and the haze made everything grey.',
    'Light serif lines at 96px in the middle of nothing: too small and too quiet to hold a frame.',
    'Typed-on headline with one coloured word, a prompt box pull-back, windows in space: reference moves.',
  ],
});

// ------------------------------------------------------------------ the app's content
const C = {blue: '#3b6ef5', peach: '#f2683c', violet: '#8b5cf6', yellow: '#dc9d00', slate: '#5b6b80', green: '#1f9d55', rose: '#e5484d', teal: '#0fa0a0', sand: '#ad7f48'};
// the list, in the order it was written down; each has an hour (decimal) and a length
const TASKS = [
  {name: 'Groceries', len: '30 min', at: 14.25, dur: 0.5, c: C.green},
  {name: 'Write the weekly update', len: '45 min', at: 13.5, dur: 0.75, c: C.slate},
  {name: 'Dentist', len: '1 hr', at: 15.5, dur: 1, c: C.rose},
  {name: 'Call with Sam', len: '30 min', at: 11, dur: 0.5, c: C.peach},
  {name: 'Deep work', len: '2 hr', at: 9, dur: 2, c: C.blue},
  {name: 'Gym', len: '1 hr', at: 17, dur: 1, c: C.teal},
  {name: 'Lunch with Priya', len: '1 hr', at: 12.5, dur: 1, c: C.yellow},
  {name: 'Read', len: '30 min', at: 18.25, dur: 0.5, c: C.sand},
  {name: 'Review designs', len: '1 hr', at: 11.5, dur: 1, c: C.violet},
];
const WEEK = [
  [1, 'Standup', 9, 0.5, C.blue], [1, 'Design crit', 10, 1.5, C.violet], [1, 'Lunch', 12.5, 1, C.yellow], [1, 'Focus time', 14, 2, C.blue], [1, 'Run', 17.5, 1, C.teal],
  [2, 'Deep work', 9, 2.5, C.blue], [2, '1:1 with Ana', 12, 0.5, C.peach], [2, 'Lunch', 12.5, 1, C.yellow], [2, 'Planning', 15, 1.5, C.slate],
  [3, 'Standup', 9, 0.5, C.blue], [3, 'Interviews', 10, 2, C.violet], [3, 'Groceries', 13, 0.5, C.green], [3, 'Pottery', 18, 1, C.sand],
  [4, 'Deep work', 9, 2, C.blue], [4, 'Ship notes', 11.5, 1, C.slate], [4, 'Team lunch', 12.5, 1.5, C.yellow],
];

// geometry, in the window's own pixels
const WIN = {x: 120, y: 60};
const HOUR = 74, TOP = 128, COL = {x: 556, w: 1084}, GAP = 14, W5 = (COL.w - GAP * 4) / 5;
const REVEAL_AT = b(7.5); // when the app opens out of the dot (see the type, below)
const hourY = (h) => TOP + (h - 8) * HOUR;
const rowY = (i) => 176 + i * 78;
const clock = (h) => { const hh = Math.floor(h), mm = Math.round((h - hh) * 60); return `${((hh + 11) % 12) + 1}:${String(mm).padStart(2, '0')}`; };
const span = (a, d) => `${clock(a)} – ${clock(a + d)} ${a + d >= 12 ? 'PM' : 'AM'}`;
const toWorld = (x, y) => ({x: WIN.x + x, y: WIN.y + y});

const hours = $('#hours');
for (let h = 8; h <= 19; h++) hours.insertAdjacentHTML('beforeend', `<div style="top:${(h - 8) * HOUR}px"><span>${((h + 11) % 12) + 1} ${h < 12 ? 'AM' : 'PM'}</span></div>`);
const names = $('#daynames');
['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].forEach((d, i) => names.insertAdjacentHTML('beforeend', `<span style="left:${i * (W5 + GAP) + 2}px">${d}</span>`));
$('#now').style.top = hourY(8.6) + 'px';

function block({name, at, dur, c}, cls = '') {
  const el = document.createElement('div');
  el.className = `block ${dur <= 0.75 ? 'short' : ''} ${cls}`;
  el.style.setProperty('--c', c);
  el.innerHTML = `<span class="t">${name}</span><small>${span(at, dur)}</small>`;
  $('#blocks').append(el);
  return el;
}
const place = (el, x, at, dur, w) => gsap.set(el, {left: x, top: hourY(at) + 2, width: w, height: dur * HOUR - 4});

const rows = TASKS.map((t, i) => {
  const el = document.createElement('div');
  el.className = 'row';
  el.style.cssText = `top:${rowY(i)}px; --c:${t.c}`;
  el.innerHTML = `<i></i>${t.name}<em>${t.len}</em>`;
  $('#rows').append(el);
  return el;
});
const blocks = TASKS.map((t) => { const el = block(t); place(el, COL.x, t.at, t.dur, COL.w); return el; });
const week = WEEK.map(([d, name, at, dur, c]) => { const el = block({name, at, dur, c}, 'wk'); place(el, COL.x + d * (W5 + GAP), at, dur, W5); return el; });

// the controls, measured from the laid-out app (offsets ignore the camera's transform)
const centre = (el) => { let x = el.offsetWidth / 2, y = el.offsetHeight / 2; for (let e = el; e && e.id !== 'win'; e = e.offsetParent) { x += e.offsetLeft; y += e.offsetTop; } return {x, y}; };
await document.fonts.ready;

// the cards' pages: hour lines and labels, and each line of words set with its baseline on its line
for (const card of document.querySelectorAll('.card.day')) {
  const h0 = +card.dataset.hours, y0 = +card.dataset.grid;
  for (let k = 0, y = y0; y < 1080; k++, y += 216) {
    card.insertAdjacentHTML('afterbegin', `<div class="hr" style="top:${y - 1}px"></div>`);
    if (y > 80 && y < 1000) card.insertAdjacentHTML('afterbegin', `<div class="hl" style="top:${y}px" data-small>${((h0 + k + 11) % 12) + 1} ${h0 + k < 12 ? 'AM' : 'PM'}</div>`);
  }
}
for (const ln of document.querySelectorAll('.ln[data-baseline]')) {
  const probe = document.createElement('i');
  probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
  ln.append(probe);
  ln.style.top = (+ln.dataset.baseline - probe.offsetTop) + 'px';
  probe.remove();
}
const GO = centre($('#go')), WEEKBTN = centre($('#weekBtn'));

// ------------------------------------------------------------------ the camera: one take through the app
const W = (x, y, zoom, t, ease) => ({t, ...toWorld(x, y), zoom, ease});
const sam = TASKS.findIndex((t) => t.name === 'Call with Sam');
const SAM_Y = hourY(11) + 18, SAM_TO = 14.5, DRAG = (SAM_TO - 11) * HOUR;
const cam = F.camera($('#world'), [
  W(720, 452, 1.19, 0), // the list and the empty day, whole: nothing cut by the frame
  W(720, 456, 1.23, b(11.2), 'sine.inOut'),
  W(GO.x - 40, GO.y + 70, 2.9, b(13.2), 'power3.inOut'), // onto the button as the pointer gets there
  W(GO.x - 20, GO.y + 60, 3.0, b(14.1), 'sine.out'),
  W(860, 490, 1.12, b(18), 'power3.inOut'), // out with the flights, to the whole day
  W(860, 492, 1.15, b(24), 'sine.inOut'),
  // after "Plans change.": close on Sam's call, following it down to the afternoon
  // (the frame's bottom edge sits in the gap above the Dentist, so no label is cut while it holds)
  W(764, 312, 2.36, b(28)),
  W(770, 308, 2.4, b(30.5), 'sine.inOut'),
  W(770, 545, 2.4, b(33.2), 'power2.inOut'),
  W(860, 470, 1.12, b(36), 'power3.inOut'),
  W(850, 470, 1.1, b(39.2), 'sine.inOut'),
  W(840, 480, 1.0, b(43), 'power3.inOut'), // the week, whole
  W(840, 480, 1.04, b(48), 'sine.inOut'),
]);

// ------------------------------------------------------------------ the pointer
const cursor = $('#cursor');
const pointer = (x, y, t, d, ease = 'power2.inOut') => {
  // x and y on different curves, so the path arcs like a hand, not a ruler
  tl.to(cursor, {x: x - 3, duration: d, ease}, t);
  tl.to(cursor, {y: y - 2, duration: d, ease: ease.replace('inOut', 'out')}, t);
};
const press = (t, cue = true) => {
  tl.to(cursor, {scale: 0.86, duration: 0.07, ease: 'power2.out'}, t - 0.07).to(cursor, {scale: 1, duration: 0.18, ease: 'power2.out'}, t + 0.02);
  if (cue) F.cue('click', t);
};
tl.set(cursor, {x: 1240, y: 780, opacity: 0}, 0).set(cursor, {opacity: 1}, b(10.5));
pointer(GO.x + 6, GO.y + 4, b(10.8), b(13.6) - b(10.8));
press(b(14));
tl.to('#go', {scale: 0.95, duration: 0.08, ease: 'power2.out'}, b(14) - 0.06).to('#go', {scale: 1, duration: 0.4, ease: 'power3.out'}, b(14) + 0.03);
pointer(GO.x + 160, GO.y + 230, b(15), 1.4, 'power3.inOut');

// ------------------------------------------------------------------ 0. the nine things arrive in the list, an eighth apart
const listed = rows.map((_, i) => REVEAL_AT + 0.35 + i * E);
rows.forEach((r, i) => tl.fromTo(r, {opacity: 0, y: 14}, {opacity: 1, y: 0, duration: 0.6, ease: 'expo.out'}, listed[i] - 0.08));
listed.forEach((t, i) => F.cue('tick', t, {i, soft: true}));

// ------------------------------------------------------------------ 1. nine things fly to their hours
// each lifts out of the list, travels on an arc and lands on its eighth: fast out, long soft stop
const FLY = 0.8;
const land = TASKS.map((_, i) => b(16) + i * E);
TASKS.forEach((t, i) => {
  const el = blocks[i], at = land[i] - FLY;
  gsap.set(el, {'--k': 0});
  tl.fromTo(el, {left: 28, width: 404, height: 68}, {left: COL.x, width: COL.w, height: t.dur * HOUR - 4, duration: FLY, ease: 'power3.inOut'}, at);
  tl.fromTo(el, {top: rowY(i)}, {top: hourY(t.at) + 2, duration: FLY, ease: 'power2.inOut'}, at);
  tl.fromTo(el, {'--k': 0}, {'--k': 1, duration: FLY * 0.7, ease: 'power1.inOut'}, at + FLY * 0.15);
  tl.fromTo(el, {scale: 1, '--lift': 0}, {keyframes: [{scale: 1.035, '--lift': 0.7, duration: FLY * 0.45, ease: 'power2.out'}, {scale: 1, '--lift': 0, duration: FLY * 0.55, ease: 'power2.inOut'}]}, at);
  F.cue('lift', at, {i});
  F.cue('land', land[i], {i, n: TASKS.length});
});
const placed = land.at(-1);

// ------------------------------------------------------------------ 2. one moves, the rest make room
const S = blocks[sam];
const GRAB = b(30), DROP = b(33);
pointer(COL.x + 70, SAM_Y + 6, b(28), GRAB - b(28) - 0.1, 'power3.inOut');
tl.set(cursor, {x: 1000, y: SAM_Y + 160}, b(28) - 0.02);
press(GRAB);
tl.set(S, {zIndex: 6}, GRAB - 0.01);
tl.to(S, {scale: 1.03, rotation: -0.8, '--lift': 1, duration: 0.35, ease: 'power3.out'}, GRAB);
tl.to(S, {top: `+=${DRAG}`, duration: DROP - GRAB - 0.5, ease: 'power2.inOut'}, GRAB + 0.5);
tl.to(cursor, {y: `+=${DRAG}`, duration: DROP - GRAB - 0.5, ease: 'power2.inOut'}, GRAB + 0.5);
tl.to(S, {scale: 1, rotation: 0, '--lift': 0, duration: 0.5, ease: 'power3.out'}, DROP);
F.cue('drop', DROP);
// the four between make room as the call passes over them, each half an hour earlier
['Review designs', 'Lunch with Priya', 'Write the weekly update', 'Groceries'].forEach((n, k) => {
  const i = TASKS.findIndex((t) => t.name === n);
  const t = GRAB + 0.5 + (k + 0.7) * ((DROP - GRAB - 0.5) / 4.6);
  tl.to(blocks[i], {top: `-=${HOUR / 2}`, duration: 0.45, ease: 'power3.out'}, t);
  F.cue('tick', t + 0.1, {i: k});
});
pointer(1100, SAM_Y + DRAG + 220, DROP + 0.3, 1.2, 'power3.inOut');

// ------------------------------------------------------------------ 3. the day becomes a week
const WK = b(40);
pointer(WEEKBTN.x + 4, WEEKBTN.y + 6, b(37.2), WK - b(37.2) - 0.1, 'power3.inOut');
press(WK);
tl.to('#pill', {x: 92, duration: 0.45, ease: 'power3.inOut'}, WK);
blocks.forEach((el, i) => {
  const t = WK + 0.15 + i * 0.03;
  tl.to(el, {width: W5, fontSize: TASKS[i].dur <= 0.5 ? 15 : 16, paddingLeft: 11, paddingRight: 11, duration: 0.8, ease: 'power3.inOut'}, t);
  tl.to(el.querySelector('small'), {opacity: 0, duration: 0.25}, t);
});
tl.to('#now', {right: 40 + 4 * (W5 + GAP), duration: 0.8, ease: 'power3.inOut'}, WK + 0.15);
tl.to('#daynames span', {opacity: 1, duration: 0.4, stagger: 0.06, ease: 'power2.out'}, WK + 0.6);
// the rest of the week lands a sixteenth at a time, column by column
week.forEach((el, k) => {
  const t = WK + b(1.5) + k * E / 2;
  tl.fromTo(el, {opacity: 0, y: -18}, {opacity: 1, y: 0, duration: 0.5, ease: 'expo.out'}, t);
  if (k % 2 === 0) F.cue('tick', t, {i: k / 2, soft: true});
});
tl.to(cursor, {opacity: 0, duration: 0.3}, b(44));

// ------------------------------------------------------------------ the app's own state, as a function of time
F.onFrame((t) => {
  let left = 0;
  rows.forEach((r, i) => { const on = t < land[i] - FLY; r.style.visibility = on ? 'visible' : 'hidden'; left += on && t >= listed[i]; });
  blocks.forEach((el, i) => { el.style.visibility = t >= land[i] - FLY ? 'visible' : 'hidden'; });
  $('#count').textContent = left;
  $('#goLabel').textContent = t < b(14) ? 'Place my day' : t < placed ? 'Placing…' : 'Day placed';
  $('#go').style.background = t < placed ? '' : '#f3f2ef';
  $('#go').style.color = t < placed ? '' : '#0d0d0c';
  S.querySelector('small').textContent = t < DROP ? span(11, 0.5) : span(SAM_TO, 0.5);
  $('#weekBtn').classList.toggle('on', t >= WK + 0.2);
  $('#dayBtn').classList.toggle('on', t < WK + 0.2);
});

// ------------------------------------------------------------------ type: lines on the downbeat
// the dot: it ends the line, then drops into the app and becomes now (measured before the words are set to rise)
const fly = $('#flydot');
const stopBox = (() => { const r = $('#openStop').getBoundingClientRect(), s = document.querySelector('[data-stage]').getBoundingClientRect(); return {x: r.left - s.left + r.width / 2, y: r.top - s.top + r.height / 2 + 0, d: r.width}; })();
const restY = stopBox.y;
$('#openStop').style.visibility = 'hidden';
const rise = (sub, sel, t0, step = E) => sub.fromTo(sel, {yPercent: 110}, {yPercent: 0, duration: 0.9, ease: 'expo.out', stagger: step}, t0);
F.scene('open', {start: 0, end: b(9), kind: 'type', words: 'Nine things. One day.'}, (sub, el) => {
  const w = el.querySelectorAll('.w');
  rise(sub, [w[0], w[1]], b(1.5) - 0.1);
  rise(sub, [w[2], w[3]], b(3) - 0.1);
  sub.to(w, {yPercent: -160, duration: 0.42, ease: 'power3.in', stagger: 0.035}, b(6.5));
});
F.cue('land', b(1.5)).cue('land', b(2)).cue('land', b(3)).cue('land', b(3.5));

const REVEAL = REVEAL_AT;
const nowAt = cam.project(REVEAL, WIN.x + COL.x, WIN.y + hourY(8.6) + 1);
gsap.set(fly, {width: stopBox.d, height: stopBox.d, x: stopBox.x - stopBox.d / 2, y: restY - stopBox.d / 2, scale: 0});
// the film opens on the dot alone, sitting on the first hour line: now. It moves to end the line as "day" lands.
const DOT0 = {x: 330 + stopBox.d / 2, y: 276};
gsap.set(fly, {x: DOT0.x - stopBox.d / 2, y: DOT0.y - stopBox.d / 2});
tl.set(fly, {visibility: 'visible'}, 0.15);
tl.to(fly, {scale: 1, duration: 0.6, ease: 'expo.out'}, 0.25);
F.cue('dot', 0.25);
tl.to(fly, {x: stopBox.x - stopBox.d / 2, duration: b(1.1), ease: 'power3.inOut'}, b(2.9));
tl.to(fly, {y: restY - stopBox.d / 2, duration: b(1.1), ease: 'power2.inOut'}, b(2.9));
F.cue('land', b(4));
const nowD = 14 * nowAt.zoom;
tl.to(fly, {x: nowAt.x - stopBox.d / 2, duration: REVEAL - b(6.7), ease: 'power3.inOut'}, b(6.7));
tl.to(fly, {y: nowAt.y - stopBox.d / 2, duration: REVEAL - b(6.7), ease: 'power2.inOut'}, b(6.7));
tl.to(fly, {scale: nowD / stopBox.d, duration: REVEAL - b(6.7), ease: 'power2.inOut'}, b(6.7));
tl.set(fly, {visibility: 'hidden'}, REVEAL + 0.25);
F.cue('whoosh', b(6.7), {len: REVEAL - b(6.7)});
// the app opens out of the dot
const lens = $('#lens');
const R = Math.hypot(1920, 1080);
const irisEase = gsap.parseEase('power3.inOut');
F.onFrame((t) => { const p = Math.min(1, Math.max(0, (t - REVEAL + 0.12) / 1.1)); lens.style.clipPath = p >= 1 ? 'none' : `circle(${R * irisEase(p)}px at ${nowAt.x}px ${nowAt.y}px)`; lens.style.visibility = p > 0 ? 'visible' : 'hidden'; });
F.cue('open', REVEAL);

F.scene('place', {start: b(9), end: b(24), kind: 'product', energy: 0.6, cut: false});
F.scene('change', {start: b(24), end: b(28), kind: 'type', words: 'Plans change.'}, (sub, el) => rise(sub, el.querySelectorAll('.w'), b(0.5) - 0.1));
F.cue('hit', b(24)).cue('land', b(24.5)).cue('land', b(25));
F.scene('move', {start: b(28), end: b(38), kind: 'product', energy: 0.7});
F.scene('week', {start: b(38), end: b(48), kind: 'product', energy: 0.85, cut: false});

// the name: the word rises on the downbeat and its dot lands on the next beat, then the line
const END = b(58);
F.scene('mark', {start: b(48), end: END, kind: 'logo', words: 'Dayline'}, (sub, el) => {
  sub.fromTo(el.querySelector('.word .w'), {yPercent: 110}, {yPercent: 0, duration: 1.1, ease: 'expo.out'}, -0.06);
  sub.fromTo(el.querySelector('.tag .w'), {yPercent: 110}, {yPercent: 0, duration: 1.0, ease: 'expo.out'}, b(3) - 0.1);
});
F.cue('resolve', b(48));
F.cue('dot', b(49.5));
F.cue('land', b(51));
const markStop = $('#markStop');
const ms = (() => { const r = markStop.getBoundingClientRect(), s = document.querySelector('[data-stage]').getBoundingClientRect(); return {x: r.left - s.left + r.width / 2, y: r.top - s.top + r.height / 2, d: r.width}; })();
const mdot = fly.cloneNode(); mdot.id = 'markDot'; document.querySelector('[data-stage]').append(mdot);
gsap.set(mdot, {width: ms.d, height: ms.d, x: ms.x - ms.d / 2, y: ms.y - ms.d / 2, visibility: 'hidden'});
tl.set(mdot, {visibility: 'visible'}, b(48));
tl.fromTo(mdot, {scale: 0}, {scale: 1, duration: 0.6, ease: 'expo.out'}, b(49.5) - 0.12);
// the day's line comes in and stops where the dot lands: the name is a day and a line
const line = $('#markLine');
gsap.set(line, {top: ms.y - 2});
tl.fromTo(line, {left: 1920}, {left: ms.x, duration: 1.5, ease: 'expo.inOut'}, b(48) + 0.05); // in from the right, never across the word

// blur only where things move fast; a zoom smears text more than a pan, so the pushes and pulls get the most samples
F.blur(b(6.6), b(9.2), 8);
F.blur(b(10), b(13.4), 10);
F.blur(b(13.4), b(18.4), 14);
F.blur(b(30.4), b(33.4), 8);
F.blur(b(33.4), b(36.2), 10);
F.blur(b(39.6), b(44), 8);

F.music({key: 'D', composed: 'films/dayline/score.py'}); // the score is written for this cut, on tools/synth.py
F.end(END);
await F.ready();
