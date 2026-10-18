---
name: video-critic
description: Judge a rendered film like an editor, whatever engine made it - run Slate's critic (sync, readability, layout, loudness, originality against the reference films) and cinetic's pixel forensics, spec probe and A/V audit, score the contact sheet against a taste rubric, and decide the next fix. Use after every full render and before delivering any video, or when asked to review or critique one.
---

# The critic

Two passes: the machine measures, then you look. Both must pass before delivery.

## Pass 1: measure

`${CLAUDE_PLUGIN_ROOT}/engine/render.mjs` runs it automatically. To run alone:

```bash
python3 ${CLAUDE_PLUGIN_ROOT}/tools/critic.py out/<name>.mp4 --manifest films/<name>/build/manifest.json --out films/<name>/build/critic
```

It measures the rendered file, not the plan:

| Check | Fails when |
|---|---|
| Duration, size, fps | the render doesn't match the manifest |
| Cuts on the beat | < 85% of detected cuts are within a frame of the ¼-beat grid |
| Planned cuts are visible (warn) | soft cuts between similar frames; fine for title→title, bad inside a montage |
| The ending lands (warn) | busy cutting in the last 15% |
| Form is chosen (warn) | the film's notes don't say its `form` and `sound` |
| Not the trailer habit (warn) | cuts accelerate into the end and the music stops before the logo, and the notes don't say `form: 'trailer'` |
| Logo holds | the last `logo` scene is < 2.0s |
| End card is not a drag (warn) | the last `logo` scene is > 5.0s |
| Every line is readable | a scene is up for less than max(1.2s, words/3.5 + 0.6s) for its `words` |
| Short lines (warn) | > 9 words in one `type` scene |
| No black frames | any black gap mid-film |
| Nothing sits frozen (warn) | ≥ 2.5s without motion outside titles and logos |
| No flashes | No frame unlike both neighbours while they agree (a stale or wrong frame: a clip that seeked badly, a blank subframe) |
| Smooth motion | At most 2 repeated frames inside motion (6+ fails): dropped updates read as stutter |
| Real music (warn) | The film uses its own composed `score.py`, a real track (`F.music({composed})` or `F.music({track})`, see `sound-design`) or the `room` style, not the draft scorer |
| Loudness, peaks | outside ±1 LU of target, peak above −0.5 dBFS |
| Sound resolves (warn) | the last 0.25s is louder than −30 dBFS |
| Type placement | any visible word outside title-safe (6%), cut off by the frame, over a picture (img, video, canvas) without `data-over`, on top of other words, or under 18px. From the renderer's layout audit (`build/layout.json`, sampled 6× a second) |
| Original (not a reference) | > 5% of informative frames, or 3 within any 2s, match a reference frame on layout and palette at once |

The originality check compares against the bundled fingerprints of the five reference films (`${CLAUDE_PLUGIN_ROOT}/skills/video-critic/references/fingerprints.json`), plus the project's own `references/fingerprints.json` and any files in `$SLATE_REFS`: hashes and color histograms, not the films themselves. Keep your references in the project, where a plugin update can't wipe them. It reliably catches visual copies (it flags 29% of an early Slate film that rebuilt reference shots). It cannot catch a copied *concept* drawn in new pixels; that is what the concept gate in `launch-video` and the list in `video-taste/references/do-not-copy.md` are for. To add references: `python3 ${CLAUDE_PLUGIN_ROOT}/tools/originality.py fingerprint new.mp4 --names my-ref --out references/fingerprints.json`.

Exit code 1 on any failure. `report.md` also has the cut rhythm and loudness curve as text bars.

### Pass 1b: pixels and spec (any MP4, from cinetic)

The critic samples the film; these look at every frame. Run them on every render you'd show anyone, Slate or cinetic (`C=${CLAUDE_PLUGIN_ROOT}/skills/cinetic/scripts`):

