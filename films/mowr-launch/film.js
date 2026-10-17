// Mowr · "One quiet place"
// The one idea: everything you're working on, scattered, settles into one quiet place.
// The film's own move is the landing: things drift, stop, and settle into where they belong.
// It recurs at every scale (the pile, files into a subject, a flashcard deck, a report,
// path segments) and ends with four sheets landing as the four petals of Mowr's mark.
import {film, seeded, split} from 'slate';
import {MorphSVGPlugin} from 'gsap/MorphSVGPlugin.js';
import * as THREE from 'three';

const F = film({fps: 30, width: 1920, height: 1080, bpm: 84, title: 'Mowr · One quiet place'});
const {gsap, tl, b} = F;
gsap.registerPlugin(MorphSVGPlugin);
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

F.notes({
  idea: 'Everything you work on, scattered, settles into one quiet place.',
  motif: 'the landing: drift, stop, settle',
  rejected: ['a typed prompt that pulls back (a reference move)', 'a montage of abstract materials (a reference move)', 'feature list over screenshots with no idea'],
});
F.music({key: 'Eb', style: 'felt', arc: [[0, 0.15], [b(6), 0.35], [b(11.4), 0.6], [b(11.5), 0], [b(12), 0.2], [b(20), 0.35], [b(26), 0.45], [b(34), 0.65], [b(50), 0.75], [b(62), 0.5], [b(64), 0.25], [b(73.5), 0]]});
F.post({grain: 5, vignette: 0.35, blur: 4, shutter: 0.5});

// ------------------------------------------------------------ type: words land
function landWords(tl, el, at, {stagger = 0.08, from = -34} = {}) {
  const words = split(el, 'words');
  tl.fromTo(words, {y: from, opacity: 0, filter: 'blur(12px)'}, {y: 0, opacity: 1, filter: 'blur(0px)', duration: 1.0, stagger, ease: 'power3.out'}, at);
  return words;
}
function leave(tl, targets, at, d = 0.35) {
  tl.to(targets, {opacity: 0, y: 12, filter: 'blur(8px)', duration: d, ease: 'power2.in', stagger: 0.02}, at);
}

// ================================================================ 1. the pile
const space = $('#space');
const r = seeded(7);
const NAMES = ['Osmosis lab handout.pdf', 'lecture 07 FINAL.pptx', 'notes (3).docx', 'Cell biology worksheet.pdf', 'Untitled document', 'reading list.xlsx',
  'essay draft v4.docx', 'Biology 101 syllabus.txt', 'flashcards-old.csv', 'midterm topics.txt', 'Krebs cycle??', 'IMG_2041.jpg', 'meeting notes', 'screenshot 14.png',
  'chapter 5 summary', 'lab data.xlsx', 'citations.bib', 'to read later'];
const TABS = ['New tab', 'Chat: osmosis question', 'Untitled - Google search', 'lecture 07 (1).pdf', 'Chat: summarize this', 'Downloads', 'Inbox (214)', 'Chat: make flashcards'];
const NOTES = ['exam Oct 29!!', 'ask about lab 3', 'Krebs = ?', 'redo graph'];
const KEYS = ['#d87968', '#8a877e', '#6f8fb8', '#a8b07a', '#b58cb8'];

