# The Slate spec

One JSON file describes a whole film. `studio/src/lib/timeline.mjs` turns it into exact frame timings, cut points and sound events; the studio renders the picture from it and `tools/score.py` renders the sound from the same timeline.

```jsonc
{
  "meta": {
    "title": "Fieldnote · Sync launch",
    "archetype": "demo",          // demo | feature | teaser | ad (sets music defaults)
    "width": 1920, "height": 1080,
    "fps": 30,
    "bpm": 96,                    // every scene's "beats" is measured against this
    "cps": 16                     // default typing speed, characters per second
  },
  "brand": {
    "name": "Fieldnote",
    "accent": "#2f6bff",          // the one accent
    "accent2": "#e8553a",         // optional, only for "( )" in bracketTitle
    "ink": "#111111",
    "paper": "#faf8f3",
    "sans": "Inter",              // optional; must be loaded (see remotion-kit skill)
    "serif": "Newsreader",
    "wordmark": "sans",           // sans | serif
    "mark": "none"                // "slate" draws the Slate mark; "none" shows the wordmark only
  },
  "look": {"grain": 0.12, "vignette": 0.1},     // optional, teasers mostly
  "audio": {
    "style": "glass",             // glass | pulse (generated score)
    "key": "D",
    "music": "assets/track.mp3",  // optional: use a supplied track instead
    "offset": 0.42,               // seconds into the track where beat 1 is (tools/beatgrid.py)
    "lufs": -14
  },
  "scenes": [ /* see below */ ]
}
```

Every scene needs `type` and either `beats` (preferred) or `seconds`. Optional on all scenes: `transition` (`cut` default, `fade`, `blur`), `energy` (0–1, overrides the music arrangement), `backdrop` (`white`, `paper`, `grid`, `space`, `dark`, `accent`, `horizon`).

Text markup: `*word*` is set in the accent color. In `bracketTitle`, `[word]` and `(word)` become animated brackets.

## Scene types

| Type | Fields | What it does |
|---|---|---|
| `logo` | `backdrop` | The mark alone, settling in. Opener. |
| `typeTitle` | `text`, `sub`, `cps`, `typeDelay`, `font` (`sans`/`serif`), `size` | Headline typed on with a caret. |
| `bracketTitle` | `text`, `cps`, `footnote` | Kinetic brackets: `Go from [idea] to (launch)`. |
| `promptBox` | `prompt`, `placeholder`, `chips[]`, `model`, `zoomFrom`, `cps`, `send`, `sendPause`, `camera[]` | An AI prompt box: typed prompt, camera pull-back, cursor clicks send. |
| `uiShot` | `image`, `frame` (`window`/`none`), `windowTitle`, `camera[]`, `cursor[]` | A screenshot in a window with camera moves and a cursor. |
| `montage` | `items[]`, `pacing` (`accelerate`/`steady`/`decelerate`), `from`, `to` (shot length in beats), `mask` (`none`/`glyph`/`lens`/`horizon`), `glyph`, `overlay[]` | Beat-locked fast cuts through materials or images. |
| `cardGrid` | `items[]` | A tilted wall of cards drifting past (breadth shot). |
| `titleCard` | `text`, `sub`, `background` (`accent`/`paper`/`white`/`dark`/an item), `font`, `hit` | Held title with a focus-pull. Lands on an impact. |
| `logoEnd` | `tagline`, `footnote`, `backdrop` | Mark + wordmark, tagline, legal line. Holds. |

### Camera and cursor

`camera` is a list of keyframes `{t, x, y, zoom}`: `t` in seconds from the scene start, `x`/`y` the point (0–1 across the image) that sits at frame center, `zoom` 1 = whole window. Moves between keyframes ease in and out; repeat a keyframe to hold.

`cursor` is a list of `{t, x, y, click}` in the same image coordinates. The cursor drifts in before the first point, travels in an arc during the 0.7s before each point, and presses on `click`.

### Items (montage, cardGrid, titleCard background)

`{"image": "assets/plate.jpg"}` for your own imagery, or a built-in material: `{"material": "dots", "palette": "coral", "seed": 3}`.

Materials: `dots`, `halftone`, `stripes`, `rings`, `constellation`, `cutout`, `topo`, `blueprint`, `mosaic`, `cells`, `petals`, `waves`, `gradient`, `type`, `horizon`.

Palettes: `archive`, `botanical`, `ocean`, `ember`, `blueprint`, `violet`, `coral`, `teal`, `ink`, and horizon palettes `dawn`, `dusk`, `ice`, `forest`, `rose`. Or pass your own array; index 0 is the ground.

## Timing rules the timeline enforces

- Scene starts are on the beat grid when lengths are in beats.
- Montage shot lengths are quantized to 8, 4, 2, 1, ½ or ¼ beats.
- Sound events (key taps, clicks, pops, whooshes, cuts, the hit, the resolve) are generated from the scenes, so the score always matches the picture.
