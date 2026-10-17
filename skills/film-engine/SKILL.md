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
const F = film({fps: 60, width: 1920, height: 1080, bpm: 84, title: 'Product · Idea'});
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
| `F.music({key, composed})` | Marks the film's own score (`films/<name>/score.py`, which the renderer runs instead of the sketch scorer). `{track}` for a supplied or Lyria track; `{style, arc, end}` only for the old sketch scorer. See `sound-design`. |
| `F.cueClip(clip, at, {from, to})` | Puts the clip's own key and click sounds on the film's timeline, for the part that plays from film time `at`. |
| `F.audit()` | Lists layout problems in the current frame (the renderer calls it; see Layout below). |
| `F.camera(el, keys, {of: clip})` | A camera on a picture or a live UI world: each key `{t, x, y, zoom, ease}` frames point x,y of it at that zoom, and the move into a key uses its ease. With `of: clip`, x/y are the recorded page's CSS pixels. Zoom moves in log space and never shows past the edge. A pure function of time. Returns `{project(t, x, y)}`: where a point of the picture is on screen at time t, so something outside the camera (a dot that flies out of the UI) can meet it exactly. |
| `F.blur(from, to, samples)` | Motion blur for a stretch of the film: `samples` subframes per frame, averaged over the shutter. Only where things move fast; zooms smear text more than pans, so give pushes and pulls 10–14. |
| `F.onFrame(fn(t))` | Runs every frame, for canvas and WebGL (render your Three.js scene here). |
| `F.wait(promise)` | Holds the first frame until assets load. |
| `F.b(n)`, `F.bar(n)`, `F.snap(t, div)` | Beat math. |
| `seeded(seed)` | Deterministic random. Never use `Math.random()`. |
| `split(el, 'words' \| 'chars')` | Splits text into spans to animate. |

Determinism rules:
- Everything time-based goes on `tl` or in `onFrame(t)`. CSS animations are fine, because the renderer seeks them too.
- `<video data-at="12.5" data-from="3" data-rate="1">` plays clip time 3s at film time 12.5s. In a render the video is never seeked: the renderer extracts every clip's frames to `build/frames/<clip>/` and the element shows the exact frame for each film frame as its background (seeking a `<video>` per frame painted stale frames, and flashed the clip's first frame at the start of every parallel chunk). The element keeps its layout and anything animating it. The studio preview still plays the video. Clips must be VP9 WebM (headless Chromium has no H.264); `engine/record.mjs` writes it, `engine/footage.mjs prepare` converts anything else.
- **Frame rate.** Render at 60 fps (`film({fps: 60})`) and record footage at the same rate. At 30 fps, camera moves and scrolling judder; the reference product films are all 60.
- Nothing may depend on the wall clock, on load order, or on `Math.random()`.

## Live product

The default way to show a product: build its UI in the film page and drive it from the timeline, instead of recording it. See [`films/dayline`](../../films/dayline).