const N = 46;
const items = [];
for (let i = 0; i < N; i++) {
  const kind = i % 7 === 3 ? 'note' : i % 4 === 1 ? 'tab' : 'sheet';
  const el = document.createElement('div');
  el.className = kind;
  el.style.setProperty('--k', KEYS[i % KEYS.length]);
  if (kind === 'sheet') {
    const lines = Array.from({length: 13}, (_, j) => `<div class="ln${r() < 0.08 ? ' hl' : ''}" style="width:${j === 12 ? 40 : 62 + r() * 38}%"></div>`).join('');
    el.innerHTML = `<div class="fn">${NAMES[i % NAMES.length]}</div>${r() < 0.5 ? `<h5>${['Chapter 5', 'Osmosis', 'Week 7', 'Draft', 'Results'][i % 5]}</h5>` : ''}${lines}<div class="shade"></div>`;
  } else if (kind === 'tab') {
    el.innerHTML = `${TABS[i % TABS.length]}<span class="x">✕</span>`;
  } else {
    el.textContent = NOTES[i % NOTES.length];
  }
  space.append(el);
  // drift: start deep, come toward the camera, never pass it
  const vz = 55 + r() * 70;
  const z0 = -3400 + r() * 2900;
  items.push({el, kind,
    p0: [(r() - 0.5) * 3000, (r() - 0.5) * 1700, Math.min(z0, 820 - vz * 11.6)],
    v: [(r() - 0.5) * 40, (r() - 0.5) * 30, vz],
    rot0: [(r() - 0.5) * 70, (r() - 0.5) * 80, (r() - 0.5) * 120],
    vr: [(r() - 0.5) * 10, (r() - 0.5) * 12, (r() - 0.5) * 9],
    rest: [(r() - 0.5) * 70, 30 + (r() - 0.5) * 50, 0, (r() - 0.5) * (kind === 'tab' ? 30 : 22)],
  });
}
// keep the title readable: sheets that would sit behind it at b(5) move out of its band
for (const it of items) {
  const s5 = b(5), z = it.p0[2] + it.v[2] * s5, k = 1300 / (1300 - z);
  const sx = (it.p0[0] + it.v[0] * s5) * k, sy = (it.p0[1] + it.v[1] * s5) * k;
  if (Math.abs(sy) < 260 && Math.abs(sx) < 800 && z > -2600) it.p0[1] += (sy < 0 ? -1 : 1) * (300 - Math.abs(sy)) / k + (sy < 0 ? -1 : 1) * 120;
}
// Mowr lands last, straight, on top
const mowr = document.createElement('div');
mowr.className = 'mowrcard';
mowr.innerHTML = '<img src="assets/home.png" alt="">';
space.append(mowr);

const T_FREEZE = b(11.5), T_SETTLE = b(12), T_SETTLED = b(16.6), T_MOWR = b(17.5), T_PUSH = b(20), T_HOME = b(22);
const PILE_Z = -950;
// time as the drifting sheets feel it: steady, then hurrying, then stopped dead
function drift(t) {
  const t0 = b(5), t1 = T_FREEZE;
  if (t <= t0) return t;
  const u = Math.min(t, t1) - t0, L = t1 - t0;
  return t0 + u + 1.6 * (u * u * u) / (3 * L * L); // speed rises 1 -> 2.6
}
const ease = {inOut: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2), out: (x) => 1 - Math.pow(1 - x, 3), outBack: (x) => 1 + 2.2 * Math.pow(x - 1, 3) + 1.2 * Math.pow(x - 1, 2)};
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const lerp = (a, b2, u) => a + (b2 - a) * u;
const dof = (z, focus = -400) => Math.min(16, Math.abs(z - focus) / 170);

// landing order: nearest first (they are already close), deep ones last
const order = items.map((it, i) => i).sort((a, c) => (items[c].p0[2] + items[c].v[2] * 12) - (items[a].p0[2] + items[a].v[2] * 12));
order.forEach((idx, k) => {
  const it = items[idx];
  it.land = T_SETTLE + 0.1 + (k / (N - 1)) * (T_SETTLED - T_SETTLE - 0.75);
  it.layer = k;
  F.cue('land', it.land + 0.72, {i: k, n: N, soft: true});
});
F.cue('land', T_MOWR + 0.85, {i: N, n: N, soft: false});

