---
name: video-critic
description: Judge a rendered Slate film like an editor - run the automated critic (sync, readability, loudness, originality against the reference films), score the contact sheet against a taste rubric, and decide the next fix. Use after every full render and before delivering any video.
---

# The critic

Two passes: the machine measures, then you look. Both must pass before delivery.

## Pass 1: measure

`engine/render.mjs` runs it automatically. To run alone:

```bash
python3 tools/critic.py out/<name>.mp4 --manifest films/<name>/build/manifest.json --out films/<name>/build/critic
```

It measures the rendered file, not the plan:

| Check | Fails when |
|---|---|
| Duration, size, fps | the render doesn't match the manifest |
| Cuts on the beat | < 85% of detected cuts are within a frame of the ¼-beat grid |
| Planned cuts are visible (warn) | soft cuts between similar frames; fine for title→title, bad inside a montage |
| The ending lands (warn) | busy cutting in the last 15% |
| Logo holds | the last `logo` scene is < 2.5s |
| Every line is readable | a scene is up for less than max(1.2s, words/3.5 + 0.6s) for its `words` |
| Short lines (warn) | > 9 words in one `type` scene |
| No black frames | any black gap mid-film |
| Nothing sits frozen (warn) | ≥ 2.5s without motion outside titles and logos |
| Loudness, peaks | outside ±1 LU of target, peak above −0.5 dBFS |
| Sound resolves (warn) | the last 0.25s is louder than −30 dBFS |
| Type placement | any visible word outside title-safe (6%), cut off by the frame, over a picture (img, video, canvas) without `data-over`, on top of other words, or under 18px. From the renderer's layout audit (`build/layout.json`, sampled 6× a second) |
| Original (not a reference) | > 5% of informative frames, or 3 within any 2s, match a reference frame on layout and palette at once |

The originality check compares against `references/fingerprints.json`: hashes and color histograms of the five reference films, not the films themselves. It reliably catches visual copies (it flags 29% of an early Slate film that rebuilt reference shots). It cannot catch a copied *concept* drawn in new pixels; that is what the concept gate in `launch-video` and the list in `video-taste/references/do-not-copy.md` are for. To add references: `python3 tools/originality.py fingerprint new.mp4 --names my-ref --out skills/video-critic/references/fingerprints.json`.

Exit code 1 on any failure. `report.md` also has the cut rhythm and loudness curve as text bars.

## Pass 2: look

Open `build/critic/contact.jpg` (and stills of any moment in doubt). Score each line 1–5 and write the scores down:

1. **One idea.** Could a stranger say what this film is about from the sheet alone? Is it this product's idea, or could any logo go at the end?
2. **Original.** Does any frame or move recall a reference film's signature (see `do-not-copy.md`)? Any yes is a 1.
3. **One focal point per frame.** Nothing competes with the subject; nothing important is cropped.
4. **Image quality.** Real moving footage (recorded UI, filmed or generated video), not screenshots sliding around. Light and depth, material, grain; nothing looks like flat boxes on flat color.
5. **Type and layout.** The brand's typefaces, readable size, ≤ 7 words. Every line sits on the film's grid: the same axis and baseline each time it appears, never on top of a busy picture, never jammed against UI, never off-center by accident. The layout check catches collisions; you judge the composition.
6. **Rhythm.** Shots shorten into the peak and open up after it; the cut-rhythm bars show a shape, not noise.
7. **Sound shape.** The loudness curve rises to the hit, dips for the title, resolves to quiet.
8. **The ending.** The logo sits on a quiet, uncluttered frame and holds, and answers the opening.

## Deciding the fix

- Fix the lowest score first, one or two changes per round, then re-render. Changing everything at once hides what worked.
- A failed readability check: give the scene more beats or cut words.
- A failed layout check: move the words to the film's grid (a matte bar, a clean side of the frame, their own card), don't shrink them. `node engine/render.mjs films/<name> --audit` re-checks in seconds.
- Static-looking shots: record real footage of the product with `engine/record.mjs` instead of animating a screenshot.
- A failed originality check: the critic names the reference and the time. Redesign that shot (composition and palette), don't just nudge it.
- Flat or cheap-looking frames: add light (a glow, shading), depth (blur by distance, real shadows), material (texture, grain) before adding more things.
- Stop after 4 rounds. Deliver the best render and say plainly what is still below a 4 and why (usually missing real footage or a real music track).
