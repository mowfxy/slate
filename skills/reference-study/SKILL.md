---
name: reference-study
description: Learn principles from example videos someone shares (competitor launches, films they love, their past videos): measure them, write down why they work and what is theirs alone, and fingerprint them so renders never copy them. Use when given reference videos or asked to match a look.
---

# Study references

Taste grows from examples, but a film that copies its examples has no taste. When someone shares videos they like, measure them, look at them, and write down why they work, which is the part you can reuse.

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
- **Why it works:** the two or three principles underneath (for example "one fixed shape lets fast cuts read"), never the moves themselves.
- **Signature moves:** the things only this film does. These go on the do-not-copy list.

Then write a short `references/<project>/style.md` that the director reads alongside `video-taste`: the principles to apply, and the signature moves to avoid. Where it conflicts with the general guide, the project style wins.

## 4. Protect against copying

Fingerprint the references so the critic flags renders that come too close:

```bash
python3 tools/originality.py fingerprint ref1.mp4 ref2.mp4 --names client-ref-1 client-ref-2 --out skills/video-critic/references/fingerprints.json
```

Add each film's signature moves to `skills/video-taste/references/do-not-copy.md`.

## 5. Rights

References are for learning structure, pacing and craft. Never reuse their footage, music, logos, copy or signature moves. Fingerprints and written notes can be kept; the films themselves should not be committed.
