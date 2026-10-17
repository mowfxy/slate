// Slate runtime: the small contract between a film page and the renderer.
//
// A film is a web page. It builds one paused GSAP timeline (F.tl), declares
// scenes and sound cues in seconds or beats, and calls F.ready(). The renderer
// (engine/render.mjs) then calls window.__slate.seek(t) for every frame and
// screenshots the page, so anything you can draw in a browser can be filmed:
// CSS 3D, SVG, canvas, WebGL, video, real fonts, blend modes, filters.
//
// Opened directly in a browser (through `node engine/serve.mjs`), the same page
// plays in real time with a scrubber: that is the preview.
import gsap from 'gsap';

const params = new URLSearchParams(location.search);

export function film({fps = 30, width = 1920, height = 1080, bpm = 120, title = document.title} = {}) {
  const beat = 60 / bpm;
  const tl = gsap.timeline({paused: true, defaults: {ease: 'power3.out'}});
  const scenes = [];
  const events = [];
  const frameHooks = [];
  const waits = [];
  const typers = [];
  let duration = null;
  let music = null; // no default sound: every film chooses its own (see skills/sound-design)
  let post = {grain: 0, vignette: 0, blur: 1, shutter: 0.5};
  let notes = {};
  const missing = [];

  const stage = document.querySelector('[data-stage]') || document.body;
  Object.assign(stage.style, {width: width + 'px', height: height + 'px', position: 'relative', overflow: 'hidden'});

  const F = {
    gsap, tl, fps, width, height, bpm, beat, title,

    /** Seconds at beat n (beats count from 0). */
    b: (n) => n * beat,
    /** Seconds at bar n (4/4). */
    bar: (n) => n * beat * 4,
    /** Snap a time to the nearest 1/div beat. */
    snap: (t, div = 4) => Math.round(t / (beat / div)) * (beat / div),

    /**
     * Declare a scene: a [data-scene=name] element that is visible from start to end.
     * kind: 'type' (words on screen), 'product' (UI), 'logo', 'world' (anything else).
     * energy 0..1 shapes the score. words: what must be readable while it is up.
     * build(tl, el, s) adds the scene's animation; tl starts at the scene's start.
     */
    scene(name, {start, end, energy = 0.5, kind = 'world', words = '', cut = true}, build) {
      const el = document.querySelector(`[data-scene="${name}"]`);
      if (!el) throw new Error(`no [data-scene="${name}"] in the page`);
      el.style.visibility = 'hidden';
      const s = {name, start, end, energy, kind, words: String(words).trim(), el};
      scenes.push(s);
      if (cut) events.push({type: 'cut', t: start, scene: name});
      if (build) {
        const sub = gsap.timeline();
        build(sub, el, s);
        tl.add(sub, start);
      }
      return s;
    },

    /** Sound cue at time t. Types the scorer knows: key, click, pop, whoosh, swell, hit, drop, resolve, tick, glint, thud. */
    cue(type, t, extra = {}) { events.push({type, t, ...extra}); return F; },

    /**
     * Type text into an element one character at a time (one key cue per character).
     * Returns the time the last character lands. Human rhythm: small deterministic jitter, pauses after spaces.
     */
    type(el, text, {at, cps = 18, caret = null, sound = true} = {}) {
      let t = at;
      const r = seeded(hash(text));
      const times = [];
      for (let i = 1; i <= text.length; i++) {
        const ch = text[i - 1];
        t += (1 / cps) * (0.7 + 0.6 * r()) * (ch === ' ' ? 1.4 : 1);
        times.push(t);
        if (sound && ch !== ' ') events.push({type: 'key', t});
      }
      typers.push({el, text, times});
      if (caret) tl.fromTo(caret, {opacity: 1}, {opacity: 0, duration: 0.01, repeat: Math.ceil((t - at + 1.2) / 0.53), yoyo: true, repeatDelay: 0.52}, at);
      return t;
    },

    /** Run fn(t, F) on every rendered frame (canvas, WebGL, anything not driven by the timeline). May return a promise. */
    onFrame(fn) { frameHooks.push(fn); return F; },

    /**
     * Load a recorded clip's sidecar (footage/<name>.json, written by engine/record.mjs): its duration,
     * the times of its key presses and clicks, its marks and rects. Use it to put sounds and moves on the
     * footage's own events: F.cueClip(clip, at) does the sounds.
     */
    async footage(name, dir = 'footage') {
      const res = await fetch(`${dir}/${name}.json`);
      if (!res.ok) throw new Error(`no footage sidecar ${dir}/${name}.json: record it with engine/record.mjs`);
      return {name, src: `${dir}/${name}.webm`, ...(await res.json())};
    },

    /** Add a clip's key and click sounds, for the part of it that plays from film time `at` (clip time `from`, at `rate`). */
    cueClip(clip, at, {from = 0, to = clip.duration, rate = 1, gain = 1} = {}) {
      for (const e of clip.events) if (e.t >= from && e.t < to) events.push({type: e.type, t: at + (e.t - from) / rate, gain});
      return F;
    },

    /** Hold the first frame until this promise settles (textures, video metadata). */
    wait(promise) { waits.push(promise); return F; },

    /** Score settings: key, style (see tools/score.py), plus anything the scorer understands. */
    music(m) { music = {...(music || {}), ...m}; return F; },

    /** Finishing: grain (0..20), vignette (0..1), blur (subframes per frame, 1 = off), shutter (0..1 of a frame). */
    post(p) { post = {...post, ...p}; return F; },

    /** Director's notes stored in the manifest (the one idea, the concept, what was rejected). */
    notes(n) { notes = {...notes, ...n}; return F; },

    end(t) { duration = t; return F; },

    manifest() {
      const dur = duration ?? tl.duration();
      return {
        title, fps, width, height, bpm, duration: dur, ...music && {key: music.key, musicStyle: music.style, music},
        post, notes, ...(missing.length && {missing}),
        scenes: scenes.map(({el, ...s}) => s).sort((a, b) => a.start - b.start),
        events: events.filter((e) => e.t <= dur + 1e-6).sort((a, b) => a.t - b.t),
      };
    },

    async seek(t) {
      for (const s of scenes) s.el.style.visibility = s.start <= t + 1e-6 && t < s.end - 1e-6 ? 'visible' : 'hidden';
      tl.totalTime(Math.min(t, tl.totalDuration()), false);
      for (const a of document.getAnimations()) { a.pause(); a.currentTime = t * 1000; }
      for (const {el, text, times} of typers) { let n = 0; while (n < times.length && times[n] <= t + 1e-6) n++; if (el.textContent !== text.slice(0, n)) el.textContent = text.slice(0, n); }
      const vids = [...document.querySelectorAll('video[data-at]')];
      const shown = vids.filter(onScreen);
      await Promise.all(shown.map((v) => seekVideo(v, clipTime(v, t))));
      // a video that has just come on screen gets an extra paint, so its first frame is never blank
      if (shown.some((v) => !v.__shown)) await frames(2);
      for (const v of vids) v.__shown = shown.includes(v);
      for (const fn of frameHooks) await fn(t, F);
      await frames(2);
    },

    /**
     * Check the layout of the current frame: every visible piece of text must sit inside the title-safe
     * area, stay whole, keep off pictures (img, video, canvas) and off other text. Mark deliberate
     * exceptions in the page: data-over (text may sit on a picture, which must then be darkened under it),
     * data-audit="off" (labels inside a mock UI). Returns a list of problems; empty is good.
     */
    audit({safe = 0.06, min = 18} = {}) {
      const box = stage.getBoundingClientRect();
      const k = box.width / width;
      const toStage = (r) => ({x: (r.left - box.left) / k, y: (r.top - box.top) / k, w: r.width / k, h: r.height / k});
      const alpha = (el) => { let a = 1; for (let e = el; e && e !== document.documentElement; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.visibility === 'hidden' || cs.display === 'none') return 0; a *= parseFloat(cs.opacity); } return a; };
      const area = (r) => Math.max(0, r.w) * Math.max(0, r.h);
      const meet = (a, b) => ({x: Math.max(a.x, b.x), y: Math.max(a.y, b.y), w: Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), h: Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)});
      // what clip-path: inset() on the way up leaves of a rect (type built from clipped halves, masks)
      const clipped = (el, r) => {
        for (let e = el; e && e !== stage; e = e.parentElement) {
          const m = /^inset\(([^)]*)\)/.exec(getComputedStyle(e).clipPath);
          if (!m) continue;
          const b = toStage(e.getBoundingClientRect());
          const v = m[1].split(/\s+/).slice(0, 4).map((x, i) => x.endsWith('%') ? parseFloat(x) / 100 * (i % 2 ? b.w : b.h) : parseFloat(x));
          const [t0, r0 = t0, b0 = t0, l0 = r0] = v;
          r = meet(r, {x: b.x + l0, y: b.y + t0, w: b.w - l0 - r0, h: b.h - t0 - b0});
        }
        return r;
      };
      // a stable name for an element, so a changing label (a timecode) is one problem, not one per frame
      const where = (el) => { const out = []; for (let e = el; e && e !== stage; e = e.parentElement) out.unshift(e.id ? '#' + e.id : e.dataset.scene ? `[${e.dataset.scene}]` : e.tagName.toLowerCase()); return out.join(' '); };
      const texts = [];
      const walker = document.createTreeWalker(stage, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!n.textContent.trim()) continue;
        const el = n.parentElement;
        if (el.closest('[data-audit="off"],svg,video,canvas')) continue;
        const a = alpha(el);
        if (a < 0.15) continue;
        const range = document.createRange();
        range.selectNodeContents(n);
        const r = clipped(el, toStage(range.getBoundingClientRect()));
        if (area(r) < 1) continue;
        const prev = texts.find((x) => x.el === el);
        if (prev) { const x0 = Math.min(prev.r.x, r.x), y0 = Math.min(prev.r.y, r.y); prev.r = {x: x0, y: y0, w: Math.max(prev.r.x + prev.r.w, r.x + r.w) - x0, h: Math.max(prev.r.y + prev.r.h, r.y + r.h) - y0}; continue; }
        texts.push({el, r, text: n.textContent.trim().slice(0, 40), over: !!el.closest('[data-over]'), where: where(el)});
      }
      const pics = [...stage.querySelectorAll('img,video,canvas,[data-picture]')].filter((p) => alpha(p) > 0.15).map((p) => ({p, r: toStage(p.getBoundingClientRect())})).filter((x) => area(x.r) > 1);
      // is the picture really what's behind the words there, or is something opaque (a bar, a card) covering it?
      const opaque = (e) => { const cs = getComputedStyle(e); return /^(IMG|VIDEO|CANVAS)$/.test(e.tagName) || e.hasAttribute('data-picture') || cs.backgroundImage !== 'none' || (cs.backgroundColor.match(/[\d.]+/g) || [0, 0, 0, 0]).length === 3 || parseFloat((cs.backgroundColor.match(/[\d.]+/g) || [])[3] ?? 0) > 0.5; };
      const seen = (pic, m) => {
        let hits = 0, n = 0;
        for (let i = 1; i <= 4; i++) for (let j = 1; j <= 2; j++) {
          const x = box.left + (m.x + (m.w * i) / 5) * k, y = box.top + (m.y + (m.h * j) / 3) * k;
          const top = document.elementsFromPoint(x, y).find((e) => stage.contains(e) && e !== stage && opaque(e));
          n++; if (top && (top === pic || pic.contains(top) || top.contains(pic))) hits++;
        }
        return hits / n > 0.25;
      };
      const issues = [];
      const sx = width * safe, sy = height * safe;
      const frame = {x: 0, y: 0, w: width, h: height};
      for (const t of texts) {
        const inFrame = area(meet(t.r, frame));
        if (inFrame < 1) continue;
        const what = `"${t.text}"`, at = t.where;
        if (inFrame < area(t.r) - 1) issues.push({kind: 'clipped', what, at, rect: t.r});
        else if (t.r.x < sx - 0.5 || t.r.y < sy - 0.5 || t.r.x + t.r.w > width - sx + 0.5 || t.r.y + t.r.h > height - sy + 0.5) issues.push({kind: 'outside title-safe', what, at, rect: t.r});
        if (!t.over) for (const {p, r} of pics) { const m = meet(t.r, r); if (area(m) > 0.04 * area(t.r) && seen(p, m)) { issues.push({kind: 'over a picture', what, at, on: p.tagName.toLowerCase() + (p.id ? '#' + p.id : ''), rect: t.r}); break; } }
        for (const u of texts) if (u !== t && !t.el.contains(u.el) && !u.el.contains(t.el) && t.el.compareDocumentPosition(u.el) & Node.DOCUMENT_POSITION_FOLLOWING && area(meet(t.r, u.r)) > 0.02 * Math.min(area(t.r), area(u.r))) issues.push({kind: 'text on text', what: `${what} and "${u.text}"`, at, rect: t.r});
        const px = parseFloat(getComputedStyle(t.el).fontSize);
        if (px < min && !t.el.closest('[data-small]')) issues.push({kind: 'too small to read', what, at, size: Math.round(px)});
      }
      return issues;
    },

    async ready() {
      await document.fonts.ready;
      await Promise.all([...document.images].map((im) => im.decode().catch(() => {})));
      await Promise.all([...document.querySelectorAll('video')].map((v) => v.readyState >= 2 ? null : new Promise((res) => {
        v.muted = true; v.preload = 'auto';
        v.addEventListener('loadeddata', res, {once: true});
        v.addEventListener('error', () => {
          // keep going (a film is often written before its footage is recorded), but say so loudly
          const src = v.getAttribute('src');
          if (!missing.includes(src)) { missing.push(src); console.error(`footage missing or unplayable: ${src} (record it with engine/record.mjs; other video must be VP9 WebM: engine/footage.mjs converts it)`); }
          res();
        }, {once: true});
        v.load();
      })));
      await Promise.all(waits);
      // warm each clip's decoder at the point it first plays, so the first frame of a shot never waits on a long seek
      await Promise.all([...document.querySelectorAll('video[data-at]')].filter((v) => v.readyState >= 1).map((v) => seekVideo(v, parseFloat(v.dataset.from || 0))));
      const api = {manifest: () => F.manifest(), seek: (t) => F.seek(t), audit: (o) => F.audit(o)};
      window.__slate = api;
      if ((!navigator.webdriver && !params.has('still') && !params.has('render')) || params.has('preview')) preview(F);
      else if (params.has('t')) await F.seek(parseFloat(params.get('t')));
      return F;
    },
  };
  return F;
}

