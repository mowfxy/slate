---
name: sound-design
description: Score, sound effects and mastering for Slate films - choosing the sound from the product and the film's form, four produced styles on sampled instruments (groove, pluck, cinema, bright) plus eight sketch styles, five endings, using a supplied track on the beat grid, foley cues, and loudness targets per platform. Use when choosing music, placing sound cues, fixing sync, or when a render sounds wrong.
---

# Sound design

Sound is half the film. `tools/score.py` reads `build/manifest.json` and writes `music.wav`, `sfx.wav` and the mastered `mix.wav`. `engine/render.mjs` runs it while frames render.

## Choosing the sound

Decide in this order, and write each answer in `F.notes({sound})`:
1. **What does the product sound like?** Its clicks, keys, pages, shutter, notification. If those sounds can carry the film, use `room` and no music.
2. **What does the film's form need?** (See `video-taste` §3.) A take wants one steady instrument; a settle wants a score that thins out; a slow reveal wants a swell with no rhythm; only a trailer wants a build and a stop.
3. **Which ensemble, and why this one?** Never reuse the last film's style and ending without a reason.
4. **Would it sit next to the references?** Launch films and ads are scored with produced music: recorded instruments, a real low end, mastered loud. A lone piano or a room tone sounds like a demo next to them. Reach for a produced style first; use a sketch style only when the film is deliberately quiet and someone asked for that.

## What produced launch music measures like

Measured from five professional launch films and ads (share of energy per band):

| Band | Sub <60 Hz | Low 60–150 | Low-mid 150–500 | Mid 500–2k | Presence 2–6k |
|---|---|---|---|---|---|
| Range across the five | 10–60% | 4–33% | 14–35% | 10–36% | 2–5% |

- **There is always a sub.** At least a tenth of the energy sits below 60 Hz: an 808, a sub drone, a bass drum. Below 2% reads as thin, however good the notes are.
- **Tempo 89–136 BPM**, in a major key or a warm minor; integrated loudness −13 ± 1.5 LUFS.
- **The texture is a bed plus a lead**: a pad or section underneath, one recognisable lead on top (vibes, plucks, harp, piano), drums or pulse in the middle.
- **It keeps going.** None of the five stops dead before the logo; they swell, resolve and ring.

## The generated score

Set it in the film with `F.music({key, style, arc, end})`. Tempo is the film's `bpm`. Each style is its own ensemble and its own way of moving.

### Produced styles (default)

Played on sampled instruments through FluidSynth (`tools/arrange.py`, `tools/sampler.py`), with synthesized 808 kicks, subs, risers and booms, sidechained to the kick and balanced to the band shares above. They need `fluidsynth` and a General MIDI SoundFont (`apt install fluidsynth musescore-general-soundfont-lossless`, or set `SLATE_SOUNDFONT`); without one each falls back to its nearest sketch style and says so.

| Style | Ensemble | Moves by | For |
|---|---|---|---|
| `groove` | Warm pad, electric piano, 808 kick and sub, claps on 2 and 4, hats; landings on vibraphone | EP chords become swung stabs, hats go to sixteenths as energy rises | Everyday products, apps, ads with a pocket. 88–100 BPM |
| `pluck` | Harp and celesta arpeggios over a sub drone and a string section; timpani, then kick and shaker | Arpeggio goes from eighths to sixteenths; strings swell | Teasers, big reveals, wonder. 120–140 BPM |
| `cinema` | Strings, basses, oohs, celli pulsing in eighths, horns, deep drums on hits | The section swells, the pulse and horns enter | Brand films, stories, something serious. 70–100 BPM |
| `bright` | Strings, piano eighths, fingered bass, a full kit | Builds by layers, stays light | Optimistic consumer launches. 100–124 BPM |

### Sketch styles (synthesized)

Quieter, thinner, self-contained. Use when a film is meant to feel small or when no SoundFont is installed.

