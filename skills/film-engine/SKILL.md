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
films/<name>/assets/      fonts (with their license), logo, stills
films/<name>/shots/       shot scripts that record the film's footage (engine/record.mjs)
films/<name>/footage/     recorded or prepared clips: <shot>.webm + <shot>.json sidecar
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
F.music({key: 'Eb', style: 'strings', end: 'phrase', arc: [[0, 0.2], [b(16), 0.7], [b(30), 0.2]]});  // chosen per film; there is no default
F.post({grain: 5, vignette: 0.35, blur: 4, shutter: 0.5});
F.notes({idea: '…', motif: '…', form: '…', sound: '…', rejected: ['…']});
F.end(b(32));
await F.ready();
```

| Call | What it does |
|---|---|
| `F.scene(name, {start, end, kind, energy, words, cut}, build)` | Shows `[data-scene=name]` from start to end. `kind`: `world`, `type`, `product` or `logo` (the critic reads it). `words`: what must be readable while it's up. `cut: false` for overlays and invisible joins. |
| `F.cue(type, t, extra)` | Sound event. Types: `land` (`i`, `n`, `soft`), `rustle`, `swell` (`len`), `drop` (the music stops until the next `thud`/`hit`; a trailer device), `clap` (`gain`), `thud`, `hit`, `resolve`, `whoosh` (`len`), `flip`, `click`, `key`, `tick`, `glint`, `pop`. |
| `F.type(el, text, {at, cps, caret})` | Types text in with human rhythm and a key cue per letter. Returns the end time. Use it only when typing *is* the idea. |
| `await F.footage(name)` | Loads `footage/<name>.json`: the clip's duration, `marks` (named moments) and `events` (every key press and click, with times). |
| `F.music({style, key, arc, end, fadeLen})` | The score: style, key, dynamics over time and ending. Required: a film without it fails to score. See `sound-design`. |
| `F.cueClip(clip, at, {from, to})` | Puts the clip's own key and click sounds on the film's timeline, for the part that plays from film time `at`. |
| `F.audit()` | Lists layout problems in the current frame (the renderer calls it; see Layout below). |
| `F.onFrame(fn(t))` | Runs every frame, for canvas and WebGL (render your Three.js scene here). |
| `F.wait(promise)` | Holds the first frame until assets load. |
| `F.b(n)`, `F.bar(n)`, `F.snap(t, div)` | Beat math. |
| `seeded(seed)` | Deterministic random. Never use `Math.random()`. |
| `split(el, 'words' \| 'chars')` | Splits text into spans to animate. |

Determinism rules:
- Everything time-based goes on `tl` or in `onFrame(t)`. CSS animations are fine, because the renderer seeks them too.
- `<video data-at="12.5" data-from="3" data-rate="1">` is seeked every frame so that clip time 3s plays at film time 12.5s. Hidden videos are skipped. Video must be VP9 WebM (headless Chromium has no H.264); `engine/record.mjs` writes it, `engine/footage.mjs prepare` converts anything else.
- Nothing may depend on the wall clock, on load order, or on `Math.random()`.

## Footage: real moving pictures

Films are made of shots, not slides. Get real footage first, then write the film around it.

| Source | Tool | For |
|---|---|---|
| The product's web UI, in use | `node engine/record.mjs films/<name>/shots/<shot>.mjs` | demos: typing, clicking, scrolling, things updating |
| A command-line session | `node engine/termcast.mjs --out shots/x.cast.json -- <command>`, then film `engine/players/terminal.html?cast=...` | CLIs, dev tools, builds |
| Source code | film `engine/players/code.html?file=...` | developer products |
| Filmed video (phone, camera, stock you have a license for) | `node engine/footage.mjs prepare clip.mp4 --out footage/clip.webm` | people, places, hardware |
| Generated video | `GEMINI_API_KEY=... node engine/footage.mjs generate "<prompt>" --out footage/x.webm` | atmosphere and texture, never the product's UI |

A shot script drives a real page in Chromium on a virtual clock and captures every frame, so the clip is smooth at full frame rate on any machine, with a drawn cursor (screenshots have none):

```js
// films/<name>/shots/compose.mjs
export default {
  url: '/films/<name>/app/index.html',   // a path on the Slate server, or any https:// URL
  width: 1920, height: 800, scale: 1.25,  // record bigger than you show, so a push stays sharp
  ready: () => !!window.app,              // run the clock, uncaptured, until the app has started
  async run(rec) {
    await rec.cursor(1400, 600);
    await rec.click('#new');              // glides there, clicks for real, logs a click event
    await rec.type('#title', 'Q3 plan');  // human rhythm, a key event per letter
    rec.mark('typed');                    // the film can start the clip here: data-from = clip.marks.typed
    await rec.scroll('#list', 600, {dur: 1.4});
    await rec.hold(1.5);
  },
};
```

`rec` also has `move(to)`, `press(key)`, `do(fn)` (run code in the page), `rect(name, sel)` (save an element's box, for matched cuts) and `t` (clip time). The sidecar JSON has the marks and events; `F.cueClip` turns them into sound.

Record at the aspect of the picture area you will show (a 2.4:1 matte wants 1920×800). Order of work: write the film with its `<video>` slots (missing footage renders black with a warning), record, look at the clips, then tune `data-from` and timing.

## The studio

`node engine/serve.mjs` and open `http://localhost:4173/films/<name>/`. The film plays above its timeline: scenes in lanes, every cue as a tick, and once a render has written `build/mix.wav`, the score's waveform and sound. Click or drag to scrub, space to play, arrows step a frame. `?t=12` starts there, `?paused`, `?zoom=5` follows the playhead at 5× (to read cues), `?ui=1.5` scales the labels, `?panel=400` makes the timeline taller. `?preview` forces the studio on in automated browsers (that's how it gets filmed).

