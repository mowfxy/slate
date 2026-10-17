---
name: sound-design
description: Score, sound effects and mastering for Slate videos - the generated score from the edit, using a supplied music track on the beat grid, SFX events, and loudness targets per platform. Use when choosing music, fixing sync, or when a render sounds wrong or too quiet.
---

# Sound design

Sound is half the film. In Slate the score is derived from the edit: `tools/score.py` reads `build/timeline.json` and writes `music.wav`, `sfx.wav` and the mastered `mix.wav`. `render.mjs` runs it for you.

## The generated score

- **Tempo** = `meta.bpm`. **Key** = `audio.key`. **Style** = `audio.style`:
  - `glass`: major-seventh pads, plucked arpeggio, soft kick only at high energy. For demos and calm confidence. 90–100 BPM.
  - `pulse`: minor pulse, kick on every beat, offbeat hats, claps on 2 and 4 at the peak. For teasers and ads. 118–136 BPM.
- **Arrangement follows scene `energy`** (defaults per scene type; override per scene). Layers enter as energy rises: pad → arpeggio → bass → kick → hats → claps.
- **Hits:** every `titleCard` gets a riser over the 4 beats before it, half a beat of rhythm drop-out, then an impact and a bell chord. Set `"hit": false` to skip.
- **Resolve:** `logoEnd` gets a ringing tonic chord; everything else stops. The last 0.35s fades to silence.

## SFX from the edit

| Event | From | Sound |
|---|---|---|
| `key` | every typed character | soft key tap, randomized |
| `click` | promptBox send, `cursor` points with `click` | mouse click |
| `pop` | each bracket pair appearing | small rising blip |
| `whoosh` | camera moves with a big zoom or pan, cardGrid entrance | filtered air, panned |
| `cut` | montage cuts | a very quiet tick |

To make the film quieter or busier, change energies and events in the spec, not the WAV.

## Using a real track

1. `python3 tools/beatgrid.py track.mp3` prints the BPM and the first downbeat.
2. Put `"bpm"` in `meta` and `"music"` / `"offset"` in `audio`. Write all scenes in beats.
3. Render. SFX are still generated and mixed on top; the track is faded over the last second.
4. Confirm sync in the critic: cuts on the beat should stay ≥ 90%.

Licensed or generated music only. Never pull a song from a video you were shown as a reference.

## Mastering targets

| Destination | Integrated | True peak |
|---|---|---|
| Web, YouTube, product pages (default) | −14 LUFS | −1 dBTP |
| Instagram, TikTok, X feeds | −13 to −12 LUFS | −1 dBTP |
| Presentation / keynote playback | −16 LUFS | −1 dBTP |

Set `audio.lufs` or pass `--lufs` to `score.py`. The reference films measure −11.6 to −16.4 LUFS.

## When it sounds wrong

- **Mushy:** too many layers at once; lower `energy` on UI scenes to 0.4–0.5.
- **Typing too loud:** raise `cps` (fewer, faster taps) or reduce the key gain in `sound_design()`.
- **Hit doesn't land:** make sure the scene before the `titleCard` has higher energy than the card, and the card starts on a bar line (beat count divisible by 4 from the start).
- You cannot listen, so look: `ffmpeg -i build/mix.wav -lavfi showspectrumpic=s=1400x400 spec.png` shows layers, risers, hits and the tail.
