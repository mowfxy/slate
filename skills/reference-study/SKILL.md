---
name: reference-study
description: Learn a visual and sonic style from example videos someone shares (competitor launches, films they love, their past videos) and turn it into notes the director can follow. Use when given reference videos or asked to match a look.
---

# Study references

Taste grows from examples. When someone shares videos they like, measure them, look at them, and write down what to steal.

## 1. Measure

```bash
python3 tools/analyze_reference.py ref1.mp4 ref2.mp4 --out references/<project>
```

For each video this writes `analysis.md` (format, cuts, shot rhythm, loudness, energy per second, tempo, cuts on musical onsets), `analysis.json` and a timestamped `sheet.jpg`, plus a `summary.md` table across all of them. Tempo needs librosa.

## 2. Look

Open every `sheet.jpg`. For moments that matter (title reveals, transitions, the end), pull dense frames:

```bash
ffmpeg -ss 7 -t 4 -i ref.mp4 -vf "fps=6,scale=320:-1,tile=6x4" burst.jpg
```

## 3. Write the notes

Fill in the Notes section of each `analysis.md`:

- **The one idea** in five words.
- **Structure:** where it breathes, builds, peaks and lands (use the energy bars).
- **Type:** family, weight, size relative to frame, how it enters and leaves.
- **Motion:** camera behavior, the repeated shape, transitions.
- **Color:** the palette (pick hexes from frames with `ffmpeg -ss t -i ref.mp4 -frames:v 1 -vf scale=1:1 -f rawvideo -pix_fmt rgb24 - | xxd`).
- **Sound:** tempo, layers, where it drops, how it ends, loudness.
- **Steal this:** the two or three moves worth reusing, each mapped to a Slate scene type or a new component.

Then write a short `references/<project>/style.md` that the director reads alongside `video-taste`. Where it conflicts with the general guide, the project style wins.

## 4. Rights

References are for learning structure, pacing and craft. Never reuse their footage, music, logos or exact copy. If a move needs a new component, build it (see `remotion-kit`).