## Layout

`F.audit()` checks every visible word (opacity over 0.15) in the current frame: inside title-safe (6% margins), not cut off, not over an `img`/`video`/`canvas`, not over other words, at least 18px. Clip paths are respected. Mark exceptions in the HTML: `data-over` (words that may sit on a picture you darkened for them), `data-audit="off"` (a duplicate copy of words, or labels inside a mock UI), `data-small` (deliberately tiny print).

`node engine/render.mjs films/<name> --audit` samples the film 6× a second and prints each problem with its time range. Full renders run it first and the critic reports it.

## Primitives (write them per film; these are the patterns)

- **Camera:** animate a wrapper's `scale`/`x`/`y` (2D) or put the world in a `perspective` container and move elements in `translate3d` (3D). Ease in-out; keep pushes to 3–15% unless the push *is* the shot.
- **Depth of field:** `filter: blur(px)` proportional to distance from the focus plane, computed in `onFrame`. Keep it under 16px.
- **Landing / settling:** an arc toward the camera, then down onto the rest pose, with the shadow tightening. Use `power3.inOut` for travel and a small overshoot only for light things.
- **Type in motion:** `split(el,'words')`, then animate y, opacity and `filter: blur()` with a stagger. Animate per letter only for display sizes.
- **Masks and reveals:** `clip-path: inset()/circle()`, or SVG masks. MorphSVGPlugin (`gsap/MorphSVGPlugin.js`) morphs between shapes, for example a sheet into a logo petal. With SVG children, set `svgOrigin` once with `gsap.set` and never inside a `fromTo` (it drifts).
- **3D:** CSS 3D for cards, sheets and windows (cheap). Three.js for real geometry, such as surfaces, particles and models. Create the renderer with `preserveDrawingBuffer: true` and render inside `onFrame`.
- **Real UI:** recorded footage as `<video>` (see Footage). A screenshot only for a deliberate still beat. Crop by translating inside an `overflow:hidden` box; never push past the recorded pixels.
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
  --audit               only check type placement
```

Output: H.264 High at CRF 18, BT.709, AAC 256k, `+faststart`. The renderer writes `build/manifest.json` (scenes, cues, arc, post), runs `tools/score.py` while frames render, then muxes and runs the critic.

Speed: each subframe is a full browser paint. Heavy filters (many blurred layers) and WebGL on a CPU-only machine are the slow parts. Draft first, then render the final once.

## Debugging

- A blank or black frame: something threw. The renderer prints `page error:` lines, so check the console in preview.
- Elements in the wrong place only when rendering: they depend on wall time or a callback. Move the logic into `tl` or `onFrame`.
- Fonts missing in frames: `@font-face` paths are relative to `film.css`. `F.ready()` waits for `document.fonts`.