// ------------------------------------------------------------------ helpers

function frames(n) { return new Promise((res) => { const step = () => (n-- <= 0 ? res() : requestAnimationFrame(step)); requestAnimationFrame(step); }); }

// <video data-at="12" data-from="3.5" data-rate="1">: clip time 3.5s plays at film time 12s
function clipTime(v, t) { return parseFloat(v.dataset.from || 0) + (t - parseFloat(v.dataset.at)) * parseFloat(v.dataset.rate || 1); }
function onScreen(v) { const s = v.closest('[data-scene]'); return v.readyState >= 1 && (!s || s.style.visibility !== 'hidden') && getComputedStyle(v).visibility !== 'hidden'; }

function seekVideo(v, local) {
  v.pause();
  // aim at the middle of the frame, so rounding never shows the one before
  const fps = parseFloat(v.dataset.fps || 30);
  const target = Math.max(0, Math.min(Math.floor(local * fps + 1e-6) / fps + 0.5 / fps, (v.duration || 1e9) - 0.5 / fps));
  if (Math.abs(v.currentTime - target) < 1e-4) return Promise.resolve();
  return new Promise((res) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      // a clip that can't seek sits on its first frame for the whole shot; say so instead of rendering a still
      if (Math.abs(v.currentTime - target) > 1 / fps && !v.__warned) { v.__warned = true; console.error(`video did not seek: ${v.getAttribute('src')} is at ${v.currentTime.toFixed(2)}s, wanted ${target.toFixed(2)}s (is it served with byte ranges?)`); }
      res();
    };
    v.addEventListener('seeked', () => {
      // wait until the new frame is actually on screen, not just decoded
      if (v.requestVideoFrameCallback) { v.requestVideoFrameCallback(finish); setTimeout(finish, 250); } else finish();
    }, {once: true});
    v.currentTime = target;
  });
}