F.scene('pile', {start: 0, end: T_HOME, energy: 0.3, kind: 'world'}, () => {});
F.onFrame((t) => {
  if (t >= T_HOME) return;
  const s = drift(t);
  const push = clamp01((t - T_PUSH) / (T_HOME - T_PUSH));
  const pe = ease.inOut(push);
  for (const it of items) {
    let x = it.p0[0] + it.v[0] * s, y = it.p0[1] + it.v[1] * s, z = it.p0[2] + it.v[2] * s;
    let rx = it.rot0[0] + it.vr[0] * s, ry = it.rot0[1] + it.vr[1] * s, rz = it.rot0[2] + it.vr[2] * s;
    const u = clamp01((t - it.land) / 0.85);
    if (u > 0) {
      const e = ease.inOut(u);
      // arc: lift toward the camera mid-flight, then settle down onto the pile
      const lift = Math.sin(Math.PI * u) * 260;
      x = lerp(x, it.rest[0], e); y = lerp(y, it.rest[1] - it.layer * 0.9, e); z = lerp(z, PILE_Z + it.layer * 0.8, e) + lift;
      rx = lerp(rx, 0, e); ry = lerp(ry, 0, e); rz = lerp(rz, it.rest[3], e);
    }
    // the camera push into Mowr sends the pile past the lens
    z += pe * 2400; y += pe * 200;
    const blur = u >= 1 && push === 0 ? 0 : dof(z, u > 0 ? PILE_Z : -400);
    it.el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,${z.toFixed(1)}px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) rotateZ(${rz.toFixed(2)}deg)`;
    it.el.style.filter = blur > 0.3 ? `blur(${blur.toFixed(1)}px)` : 'none';
    it.el.style.opacity = String(clamp01(1 - pe * 1.4) * clamp01((z + 3600) / 600));
  }
  // Mowr: from above the frame onto the pile, then grows into the app window
  const um = clamp01((t - T_MOWR) / 0.95);
  const em = ease.inOut(um);
  let w = 300, h = 400, x = 0, y = lerp(-1400, 20, em), z = lerp(400, PILE_Z + N + 2, em) + Math.sin(Math.PI * um) * 200, rz = lerp(-8, 0, em);
  if (push > 0) { w = lerp(300, 1600, pe); h = lerp(400, 1000, pe); y = lerp(20, 0, pe); z = lerp(PILE_Z + N + 2, 0, pe); }
  mowr.style.width = w + 'px'; mowr.style.height = h + 'px'; mowr.style.margin = `${-h / 2}px 0 0 ${-w / 2}px`;
  mowr.style.borderRadius = lerp(8, 14, pe) + 'px';
  mowr.firstChild.style.objectPosition = `${lerp(60, 50, pe)}% ${lerp(40, 50, pe)}%`;
  mowr.style.transform = `translate3d(${x}px,${y.toFixed(1)}px,${z.toFixed(1)}px) rotateZ(${rz.toFixed(2)}deg)`;
  mowr.style.opacity = t < T_MOWR ? '0' : '1';
});
for (let k = 0; k < 7; k++) F.cue('rustle', b(1 + k * 1.5), {len: 1.2});
F.cue('swell', b(7), {len: b(4.5)});
F.cue('drop', T_FREEZE);
F.cue('thud', T_SETTLE, {soft: true});

F.scene('everywhere', {start: b(2), end: b(10.5), energy: 0.3, kind: 'type', words: 'Your work is everywhere.', cut: false}, (tl, el) => {
  const ws = landWords(tl, $('h1', el), 0.05, {stagger: 0.14});
  leave(tl, ws, b(8) - 0.4);
});
F.scene('quiet', {start: b(15.5), end: T_PUSH + 0.6, energy: 0.3, kind: 'type', words: 'Give it one quiet place.', cut: false}, (tl, el) => {
  const ws = landWords(tl, $('h1', el), 0.0, {stagger: 0.1});
  leave(tl, ws, T_PUSH - b(15.5) + 0.05, 0.4);
});
// fade up from black
gsap.set('#fade', {opacity: 1});
tl.to('#fade', {opacity: 0, duration: b(2.5), ease: 'power1.inOut'}, 0);

// ================================================================ 2. Mowr
F.scene('home', {start: T_HOME, end: b(26), energy: 0.4, kind: 'product', cut: false}, (tl, el) => {
  // a slow push toward the greeting (960,436 in the window)
  tl.fromTo('#w-home', {scale: 1, x: 0, y: 0}, {scale: 1.32, x: 0, y: 60, duration: b(4), ease: 'power1.inOut'}, 0);
});

F.scene('subject', {start: b(26), end: b(34), energy: 0.5, kind: 'product', words: 'Subjects keep it all together.'}, (tl, el) => {
  const win = $('#w-subject');
  // move the incoming files into the window so they ride its camera move
  const inc = $('#incoming'); win.append(inc);
  Object.assign(inc.style, {position: 'absolute', inset: '0'});
  // the camera eases toward Recent files (x 968-1380, y 560-680 in the window)
  tl.fromTo(win, {scale: 1.04, x: 40, y: 30}, {scale: 1.42, x: -330, y: -200, duration: b(5), ease: 'power2.inOut'}, b(0.5));
  const files = [['Osmosis lab handout.pdf', 576], ['Cell biology worksheet.pdf', 620], ['Biology 101 syllabus.txt', 664]];
  files.forEach(([name, y], i) => {
    const cover = document.createElement('div');
    Object.assign(cover.style, {left: '990px', top: (y - 15) + 'px', width: '370px', height: '32px', background: 'rgb(23,23,22)'});
    const chip = document.createElement('div');
    chip.className = 'filechip' + (name.endsWith('.txt') ? ' txt' : '');
    chip.textContent = name;
    inc.append(cover, chip);
    const at = b(2.4 + i * 0.9);
    tl.fromTo(chip, {x: -700 - i * 120, y: 200 + i * 260, rotation: -24 + i * 14, scale: 1.25, opacity: 1},
      {x: 1010, y: y - 32, rotation: 0, scale: 0.78, duration: 0.95, ease: 'power3.inOut'}, at);
    tl.to(chip, {opacity: 0, duration: 0.35}, at + 0.95);
    tl.to(cover, {opacity: 0, duration: 0.35}, at + 0.95);
    F.cue('land', b(26) + at + 0.92, {i: 20 + i * 8, n: N});
    F.cue('whoosh', b(26) + at + 0.1, {len: 0.7});
  });
  const ws = landWords(tl, $('#c-subject'), b(5));
});

// ================================================================ 3. features
function copyIn(tl, el) {
  const h = $('h2', el), p = $('p', el);
  const ws = landWords(tl, h, 0.12, {stagger: 0.07});
  tl.fromTo(p, {opacity: 0, y: -14}, {opacity: 1, y: 0, duration: 0.8}, 0.55);
  return [...ws, p];
}

F.scene('study', {start: b(34), end: b(38), energy: 0.65, kind: 'product', words: 'Study that sticks.'}, (tl, el) => {
  copyIn(tl, el);
  tl.fromTo('#deck', {y: -520, rotationX: 38, rotationZ: -6, opacity: 0}, {y: 0, rotationX: 8, rotationZ: 0, opacity: 1, duration: 0.9, ease: 'power3.out'}, 0);
  tl.to('#deck', {rotationX: 0, duration: b(4), ease: 'sine.out'}, 0.9);
  tl.fromTo('#flip', {rotationY: 0}, {rotationY: 180, duration: 0.75, ease: 'power3.inOut'}, b(1.9));
  tl.fromTo('.grade .on', {scale: 1}, {scale: 0.94, duration: 0.08, yoyo: true, repeat: 1}, b(3.1));
  F.cue('land', b(34) + 0.55, {i: 30, n: N}).cue('flip', b(34) + b(1.9)).cue('click', b(37.1));
});

F.scene('answers', {start: b(38), end: b(42), energy: 0.65, kind: 'product', words: 'Answers you can check.'}, (tl, el) => {
  copyIn(tl, el);
  // the answer and its actions row, slowly drifting closer
  tl.fromTo('#crop-chat img', {scale: 1.3, x: -715, y: -30}, {scale: 1.34, x: -742, y: -70, duration: b(4), ease: 'power1.inOut'}, 0);
  tl.fromTo('#crop-chat', {y: -60, opacity: 0}, {y: 0, opacity: 1, duration: 0.8}, 0);
  tl.fromTo('#cite', {y: -260, rotation: -5, opacity: 0}, {y: 0, rotation: 0, opacity: 1, duration: 0.85, ease: 'power3.out'}, b(1.6));
  F.cue('click', b(38) + b(1.45)).cue('land', b(38) + b(1.6) + 0.5, {i: 34, n: N});
});

F.scene('documents', {start: b(42), end: b(46), energy: 0.7, kind: 'product', words: 'Real documents.'}, (tl, el) => {
  copyIn(tl, el);
  tl.fromTo('#doc', {y: -1100, rotationX: -28, rotationZ: 4}, {y: 0, rotationX: 0, rotationZ: -1.5, duration: 1.0, ease: 'power3.out'}, 0);
  tl.to('#doc', {y: -120, duration: b(4), ease: 'none'}, 1.0);
  $$('.chip', el).forEach((c, i) => {
    tl.fromTo(c, {x: -240, opacity: 0, rotation: -12}, {x: 0, opacity: 1, rotation: [-3, 2, -2][i], duration: 0.6, ease: 'back.out(1.4)'}, b(1.5 + i * 0.5));
    F.cue('land', b(42) + b(1.5 + i * 0.5) + 0.3, {i: 36 + i * 2, n: N});
  });
  F.cue('thud', b(42) + 0.7, {soft: true});
});

// a real surface, like the ones Mowr's Visuals draw
const gl = new THREE.WebGLRenderer({canvas: $('#gl'), antialias: true, alpha: true, preserveDrawingBuffer: true});
gl.setPixelRatio(1);
gl.setSize(1100, 860, false);
const scene3 = new THREE.Scene();
const cam = new THREE.PerspectiveCamera(32, 1100 / 860, 0.1, 100);
const f = (x, y) => (x * x + y * y) * 0.55;
const geo = new THREE.PlaneGeometry(2.6, 2.6, 90, 90);
const pos = geo.attributes.position;
const cols = [];
const lo = new THREE.Color('#4b5bb8'), hi = new THREE.Color('#d87968');
for (let i = 0; i < pos.count; i++) {
  const x = pos.getX(i), y = pos.getY(i), z = f(x, y);
  pos.setZ(i, z);
  const c = lo.clone().lerp(hi, Math.min(1, z / 1.5));
  cols.push(c.r, c.g, c.b);
}
geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
geo.computeVertexNormals();
const surf = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({vertexColors: true, roughness: 0.55, metalness: 0.05, side: THREE.DoubleSide, transparent: true, opacity: 0.93}));
const wire = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.PlaneGeometry(2.6, 2.6, 18, 18).applyMatrix4(new THREE.Matrix4())), new THREE.LineBasicMaterial({color: '#f0efeb', transparent: true, opacity: 0.12}));
{ const wp = wire.geometry.attributes.position; for (let i = 0; i < wp.count; i++) wp.setZ(i, f(wp.getX(i), wp.getY(i)) + 0.004); }
const group = new THREE.Group();
group.add(surf, wire);
// the curve where y is held fixed, and the point riding it
const curvePts = [];
for (let k = 0; k <= 80; k++) { const x = -1.3 + 2.6 * k / 80; curvePts.push(new THREE.Vector3(x, 0.5, f(x, 0.5) + 0.01)); }
const curve = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(curvePts), 120, 0.012, 8), new THREE.MeshBasicMaterial({color: '#f0efeb'}));
const dot = new THREE.Mesh(new THREE.SphereGeometry(0.045, 24, 16), new THREE.MeshBasicMaterial({color: '#ffffff'}));
const tangent = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 1.1, 8), new THREE.MeshBasicMaterial({color: '#d87968'}));
group.add(curve, dot, tangent);
// floor grid
const grid = new THREE.GridHelper(3.2, 16, '#3a3a36', '#2a2a27');
grid.rotation.x = Math.PI / 2; grid.position.z = -0.02;
group.add(grid);
group.rotation.x = -Math.PI / 2;
scene3.add(group);
scene3.add(new THREE.HemisphereLight('#fff4ea', '#1a1a2a', 1.6));
const key = new THREE.DirectionalLight('#ffffff', 1.6); key.position.set(2, 4, 3); scene3.add(key);
const slope = $('#slope');

F.scene('visuals', {start: b(46), end: b(50), energy: 0.75, kind: 'product', words: 'See it move.'}, (tl, el) => {
  copyIn(tl, el);
  tl.fromTo('.plot', {y: -300, opacity: 0}, {y: 0, opacity: 1, duration: 0.9, ease: 'power3.out'}, 0);
  F.cue('land', b(46) + 0.5, {i: 40, n: N}).cue('glint', b(47));
});
F.onFrame((t) => {
  const t0 = b(46), t1 = b(50);
  if (t < t0 - 0.1 || t > t1 + 0.1) return;
  const u = (t - t0) / (t1 - t0);
  const ang = -0.9 + u * 1.1;
  cam.position.set(Math.sin(ang) * 6.2, 3.4 - u * 0.4, Math.cos(ang) * 6.2);
  cam.lookAt(0, 0.45, 0);
  // the point sweeps along x; the tangent shows the slope 2x... scaled to this surface (1.1x)
  const px = Math.sin(u * Math.PI * 1.2 - 0.6) * 1.0;
  const pz = f(px, 0.5);
  dot.position.set(px, 0.5, pz + 0.02);
  const m = 2 * 0.55 * px;
  tangent.position.copy(dot.position);
  tangent.rotation.set(0, 0, 0);
  tangent.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(1, 0, m).normalize());
  slope.textContent = (2 * px).toFixed(2);
  gl.render(scene3, cam);
});

// ================================================================ 4. values
F.scene('local', {start: b(50), end: b(54.5), energy: 0.7, kind: 'type', words: 'Yours, on your PC. Documents Mowr Biology 101'}, (tl, el) => {
  landWords(tl, $('h2', el), 0.0, {stagger: 0.08});
  const segs = $$('#path > *');
  tl.fromTo(segs, {y: -40, opacity: 0}, {y: 0, opacity: 1, duration: 0.55, stagger: b(0.25), ease: 'power3.out'}, b(0.75));
  segs.filter((s) => s.tagName === 'SPAN').forEach((s, i) => F.cue('tick', b(50.75 + i * 0.5) + 0.25, {i}));
});
F.scene('byo', {start: b(54.5), end: b(59.5), energy: 0.7, kind: 'type', words: 'Bring the AI plan you already pay for.'}, (tl, el) => {
  landWords(tl, $('h2', el), 0.0, {stagger: 0.06});
  tl.fromTo($('.sub', el), {opacity: 0, y: -12}, {opacity: 1, y: 0, duration: 0.7}, b(1.2));
});
F.scene('free', {start: b(59.5), end: b(62.5), energy: 0.65, kind: 'type', words: 'Free and open source.'}, (tl, el) => {
  landWords(tl, $('h2', el), 0.0, {stagger: 0.07});
});

// ================================================================ 5. the mark
const PETAL = 'M64 11 C87 4 104 20 103 42 C103 57 94 70 84 72 C78 73 79 65 81 61 C85 48 75 43 65 48 C55 52 49 43 49 31 C49 22 54 15 64 11Z';
F.scene('logo', {start: b(62.5), end: b(73.5), energy: 0.3, kind: 'logo', words: 'mowr Your space to think.'}, (tl, el) => {
  const petals = $$('.petal', el);
  const from = [[-620, -420], [640, -380], [600, 420], [-640, 400]];
  // the brand block starts centered on the mark; the wordmark arrives after
  tl.set('.brand', {x: 120}, 0);
  $$('.fly', el).forEach((p, i) => {
    gsap.set(p, {svgOrigin: '72 72'});
    tl.fromTo(p, {x: from[i][0] / 1.17, y: from[i][1] / 1.17, rotation: -60 + i * 40, scale: 2.6},
      {x: 0, y: 0, rotation: 0, scale: 1, duration: 1.15, ease: 'power3.inOut'}, i * 0.12);
  });
  // sheets become petals
  tl.to(petals, {morphSVG: {shape: PETAL}, duration: 0.8, ease: 'power2.inOut', stagger: 0.04}, 1.15 + 0.36);
  tl.fromTo('#mark', {rotation: -45, scale: 1.15}, {rotation: 0, scale: 1, duration: 1.4, ease: 'power3.out'}, 1.4);
  tl.fromTo('#word', {opacity: 0, x: -30, filter: 'blur(10px)'}, {opacity: 1, x: 0, filter: 'blur(0px)', duration: 1.0, ease: 'power3.out'}, b(3));
  tl.to('.brand', {x: 0, duration: 1.0, ease: 'power3.inOut'}, b(3) - 0.2);
  landWords(tl, $('#tagline'), b(4.5), {stagger: 0.1});
  tl.fromTo('#foot', {opacity: 0}, {opacity: 1, duration: 1}, b(6.5));
  tl.to('#fade', {opacity: 1, duration: 0.9, ease: 'power1.in'}, b(11) - 0.9);
  F.cue('whoosh', b(62.5) + 0.2, {len: 1.0});
  F.cue('resolve', b(62.5) + 1.2);
});

F.end(b(73.5));
await F.ready();
