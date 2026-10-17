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
  let music = {key: 'D', style: 'glass'};
  let post = {grain: 0, vignette: 0, blur: 1, shutter: 0.5};
  let notes = {};

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

    /** Hold the first frame until this promise settles (textures, video metadata). */
    wait(promise) { waits.push(promise); return F; },

    /** Score settings: key, style (see tools/score.py), plus anything the scorer understands. */
    music(m) { music = {...music, ...m}; return F; },

    /** Finishing: grain (0..20), vignette (0..1), blur (subframes per frame, 1 = off), shutter (0..1 of a frame). */
    post(p) { post = {...post, ...p}; return F; },

    /** Director's notes stored in the manifest (the one idea, the concept, what was rejected). */
    notes(n) { notes = {...notes, ...n}; return F; },

    end(t) { duration = t; return F; },

    manifest() {
      const dur = duration ?? tl.duration();
      return {
        title, fps, width, height, bpm, duration: dur, ...music && {key: music.key, musicStyle: music.style, music},
        post, notes,
        scenes: scenes.map(({el, ...s}) => s).sort((a, b) => a.start - b.start),
        events: events.filter((e) => e.t <= dur + 1e-6).sort((a, b) => a.t - b.t),
      };
    },

    async seek(t) {
      for (const s of scenes) s.el.style.visibility = s.start <= t + 1e-6 && t < s.end - 1e-6 ? 'visible' : 'hidden';
      tl.totalTime(Math.min(t, tl.totalDuration()), false);
      for (const a of document.getAnimations()) { a.pause(); a.currentTime = t * 1000; }
      for (const {el, text, times} of typers) { let n = 0; while (n < times.length && times[n] <= t + 1e-6) n++; if (el.textContent !== text.slice(0, n)) el.textContent = text.slice(0, n); }
      const vids = [...document.querySelectorAll('video[data-at]')].map((v) => seekVideo(v, t - parseFloat(v.dataset.at)));
      await Promise.all(vids);
      for (const fn of frameHooks) await fn(t, F);
      await frames(2);
    },

    async ready() {
      await document.fonts.ready;
      await Promise.all([...document.images].map((im) => im.decode().catch(() => {})));
      await Promise.all(waits);
      const api = {manifest: () => F.manifest(), seek: (t) => F.seek(t)};
      window.__slate = api;
      if (!navigator.webdriver && !params.has('still')) preview(F);
      else if (params.has('t')) await F.seek(parseFloat(params.get('t')));
      return F;
    },
  };
  return F;
}

// ------------------------------------------------------------------ helpers

function frames(n) { return new Promise((res) => { const step = () => (n-- <= 0 ? res() : requestAnimationFrame(step)); requestAnimationFrame(step); }); }

function seekVideo(v, local) {
  v.pause();
  const target = Math.max(0, Math.min(local, (v.duration || 1e9) - 0.001));
  if (Math.abs(v.currentTime - target) < 1e-4) return Promise.resolve();
  return new Promise((res) => { v.addEventListener('seeked', res, {once: true}); v.currentTime = target; });
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

// ------------------------------------------------------------------ preview

function preview(F) {
  const dur = F.manifest().duration;
  const bar = document.createElement('div');
  bar.innerHTML = `<input type=range min=0 max=${dur} step=${1 / F.fps} value=0 style="width:70vw"> <span></span> <button>play</button>`;
  Object.assign(bar.style, {position: 'fixed', left: '50%', bottom: '12px', transform: 'translateX(-50%)', zIndex: 1e6, font: '12px ui-monospace,monospace', color: '#fff', background: 'rgba(0,0,0,.6)', padding: '6px 10px', borderRadius: '8px', display: 'flex', gap: '8px', alignItems: 'center'});
  document.body.append(bar);
  const [range, label, btn] = bar.children;
  // fit the stage to the window
  const stage = document.querySelector('[data-stage]') || document.body;
  const fit = () => { const k = Math.min(innerWidth / F.width, innerHeight / F.height); stage.style.transformOrigin = '0 0'; stage.style.transform = `translate(${(innerWidth - F.width * k) / 2}px,${(innerHeight - F.height * k) / 2}px) scale(${k})`; };
  fit(); addEventListener('resize', fit);
  let playing = true, t0 = performance.now(), from = 0;
  const show = (t) => { range.value = t; label.textContent = `${t.toFixed(2)}s · beat ${(t / F.beat).toFixed(1)}`; F.seek(t); };
  const loop = () => { if (playing) { const t = (from + (performance.now() - t0) / 1000) % dur; show(t); } requestAnimationFrame(loop); };
  range.oninput = () => { playing = false; btn.textContent = 'play'; show(parseFloat(range.value)); };
  btn.onclick = () => { playing = !playing; btn.textContent = playing ? 'pause' : 'play'; from = parseFloat(range.value); t0 = performance.now(); };
  btn.textContent = 'pause';
  addEventListener('keydown', (e) => { if (e.key === ' ') btn.onclick(); if (e.key === 'ArrowRight') { playing = false; show(Math.min(dur, +range.value + 1 / F.fps)); } if (e.key === 'ArrowLeft') { playing = false; show(Math.max(0, +range.value - 1 / F.fps)); } });
  loop();
}
