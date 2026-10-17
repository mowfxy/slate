---
name: video-critic
description: Judge a rendered Slate video like an editor - run the automated critic, read the contact sheet against a taste rubric, and decide the next fix. Use after every full render and before delivering any video.
---

# The critic

Two passes: the machine measures, then you look. Both must pass before delivery.

## Pass 1: measure

`render.mjs` runs it automatically. To run alone:

```bash
python3 tools/critic.py out/<name>.mp4 --timeline examples/<name>/build/timeline.json --out examples/<name>/build/critic
```

It measures the rendered file, not the plan:

| Check | Fails when |
|---|---|
| Duration, size, fps | the render doesn't match the timeline |
| Cuts on the beat | < 85% of detected cuts are within a frame of the ¼-beat grid |
| Planned cuts are visible (warn) | soft cuts between similar frames; fine for title→title, bad inside a montage |
| The ending lands (warn) | busy cutting in the last 15% |
| Logo holds | logo < 2.5s |
| Every title is readable | typed titles hold < max(1s, words/4 + 0.4s) after the last letter; other titles < words/3 + 0.5s |
| Short lines (warn) | > 9 words in one scene |
| No black frames | any black gap mid-film |
| Nothing sits frozen (warn) | ≥ 2.5s without motion outside titles and logos |
| Loudness, peaks | outside ±1 LU of target, peak above −0.5 dBFS |
| Sound resolves (warn) | the last 0.25s is louder than −30 dBFS |

Exit code 1 on any failure. `report.md` also has the cut rhythm and loudness curve as text bars.

## Pass 2: look

Open `build/critic/contact.jpg` (and stills of any moment in doubt). Score each line 1–5 and write the scores down:

1. **One idea.** Could a stranger say what this film is about from the sheet alone?
2. **One focal point per frame.** Nothing competes with the subject; nothing important is cropped.
3. **Type.** Readable size, ≤ 7 words, balanced lines, nothing touching edges, no orphan punctuation.
4. **Rhythm.** Shots shorten into the peak and open up after it; the cut-rhythm bars show a shape, not noise.
5. **Color.** One accent in demos; a coherent palette in teasers; the title color comes from the film.
6. **Sound shape.** The loudness curve rises to the hit, dips for the title, resolves to quiet.
7. **The ending.** The logo sits on a quiet, uncluttered frame and holds; ideally it bookends the opening.

## Deciding the fix

- Fix the lowest score first, one or two changes per round, then re-render. Changing everything at once hides what worked.
- Prefer spec changes (beats, camera keys, items, text) over component changes.
- A failed readability check: add beats or cut words; never speed up typing past 28 cps.
- A weak montage: replace sparse materials, add a mask that repeats a shape, or shorten from 1→¼ to ½→¼ beats.
- Stop after 4 rounds. Deliver the best render and say plainly what is still below a 4 and why (usually missing real footage or real product screens).