```bash
python3 $C/probe.py out/<name>.mp4 --spec 1920x1080@60 --dur <s>                 # size, fps, duration ±1 f, yuv420p, BT.709, AAC 48k
python3 $C/forensics.py out/<name>.mp4 --cuts <frames> --json out/qa/forensics.json   # pops, stalls, frozen holds, ghosts, judder, banding, seams
python3 $C/sheet.py out/<name>.mp4 --chunks 4 --rate 12 --out out/qa/sheet.png       # labelled contact sheets; add --width 480 for a phone-size legibility sheet
bash $C/grab.sh out/<name>.mp4 <frame>…                                           # exact frames at full size
```

Declare designed cuts with `--cuts` and designed freezes with `--freeze-ok` so they aren't flagged; add `--loop` for a loop's seam. A cinetic film adds `av-audit.py` against its `out/cues.json` (onsets per stem, clicks, tail). Every `fail` is a ship blocker; read each `warn` at full size.

## Pass 2: look

Open `build/critic/contact.jpg` (and stills of any moment in doubt). Score each line 1–5 and write the scores down:

1. **One idea.** Could a stranger say what this film is about from the sheet alone? Is it this product's idea, or could any logo go at the end?
2. **Original.** Does any frame or move recall a reference film's signature (see `do-not-copy.md`)? Any yes is a 1.
3. **One focal point per frame.** Nothing competes with the subject; nothing important is cropped.
4. **Image quality.** The product live in the film (or real footage where it can't be rebuilt), never screenshots sliding around. Full contrast on UI, light and depth from the UI itself, every label whole in frame; nothing looks like flat boxes on flat color. No banned look (`video-taste` §0) unless the brand supplied it.
5. **Type and layout.** The brand's typefaces, readable size, ≤ 7 words. Every line sits on the film's grid: the same axis and baseline each time it appears, never on top of a busy picture, never jammed against UI, never off-center by accident. The layout check catches collisions; you judge the composition.
6. **Pace.** The cut-rhythm bars show the shape the form promised (even, slowing, or rising for a trailer), with varied shot lengths, not noise. Every shot is held as long as its content needs and no longer. Nothing is rushed at the end unless that is the point.
7. **Sound.** The ensemble fits the product's voice, and the notes say why. The loudness curve has the chosen shape. Foley sits under the music. The last second sounds decided: a ring, a phrase ending, a button, a fade or the room, not the default. Would a music supervisor pick this for this product?
8. **The ending.** The logo sits on a quiet, uncluttered frame and holds, and answers the opening.

## Deciding the fix

- Fix the lowest score first, one or two changes per round, then re-render. Changing everything at once hides what worked.
- A failed readability check: give the scene more beats or cut words.
- A failed layout check: move the words to the film's grid (a matte bar, a clean side of the frame, their own card), don't shrink them. `node ${CLAUDE_PLUGIN_ROOT}/engine/render.mjs films/<name> --audit` re-checks in seconds.
- Static-looking shots: rebuild the product live in the page and drive it from the timeline (`film-engine`, Live product); record with `${CLAUDE_PLUGIN_ROOT}/engine/record.mjs` only what can't be rebuilt.
- A failed originality check: the critic names the reference and the time. Redesign that shot (composition and palette), don't just nudge it.
- Flat or cheap-looking frames: add depth from the UI itself (a shadow that grows as things lift, a 1px edge, a ground one step off white) and a stronger idea before adding more things. Never a glow, and no grain or vignette over UI.
- A film that feels generic usually has the trailer form by habit: change the form and the sound before touching any frame.
- A second opinion: cinetic's critic lenses (`${CLAUDE_PLUGIN_ROOT}/skills/cinetic/assets/critics/`: director, art/copy/UI, sound-sync, forensics, verifier) work on any film's sheets. Run the director and art lenses at least once on a launch film, then the verifier on every P0 and P1 (drop an issue that is wrong, invisible at normal speed, or whose fix would make things worse).
- **Severity:** P0 is visible on the hook, the payoff or the logo, or breaks the story; P1 is noticeable on a normal viewing; P2 only when paused. Ship with no open P0, no failing script, and every rubric line at 3 or more.
- Stop after 5 rounds. Deliver the best render and say plainly what is still below a 4 and why.