- Put the app inside a world element the size of the frame, marked `data-ui` (and `data-audit="off"`, so its small labels skip the title-safe rules), and put `F.camera` on it. The UI is vector, so zooming to 3× re-rasterizes sharp. Don't set `will-change: transform` on it, which would scale a bitmap.
- Lay the app out in its own pixels and keep the geometry in constants (row heights, column x), so the camera and every move can aim at real elements. Measure controls with `offsetLeft`/`offsetTop` (they ignore the camera's transform).
- Animate state on `tl` (a block's `top`, `left`, `width`; a CSS variable like `--k` for a row turning into a block) and set discrete state (labels, counts, which button is on) in `F.onFrame(t)` as a pure function of time. Never call app event handlers.
- A pointer is an SVG arrow inside the world: move x and y on different eases so the path arcs, and press with a quick scale to 0.86.
- **No label cut by the frame.** When the camera holds, every word is whole or out of frame. The audit checks `[data-ui]` text against the frame edges (what the app itself clips doesn't count) and fails a cut that lasts 0.3s. Fix it by moving the frame's edge into a gap between rows.

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
  width: 1920, height: 800, scale: 2.5, fps: 60,  // 60 fps like the film; 2.5x so a close-up stays sharp
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

Record at the aspect of the picture area you will show (a 2.4:1 matte wants 1920×800), at `scale` high enough for your closest framing (zoom 2.5 needs `scale: 2.5`). Order of work: write the film with its `<video>` slots (missing footage renders black with a warning), record, look at the clips, then tune `data-from` and timing.

## The studio

`node engine/serve.mjs` and open `http://localhost:4173/films/<name>/`. The film plays above its timeline: scenes in lanes, every cue as a tick, and once a render has written `build/mix.wav`, the score's waveform and sound. Click or drag to scrub, space to play, arrows step a frame. `?t=12` starts there, `?paused`, `?zoom=5` follows the playhead at 5× (to read cues), `?ui=1.5` scales the labels, `?panel=400` makes the timeline taller. `?preview` forces the studio on in automated browsers (that's how it gets filmed).

## Layout

`F.audit()` checks every visible word (opacity over 0.15) in the current frame: inside title-safe (6% margins), not cut off, not over an `img`/`video`/`canvas`, not over other words, at least 18px. Clip paths are respected. Mark exceptions in the HTML: `data-over` (words that may sit on a picture you darkened for them), `data-audit="off"` (a duplicate copy of words, or labels inside a mock UI), `data-small` (deliberately tiny print).

`node engine/render.mjs films/<name> --audit` samples the film 6× a second and prints each problem with its time range. Full renders run it first and the critic reports it.

## Primitives (write them per film; these are the patterns)

- **Camera on product footage:** `F.camera`. Don't show a whole app window at 1x: at film size its text is unreadable and it reads as a screenshot. Open close (2–2.5x) on the control being used as the pointer arrives, follow the action, and pull back only when the result needs the whole view. Aim at real elements with `rec.rect()` in the shot and `clip.rects` in the film. Keep every label you frame whole: the edge of the frame must not cut words.
- **Camera on a world:** animate a wrapper's `scale`/`x`/`y` (2D) or put the world in a `perspective` container and move elements in `translate3d` (3D). Ease in-out.
- **Depth of field:** `filter: blur(px)` proportional to distance from the focus plane, computed in `onFrame`. Keep it under 16px.
- **Landing / settling:** fast in, long soft stop: `expo.out` or `power4.out`. Overshoot (`back.out`) reads as cheap bounce on type and on whole frames; allow it only on one small light thing (a dot, a badge), at `back.out(1.3)` or less. Never move a whole shot on a cut (a frame that jumps 30px at a cut reads as a glitch); let the camera move inside the shot.
- **Type in motion:** wrap each word in an `overflow: hidden` mask and move it in by `yPercent`, so it appears through its own line instead of fading in on the page. Animate per letter only for display sizes.
- **Masks and reveals:** `clip-path: inset()/circle()`, or SVG masks. MorphSVGPlugin (`gsap/MorphSVGPlugin.js`) morphs between shapes, for example a sheet into a logo petal. With SVG children, set `svgOrigin` once with `gsap.set` and never inside a `fromTo` (it drifts).
- **3D:** CSS 3D for cards, sheets and windows (cheap). Three.js for real geometry, such as surfaces, particles and models. Create the renderer with `preserveDrawingBuffer: true` and render inside `onFrame`.
- **Real UI:** live in the page (see Live product); recorded footage as `<video>` only for what you can't rebuild. A screenshot only for a deliberate still beat.
- **Light:** a radial-gradient glow layer, a vignette (`post.vignette`), and gradient shading on surfaces that turn.
- **Motion blur:** `F.blur(from, to, samples)` on the fast stretches only; the renderer splits the film into runs and spends subframes only there. Few subframes don't blur, they stack copies of every label; use 8+ on pans and flights, 10–14 on zooms, and check a still mid-move. **Grain and vignette** (`F.post`) are for film-like footage, never over UI: they turn white into grey.

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

Output: H.264 High at CRF 16 with `aq-mode=3` (keeps paper, gradients and grain from banding), BT.709, AAC 256k, `+faststart`. The renderer writes `build/manifest.json` (scenes, cues, notes, post), runs the film's `score.py` (or the sketch scorer `tools/score.py` if it has none) while frames render, then muxes and runs the critic.

Speed: on 4 cores a 29s 60 fps film with blur on a third of its frames renders in about 5 minutes. Each subframe is a full browser paint. Heavy filters (many blurred layers) and WebGL on a CPU-only machine are the slow parts. Draft first, then render the final once.

## Debugging

- A flash (one frame unlike its neighbours) or a stutter: the critic finds both (`No flashes`, `Smooth motion`). A flash in footage means a clip played by seeking; check the renderer logged `footage <clip>: N frames`.
- A blank or black frame: something threw. The renderer prints `page error:` lines, so check the console in preview.
- Elements in the wrong place only when rendering: they depend on wall time or a callback. Move the logic into `tl` or `onFrame`.
- Fonts missing in frames: `@font-face` paths are relative to `film.css`. `F.ready()` waits for `document.fonts`.