export function hash(s) { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }

/** Deterministic random numbers (never use Math.random in a film: every frame must render the same twice). */
export function seeded(seed = 1) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Split an element's text into spans for per-letter or per-word animation. Returns the spans. */
export function split(el, by = 'chars') {
  const text = el.textContent;
  el.textContent = '';
  el.setAttribute('aria-label', text);
  const out = [];
  for (const word of text.split(/(\s+)/)) {
    if (/^\s+$/.test(word)) { el.append(document.createTextNode(word)); continue; }
    const w = document.createElement('span');
    w.className = 'w';
    w.style.display = 'inline-block';
    if (by === 'words') { w.textContent = word; out.push(w); }
    else for (const ch of word) { const c = document.createElement('span'); c.className = 'c'; c.style.display = 'inline-block'; c.textContent = ch; w.append(c); out.push(c); }
    el.append(w);
  }
  return out;
}

// ------------------------------------------------------------------ preview: the studio

// Opened in a browser, a film plays in the studio: the stage on top, and below it the timeline the
// renderer and the scorer read (scenes, every sound cue, the mixed score's waveform once a render has
// written build/mix.wav), with sound. Click or drag the timeline to scrub; space plays, arrows step a frame.
const STUDIO_CSS = `
@font-face { font-family: 'Slate Mono'; src: url(/engine/runtime/fonts/jetbrains-mono-latin-400-normal.woff2) format('woff2'); font-weight: 400; }
@font-face { font-family: 'Slate Mono'; src: url(/engine/runtime/fonts/jetbrains-mono-latin-500-normal.woff2) format('woff2'); font-weight: 500; }
html.studio, html.studio body { margin: 0; height: 100%; background: #0b0c0e; overflow: hidden; }
.studio-panel { position: fixed; left: 0; right: 0; bottom: 0; height: var(--panel); background: #101215; border-top: 1px solid #1d2026;
  font: 400 calc(13px * var(--u, 1))/1 'Slate Mono', ui-monospace, monospace; color: #8a909a; z-index: 2147483000; display: flex; flex-direction: column; user-select: none; }
.studio-bar { display: flex; align-items: center; gap: calc(18px * var(--u, 1)); height: calc(46px * var(--u, 1)); padding: 0 20px; flex: none; }
.studio-bar button { all: unset; cursor: pointer; width: calc(28px * var(--u, 1)); height: calc(28px * var(--u, 1)); display: grid; place-items: center; border-radius: 6px; color: #e9ebee; background: #1b1e23; }
.studio-bar button:hover { background: #252931; }
.studio-tc { color: #eef0f3; font-weight: 500; font-size: calc(15px * var(--u, 1)); letter-spacing: .02em; font-variant-numeric: tabular-nums; }
.studio-scene { color: #c9ced6; }
.studio-meta { margin-left: auto; color: #5d636d; }
.studio-panel canvas { display: block; flex: 1; width: 100%; cursor: ew-resize; }
`;
const CUE_COLORS = {clap: '#ff6a3d', hit: '#ff6a3d', drop: '#ff6a3d', resolve: '#ffb38f', land: '#e9ebee', thud: '#e9ebee', swell: '#7f8a99', whoosh: '#7f8a99', key: '#4a505a', click: '#9aa3ae', cut: '#30343b'};

