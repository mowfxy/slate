---
name: sound-design
description: Score, sound effects and mastering for Slate films - the generated score that follows the film's energy arc and cues, using a supplied track on the beat grid, foley cues, and loudness targets per platform. Use when choosing music, placing sound cues, fixing sync, or when a render sounds wrong.
---

# Sound design

Sound is half the film. `tools/score.py` reads `build/manifest.json` and writes `music.wav`, `sfx.wav` and the mastered `mix.wav`. `engine/render.mjs` runs it while frames render.

## The generated score

Set it in the film with `F.music({key, style, arc})`. Tempo is the film's `bpm`.

| Style | Sound | For |
|---|---|---|
| `felt` | Felt piano (stretched partials, unison strings, hammer), a warm analog pad, a sub, brushes and a soft kick at high energy | Calm, human products: study, writing, notes, wellbeing. 70–95 BPM |
| `glass` | Bell plucks over a bright pad | Precise tools, developer products, demos. 90–110 BPM |
| `pulse` | Minor pulse, kick on every beat, claps on 2 and 4 at the peak | Ads, teasers, energy. 115–135 BPM |

- **The arc** (`[[t, energy], ...]`, 0–1) drives the arrangement. Below 0.3 the piano is sparse. Rhythm enters above 0.55. The pad's filter opens with energy. Without an arc, scene energies are used.
- **`drop`** stops the music dead until the next `thud` or `hit`, while the room keeps ringing. Use it once, before the film's biggest moment.
- **`land`** cues play piano notes up a pentatonic scale (`i` of `n` picks the step). A cascade of landings becomes a rising run. `soft: true` for small things.
- **`resolve`** plays a rolled open chord and a low tail over the logo. The last 0.6s fades to silence.
- The mix gets a two-band convolution room, kick sidechain on the pad, glue compression, a soft clip, and two-pass loudness normalization.

## Foley cues

| Cue | Sound | Use for |
|---|---|---|
| `rustle` (`len`) | paper crinkle and air | paper, fabric, many things moving |
| `land` | paper tap plus a piano note | anything settling into place |
| `thud` (`soft`) | low bloom plus a tap | something heavy arriving, the end of a drop |
| `swell` (`len`) | rising air | the build into a moment |
| `whoosh` (`len`) | panned air | fast moves across the frame |
| `flip` | a flick | cards and pages turning |
| `click`, `key`, `tick`, `pop`, `glint` | UI clicks, keys, wood ticks, a bell sparkle | UI actions, small details |

Put cues on the exact frame of the contact (the end of a landing tween, not its start). The score never guesses.

## Using a real track

1. `python3 tools/beatgrid.py track.mp3` prints the BPM and the first downbeat.
2. Use that BPM in `film({bpm})` and write the film in beats.
3. Render with `--music track.wav`. Foley is still generated and mixed on top.

Use licensed or generated music only. Never pull a song from a video you were shown as a reference.

## Mastering targets

| Destination | Integrated | True peak |
|---|---|---|
| Web, YouTube, product pages (default) | −14 LUFS | −1 dBTP |
| Instagram, TikTok, X feeds | −13 to −12 LUFS | −1 dBTP |
| Presentation playback | −16 LUFS | −1 dBTP |

## Checking without ears

You can't listen, so look and measure:
- `ffmpeg -i build/mix.wav -lavfi showspectrumpic=s=1600x500:scale=log:fscale=log spec.png` shows the layers, the drop (a vertical gap), the landings and the tail.
- The critic's loudness curve should rise into the peak, dip at the drop, and fall to quiet at the end.
- Too much energy below 200 Hz across the whole film means it's muddy: lower the arc or the bass.
- Tell the person plainly that you checked the sound by measurement and that they should listen.
