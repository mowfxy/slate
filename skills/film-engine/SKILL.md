---
name: film-engine
description: How Slate films are built and rendered - a film is an HTML/CSS/JS page driven by one paused GSAP timeline, captured frame by frame in headless Chromium and encoded with ffmpeg. Covers the runtime API, scenes, cues, primitives (camera, type, depth, 3D, WebGL, video), finishing and render options. Use when writing or debugging a film.
---

# The film engine

A film is a web page in `films/<name>/`. Anything a browser can draw can go in a shot: CSS 3D, SVG, canvas, WebGL (Three.js), video, real web fonts, blend modes, filters. The renderer seeks the page to each frame's exact time, screenshots it, averages subframes for motion blur, and encodes. Picture and sound are timed from the same manifest.

There are no scene templates on purpose. Every film's scenes are written new for its idea, using the primitives below.

## Files

```
films/<name>/index.html   the stage and one <section data-scene="..."> per scene
films/<name>/film.css     the look
films/<name>/film.js      the timeline (an ES module)
films/<name>/assets/      screenshots, fonts (with their license), logo, footage
```

`index.html` needs this import map, a `[data-stage]` element, and the module:

```html
<script type="importmap">{"imports":{"gsap":"/engine/node_modules/gsap/index.js","gsap/":"/engine/node_modules/gsap/","three":"/engine/node_modules/three/build/three.module.js","three/addons/":"/engine/node_modules/three/examples/jsm/","slate":"/engine/runtime/slate.js"}}</script>
<div data-stage> <section data-scene="open">…</section> … </div>
<script type="module" src="film.js"></script>
```

## The runtime (`slate`)

```js
import {film, seeded, split} from 'slate';
const F = film({fps: 30, width: 1920, height: 1080, bpm: 84, title: 'Product · Idea'});
const {gsap, tl, b} = F;                 // tl: the one paused timeline; b(n): seconds at beat n

F.scene('open', {start: 0, end: b(8), kind: 'world', energy: 0.3, words: ''}, (tl, el) => {
  tl.fromTo(el.querySelector('.thing'), {y: -40}, {y: 0, duration: 1});   // tl starts at the scene's start
});
F.cue('land', b(3.5), {i: 4, n: 12});    // a sound on the frame where it happens
F.music({key: 'Eb', style: 'felt', arc: [[0, 0.2], [b(16), 0.7], [b(30), 0.2]]});
F.post({grain: 5, vignette: 0.35, blur: 4, shutter: 0.5});
F.notes({idea: '…', motif: '…', rejected: ['…']});
F.end(b(32));
await F.ready();
```

| Call | What it does |
|---|---|
| `F.scene(name, {start, end, kind, energy, words, cut}, build)` | Shows `[data-scene=name]` from start to end. `kind`: `world`, `type`, `product` or `logo` (the critic reads it). `words`: what must be readable while it's up. `cut: false` for overlays and invisible joins. |
| `F.cue(type, t, extra)` | Sound event. Types: `land` (`i`, `n`, `soft`), `rustle`, `swell` (`len`), `drop` (the music stops until the next `thud`/`hit`), `thud`, `hit`, `resolve`, `whoosh` (`len`), `flip`, `click`, `key`, `tick`, `glint`, `pop`. |
| `F.type(el, text, {at, cps, caret})` | Types text in with human rhythm and a key cue per letter. Returns the end time. Use it only when typing *is* the idea. |
| `F.onFrame(fn(t))` | Runs every frame, for canvas and WebGL (render your Three.js scene here). |
| `F.wait(promise)` | Holds the first frame until assets load. |
| `F.b(n)`, `F.bar(n)`, `F.snap(t, div)` | Beat math. |
| `seeded(seed)` | Deterministic random. Never use `Math.random()`. |
| `split(el, 'words' \| 'chars')` | Splits text into spans to animate. |

Determinism rules:
- Everything time-based goes on `tl` or in `onFrame(t)`. CSS animations are fine, because the renderer seeks them too.
- `<video data-at="12.5">` is seeked so that its 0s plays at film time 12.5s.
- Nothing may depend on the wall clock, on load order, or on `Math.random()`.

## Primitives (write them per film; these are the patterns)

- **Camera:** animate a wrapper's `scale`/`x`/`y` (2D) or put the world in a `perspective` container and move elements in `translate3d` (3D). Ease in-out; keep pushes to 3–15% unless the push *is* the shot.
- **Depth of field:** `filter: blur(px)` proportional to distance from the focus plane, computed in `onFrame`. Keep it under 16px.
- **Landing / settling:** an arc toward the camera, then down onto the rest pose, with the shadow tightening. Use `power3.inOut` for travel and a small overshoot only for light things.
- **Type in motion:** `split(el,'words')`, then animate y, opacity and `filter: blur()` with a stagger. Animate per letter only for display sizes.
- **Masks and reveals:** `clip-path: inset()/circle()`, or SVG masks. MorphSVGPlugin (`gsap/MorphSVGPlugin.js`) morphs between shapes, for example a sheet into a logo petal. With SVG children, set `svgOrigin` once with `gsap.set` and never inside a `fromTo` (it drifts).
- **3D:** CSS 3D for cards, sheets and windows (cheap). Three.js for real geometry, such as surfaces, particles and models. Create the renderer with `preserveDrawingBuffer: true` and render inside `onFrame`.
- **Real UI:** screenshots as `<img>` in a window with radius, a 1px edge and a long soft shadow. Crop by translating the image inside an `overflow:hidden` box. Never upscale past about 1.5x.
- **Light:** a radial-gradient glow layer, a vignette (`post.vignette`), and gradient shading on surfaces that turn.
- **Grain and motion blur:** set in `F.post`. `blur: 4` renders 4 subframes per frame across `shutter` (0.5 is a 180° shutter).

## Rendering

```bash
node engine/serve.mjs                                  # preview at http://localhost:4173/films/<name>/
node engine/render.mjs films/<name> --stills 1,8.5,20  # PNGs in build/stills
node engine/render.mjs films/<name> --draft            # half size, no blur, fast
node engine/render.mjs films/<name>                    # final: out/<name>.mp4 + score + critic
  --from 10 --to 18     render a range
  --workers 4           parallel pages (default: CPU count)
  --music track.wav     a supplied track instead of the generated score
```

Output: H.264 High at CRF 18, BT.709, AAC 256k, `+faststart`. The renderer writes `build/manifest.json` (scenes, cues, arc, post), runs `tools/score.py` while frames render, then muxes and runs the critic.

Speed: each subframe is a full browser paint. Heavy filters (many blurred layers) and WebGL on a CPU-only machine are the slow parts. Draft first, then render the final once.

## Debugging

- A blank or black frame: something threw. The renderer prints `page error:` lines, so check the console in preview.
- Elements in the wrong place only when rendering: they depend on wall time or a callback. Move the logic into `tl` or `onFrame`.
- Fonts missing in frames: `@font-face` paths are relative to `film.css`. `F.ready()` waits for `document.fonts`.