| Style | Sound | Moves by | For |
|---|---|---|---|
| `solo` | One felt piano, rubato: a rolled left hand a hair late, a melody in breaths, a rest every fourth phrase | Touch and density; never adds instruments | Personal, considered, crafted products. 60–90 BPM |
| `strings` | A bowed chorale: cello on the root, three voices that move to the nearest note | The bow: it swells and recedes. No rhythm | Serious, premium, a story, a slow reveal. 60–80 BPM |
| `tape` | Electric piano comping on a swung grid, a round bass, brushes, all through worn tape | A groove in one gear; a kick and a walk-up appear when energy is up | Everyday, relaxed, consumer, call-and-response demos. 80–96 BPM |
| `wood` | Marimba ostinato accented 3+3+2, a low bar, a shaker when it lifts | Accents only when quiet, the full figure when up | Playful, light, handmade. 100–124 BPM |
| `felt` | Felt piano, a warm pad, a sub, brushes and a soft kick at high energy | Layers enter as energy rises | Calm, human products. 70–95 BPM |
| `glass` | Bell plucks over a bright pad | Layers enter as energy rises | Precise tools. 90–110 BPM |
| `pulse` | Minor pulse, kick on every beat, claps at the peak | Layers enter as energy rises | Trailers, ads that want energy. 115–135 BPM |
| `room` | No music. Foley and room tone only | The film's own actions | When the product's own sounds are the best score |

- **`gain`** sets the music against the foley (default 1). Lower it when the product's own sounds lead, so the film doesn't jump in level when the music enters.
- **`room`** raises the room tone (default 1) and adds air, for films where stretches have no music. Long stretches of near silence read as broken audio; a lived-in room reads as a choice.
- **The arc** (`[[t, energy], ...]`, 0–1) is the score's dynamics. It doesn't have to rise to the end: a flat arc is a steady score, a falling arc is a settle, a hump is a swell that recedes.
- **The ending** (`end`) is chosen per film. It plays from the `resolve` cue:

| `end` | What happens | Feels like |
|---|---|---|
| `ring` | A rolled chord on the style's own instrument rings out | Arrival, warmth |
| `phrase` | The music finishes its phrase on the cue; nothing added, the room rings | Understatement, confidence |
| `button` | The music stops on the cue with one short note in octaves | Wit, a full stop |
| `fade` | The music plays on under the end card and fades over `fadeLen` seconds (default 3) | It continues without you |
| `cut` | The music stops dead on the cue; only room tone after | Starkness, a held breath that isn't let out |

  Without a `resolve` cue the ending is always `fade`.
- **`drop`** stops the music dead until the next `thud` or `hit`, while the room keeps ringing. It is a trailer device: use it only when the form calls for it, and never as the default lead-in to the logo.
- **`land`** and **`hit`** play on the style's own instrument (vibes, celesta, harp, glockenspiel; piano, marimba, Rhodes, bells, strings in the sketch styles), so a landing belongs to the score. A `land` cue's `i`/`n` picks its pitch from the scale: rising `i` makes a run of landings into a melody.
- The mix gets a convolution room (larger for `solo` and `strings`), glue compression, a soft clip, and two-pass loudness normalization, then a true-peak limiter so sharp transients don't clip once encoded.

## Foley cues

| Cue | Sound | Use for |
|---|---|---|
| `rustle` (`len`) | paper crinkle and air | paper, fabric, many things moving |
| `land` | paper tap plus a piano note | anything settling into place |
| `thud` (`soft`) | low bloom plus a tap | something heavy arriving, the end of a drop |
| `swell` (`len`) | rising air | the build into a moment (sparingly) |
| `whoosh` (`len`) | panned air | fast moves across the frame |
| `flip` | a flick | cards and pages turning |
| `clap` | a clapperboard: two hardwood strikes and a dry crack | two things meeting hard on the beat |
| `click`, `key`, `tick`, `pop`, `glint` | UI clicks, keys, wood ticks, a bell sparkle | UI actions, small details |

Footage carries its own sounds: `F.cueClip(clip, at, {from})` puts every key press and click recorded by `engine/record.mjs` on the frame where it plays.

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
- The critic's loudness curve should have the shape you chose: steady for a take, falling for a settle, a hump for a swell.
- Compare the band shares with the table above (`python3 tools/critic.py` prints them). Under 2% below 60 Hz is thin; over 70% below 150 Hz is muddy.
- Tell the person plainly that you checked the sound by measurement and that they should listen.