function preview(F) {
  const man = F.manifest();
  const dur = man.duration;
  // ?panel=px sets the timeline's height, ?zoom=n shows 1/n of the film around the playhead, ?ui=k scales the labels
  const u = parseFloat(params.get('ui') || 1), zoom = parseFloat(params.get('zoom') || 1);
  const PANEL = parseInt(params.get('panel') || 176 * u, 10);
  document.documentElement.classList.add('studio');
  document.documentElement.style.setProperty('--panel', PANEL + 'px');
  document.documentElement.style.setProperty('--u', u);
  const style = document.createElement('style');
  style.textContent = STUDIO_CSS;
  document.head.append(style);

  const stage = document.querySelector('[data-stage]') || document.body;
  const fit = () => {
    const pad = 28, w = innerWidth - pad * 2, h = innerHeight - PANEL - pad * 2;
    const k = Math.min(w / F.width, h / F.height);
    Object.assign(stage.style, {position: 'absolute', left: 0, top: 0, transformOrigin: '0 0', borderRadius: (6 / k) + 'px', boxShadow: '0 0 0 1px #1d2026, 0 30px 80px -20px rgba(0,0,0,.8)',
      transform: `translate(${(innerWidth - F.width * k) / 2}px,${pad + (h - F.height * k) / 2}px) scale(${k})`});
    draw();
  };

  const panel = document.createElement('div');
  panel.className = 'studio-panel';
  panel.innerHTML = `<div class="studio-bar"><button aria-label="play"></button><span class="studio-tc"></span><span class="studio-scene"></span>
    <span class="studio-meta">${F.title} · ${man.fps} fps · ${F.width}×${F.height} · ${man.bpm} BPM</span></div><canvas></canvas>`;
  document.body.append(panel);
  const [btn, tc, sceneLabel] = panel.querySelector('.studio-bar').children;
  const cv = panel.querySelector('canvas');
  const ctx = cv.getContext('2d');
  const PLAY = '<svg width="12" height="14" viewBox="0 0 12 14"><path d="M1 1l10 6-10 6z" fill="currentColor"/></svg>';
  const PAUSE = '<svg width="12" height="14" viewBox="0 0 12 14"><path d="M1 1h3.5v12H1zM7.5 1H11v12H7.5z" fill="currentColor"/></svg>';

  // the score, if a render has made one
  let peaks = null, audio = null, scored = false;
  fetch('build/mix.wav').then((r) => (r.ok ? r.arrayBuffer() : null)).then(async (buf) => {
    if (!buf) return;
    audio = new Audio('build/mix.wav');
    const ac = new OfflineAudioContext(1, 1, 48000);
    const data = (await ac.decodeAudioData(buf)).getChannelData(0);
    peaks = data;
    draw();
  }).catch(() => {}).finally(() => { scored = true; });

  // scenes in lanes, so overlays sit under what they overlay
  const lanes = [];
  for (const s of man.scenes) {
    let li = lanes.findIndex((l) => l.every((o) => o.end <= s.start + 1e-6 || o.start >= s.end - 1e-6));
    if (li < 0) { lanes.push([]); li = lanes.length - 1; }
    lanes[li].push(s);
  }

  let t = 0, playing = false, t0 = 0, from = 0;
  let view0 = 0;
  const span = dur / zoom;
  const X = (sec, w) => 20 + ((sec - view0) / span) * (w - 40);
  function draw() {
    const dpr = devicePixelRatio || 1;
    const w = cv.clientWidth, h = cv.clientHeight;
    if (!w || !h) return;
    if (cv.width !== Math.round(w * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (zoom > 1) view0 = Math.max(0, Math.min(dur - span, t - span * 0.35));
    ctx.font = `400 ${11 * u}px 'Slate Mono', ui-monospace, monospace`;
    ctx.textBaseline = 'middle';
    // ruler
    for (let s = 0; s <= dur + 1e-6; s += 1) {
      const x = X(s, w);
      ctx.fillStyle = s % 5 === 0 ? '#3a3f47' : '#22262c';
      const major = zoom > 2 || s % 5 === 0;
      ctx.fillRect(x, 0, 1, (major ? 9 : 5) * u);
      if (major) { ctx.fillStyle = '#5d636d'; ctx.fillText(`${s}s`, x + 5 * u, 6 * u); }
    }
    // scenes
    const laneH = Math.min(22 * u, (h - 74 * u) / Math.max(1, lanes.length) - 4);
    lanes.forEach((lane, li) => {
      for (const s of lane) {
        const x0 = X(s.start, w) + 1, x1 = X(s.end, w) - 1, y = 18 * u + li * (laneH + 4);
        const on = s.start <= t && t < s.end;
        ctx.fillStyle = on ? '#2a2f37' : '#181b20';
        ctx.beginPath(); ctx.roundRect(x0, y, Math.max(2, x1 - x0), laneH, 4); ctx.fill();
        ctx.save(); ctx.beginPath(); ctx.rect(x0 + 6 * u, y, Math.max(0, x1 - x0 - 10 * u), laneH); ctx.clip();
        ctx.fillStyle = on ? '#eef0f3' : '#6d737d'; ctx.fillText(s.name, x0 + 7 * u, y + laneH / 2 + 1); ctx.restore();
      }
    });
    // cues
    const cy = 18 * u + lanes.length * (laneH + 4) + 4 * u;
    for (const e of man.events) {
      if (e.type === 'cut') continue;
      const x = X(e.t, w), big = !['key', 'click', 'tick', 'pop'].includes(e.type);
      const near = Math.abs(e.t - t) < 0.12 && e.t <= t + 1e-6;
      ctx.fillStyle = near ? '#ffffff' : CUE_COLORS[e.type] || '#7f8a99';
      ctx.fillRect(x - (big ? u : 0.5 * u), cy + (big ? 0 : 4 * u), (big ? 2 : 1) * u, (big ? 14 : 6) * u);
      if (big && zoom > 2) { ctx.fillStyle = near ? '#ffffff' : '#5d636d'; ctx.fillText(e.type, x + 5 * u, cy + 7 * u); }
    }
    // waveform
    const wy = cy + 22 * u, wh = h - wy - 6 * u;
    if (peaks && wh > 6) {
      const n = peaks.length, x0 = X(0, w), x1 = X(dur, w);
      for (let x = Math.max(20, Math.floor(x0)); x < Math.min(w - 20, x1); x++) {
        const a = Math.floor(((x - x0) / (x1 - x0)) * n), b = Math.floor(((x + 1 - x0) / (x1 - x0)) * n);
        let m = 0;
        for (let i = a; i < b; i += Math.max(1, Math.floor((b - a) / 64))) m = Math.max(m, Math.abs(peaks[i]));
        const hh = Math.max(1, m * wh * 0.95);
        ctx.fillStyle = x < X(t, w) ? '#8a929e' : '#2c3138';
        ctx.fillRect(x, wy + (wh - hh) / 2, 1, hh);
      }
    }
    // playhead
    const px = X(t, w);
    ctx.fillStyle = '#ff6a3d';
    ctx.fillRect(px - u, 0, 2 * u, h);
    ctx.beginPath(); ctx.moveTo(px - 6 * u, 0); ctx.lineTo(px + 6 * u, 0); ctx.lineTo(px, 8 * u); ctx.fill();
  }

  const label = () => {
    const f = Math.round(t * F.fps), sec = Math.floor(f / F.fps), fr = f % F.fps;
    tc.textContent = `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}:${String(fr).padStart(2, '0')}`;
    const cur = man.scenes.filter((s) => s.start <= t && t < s.end).map((s) => s.name);
    sceneLabel.textContent = cur.join(' + ');
  };
  const show = (x) => { t = Math.max(0, Math.min(dur, x)); label(); draw(); return F.seek(t); };
  const setPlaying = (p) => {
    playing = p; btn.innerHTML = p ? PAUSE : PLAY;
    from = t; t0 = performance.now();
    if (audio) { if (p) { audio.currentTime = t; audio.play().catch(() => {}); } else audio.pause(); }
  };
  let busy = false;
  const loop = () => {
    if (playing && !busy) {
      let x = from + (performance.now() - t0) / 1000;
      if (x >= dur) { from = 0; t0 = performance.now(); x = 0; if (audio) audio.currentTime = 0; }
      busy = true;
      show(x).finally(() => { busy = false; });
    }
    requestAnimationFrame(loop);
  };
  const scrub = (e) => { const r = cv.getBoundingClientRect(); show(view0 + ((e.clientX - r.left - 20) / (r.width - 40)) * span); };
  cv.addEventListener('pointerdown', (e) => { if (playing) setPlaying(false); cv.setPointerCapture(e.pointerId); scrub(e); cv.onpointermove = scrub; });
  cv.addEventListener('pointerup', () => { cv.onpointermove = null; });
  btn.onclick = () => setPlaying(!playing);
  addEventListener('keydown', (e) => {
    if (e.key === ' ') { e.preventDefault(); setPlaying(!playing); }
    if (e.key === 'ArrowRight') { setPlaying(false); show(t + 1 / F.fps); }
    if (e.key === 'ArrowLeft') { setPlaying(false); show(t - 1 / F.fps); }
  });
  addEventListener('resize', fit);
  fit();
  const start = parseFloat(params.get('t') || 0);
  show(start);
  setPlaying(!params.has('paused'));
  loop();
  window.__studio = {get ready() { return scored; }, show, play: () => setPlaying(true), pause: () => setPlaying(false), get t() { return t; }};
}
