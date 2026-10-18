---
name: launch-video
description: Direct any product video made from code - launch film, feature announcement, teaser, ad, product demo, landing-page loop, logo sting, UI walkthrough, social cut or changelog clip - from reading the product, through three original concepts, a drawn technique plan and style frames, to a rendered, scored, measured and critic-passed MP4. Use whenever someone asks for a video, promo, ad, animation, motion graphic or animated demo of a product, even if they only say "make a video about X" or "animate this feature". Chooses between the Slate engine (HTML/GSAP, the product rebuilt live) and the cinetic engines (Remotion or HyperFrames).
---

# Direct a product film

You are the director. The output is a finished MP4 that passed the gates, the film's source, and two sentences on the idea. Most of the quality is decided before any rendering.

This plugin holds two proven toolkits. Use the best of both: the idea and the QA always come from both, the engine from one.

- **Slate** (this plugin's root, `${CLAUDE_PLUGIN_ROOT}`): a film is an HTML page on one paused GSAP timeline, the product rebuilt live in it, rendered frame by frame at 60 fps with declared motion blur, scored on `tools/synth.py`, judged by `tools/critic.py` with an originality check. Skills: `film-engine`, `sound-design`, `video-critic`, `reference-study`, `video-taste`.
- **cinetic** (`${CLAUDE_PLUGIN_ROOT}/skills/cinetic`): Remotion (React) or HyperFrames (HTML/GSAP) from a starter, a 273-entry technique library, a lint for generated-look tells, one `timeline.ts` beat grid with fragment-chain copy, the earshot sound kit, optical-flow motion blur, pixel forensics, an A/V audit, delivery (alpha, GIF, WebM, social re-layouts) and a brand kit. Skill: `cinetic`.

Below, `$S` means `${CLAUDE_PLUGIN_ROOT}` and `$C` means `${CLAUDE_PLUGIN_ROOT}/skills/cinetic`. Films live in the person's project (`films/<name>/`), never inside the plugin.

## 0. Intake → `BRIEF.md`

- If the brief states the product, the message and the length, infer the rest and write the assumptions down. Otherwise ask at most three questions: the product in one line, the format and length, where it will be shown.
- If no assets were given, ask for the product's site or repo instead of inventing a UI.
- Pick the format row (`video-taste` §9, or `$C/references/formats.md`), the pace (calm by default, crisp only when the brief asks for energy), and the engine (below).
- Write a spec line, for example `1920x1080@60, 30s, 100BPM, pace: calm, engine: slate, sound: composed`, then the house bans (`video-taste` §0) with any brand-supplied exceptions. Critics are prompted with this file word for word.

### Choosing the engine

| Use | When |
|---|---|
| **Slate** (default) | A product with a UI you can rebuild or embed (web apps, sites, dashboards, dev tools); one continuous take with the camera doing the editing; a composed electronic score; a film that must be checked against reference films. Runs natively on Windows, macOS and Linux with Node, Python and ffmpeg; no render licence |
| **cinetic, Remotion** | A logo sting with ProRes 4444 alpha versions; a seamless landing-page loop with GIF and WebM; a UI walkthrough with SRT captions; 9:16 and 1:1 re-layouts from one timeline; the person's React components to reuse; an existing Remotion project; an invented brand that needs a full brand kit. Needs bash (on Windows: Git Bash or WSL) and Node 22+. Remotion needs a company licence from 4 people |
| **cinetic, HyperFrames** | An existing HyperFrames project, or `--batch` renders driven by variables |

Say which engine and why in one line of `BRIEF.md`. Then load that engine's skill (`film-engine` or `cinetic`) when you reach the build.

Setup, once per machine: `cd $S/engine && npm install` and `python3 -m pip install -r $S/requirements.txt` for Slate (Node 20+, Python 3.10+, ffmpeg, a Chromium: `npx playwright-core install chromium-headless-shell`, or set `SLATE_CHROME`); `$S/docs/cinetic-setup.md` for cinetic. On Windows, if `python3` is not the interpreter with the packages, set `PYTHON` to it.

## 1. Study the product

Load `video-taste` first. Read everything you can: the site, the README, the app itself, the brand kit. Write down:
- **The promise** in the product's own words, and what the name means or evokes.
- **The smart part:** finish "unlike the obvious version, it…". The film shows that, not a feature tour.
- **Its material:** the nouns of its UI, its logo's shape, fonts, colours, the feeling of using it.
- **The tension it resolves** for its user.
- **Real assets:** screenshots (fresh, at 2x if you can run it), fonts with their licence, logo SVG, photos.

## 2. Three concepts, gated

Write three, each through a different lens: (a) the product's own verb or metaphor made literal, (b) the viewer's pain made visible, (c) a formal device (a relay object, a bookend, one unbroken camera move, a container that becomes the product). Each states:
- **Idea** in one sentence (logline ≤ 15 words), and **why only this product**.
- **The device:** the one object that travels through every shot (ideally resolving into the mark), and **the move** repeated at every scale.
- **Form and pace curve** (`video-taste` §3), **first frame, last frame and last second**.
- **Sound:** what the product itself sounds like, the ensemble or kit and why, the ending.

Make them differ in form and sound, not only imagery. Then gate them, writing each rejection reason:
1. Its central image or main transition is on `video-taste/references/do-not-copy.md` (or the project's `references/style.md`), or the same move in new clothes.
2. It still works with a competitor's logo at the end.
3. **Specificity:** it would be just as true of a simpler product. **Deletion:** remove the demo beats and the value still reads; remove the value beats and it should stop working, or it was a feature tour. **Feature word:** muted, a stranger would use the brief's word for the feature.
4. The trailer form by habit, unless the occasion is a loud launch and you can say why calmer forms would undersell it.

Pick the strongest survivor. If the person is around, show them the three; otherwise pick and keep going.

## 3. Draw the techniques; don't choose them

Left to choose, every film converges on the same fade-up, push-in and end card. Draw instead, whatever the engine:

```bash
python3 $C/scripts/pick.py --format <launch|feature|loop|sting|walkthrough|vertical> --energy <calm|medium|high> --seconds <len> --json out/qa/picks.json
```

Build the picks the concept can carry, retold in its own objects. The recipes are written for cinetic's `timeline.ts`; on Slate translate frames to `F.b()` beats and eases to GSAP (`$C/references/motion-tokens.md` lists the beziers, which GSAP takes as `CustomEase` or the nearest `power`/`expo`). Reroll a pick that fights the concept at most twice (`--category <cat> --exclude <id>`) or drop it with a written reason; never add a move the draw didn't give you. Pass `--brand-supplied <look>` when the brand owns a banned look. Read one entry in full with `pick.py --show <id>`.

Write the treatment: on cinetic, `assets/TREATMENT.md`; on Slate, `F.notes({idea, motif, form, sound, rejected, picks})` plus a beat sheet (bar | time | picture | copy fragment | sound) at the top of `film.js`. Copy is planned as fragment chains (`video-taste` §5).

## 4. Brand and style frames

- **Supplied brand:** it wins. Its fonts, colours, voice and any banned look are used as given and recorded in `BRIEF.md`.
- **Invented brand:** follow cinetic Step 2 (`$C/references/brand-and-color.md`): three personality adjectives drive the typeface, stage, accent and motion character; `python3 $C/scripts/palette.py --accent '#…' --stage dark|light` builds the neutrals and refuses a banned hue; sketch 6–10 mark directions on one sheet, run the 64 px misread test, set the lockup like a typographer.
- Build the opening, the peak, a product moment and the ending as stills before any motion. Slate: `node $S/engine/render.mjs films/<name> --stills 1,9,22,48`. cinetic: `npx remotion still`. Judge them against `video-taste` §7. They are cheap; renders are not.

## 5. Put the product in the film

The proof is the product moving. Default: **live in the film** (Slate `film-engine` › Live product; cinetic `references/product-ui.md`): its real UI rebuilt in the page, fed by one data module whose numbers agree with the story in every frame, driven by the timeline, so the camera can sit at 3× on one control and stay sharp. Record only what you can't rebuild (`$S/engine/record.mjs`, `termcast.mjs`). Filmed or licensed footage for people and places. Never generate the product's UI, and never fake a demo with a sliding screenshot; if nothing real can be shown, say so.

## 6. Build, sound, render

Load the engine skill and follow it: Slate → `film-engine`, then `sound-design`; cinetic → `cinetic` Steps 3–6 (`timeline.ts`, acts, `export-cues.ts`, the earshot kit, `render.sh`). Either way:
- Time everything in beats. Sounds sit on the frame of the visible cause (contact, 50% of a pop, a whoosh's apex), computed from the picture code, never retyped.
- Every word on the film's grid; run the layout gate (Slate `render.mjs --audit`; cinetic `layout-audit.sh` and `grid-check.ts`) and fix every line it prints.
- Iterate on drafts and previews. Render the motion-blurred master once, after the last review round.

## 7. Measure and critique, whatever the engine

The QA from both toolkits runs on any MP4, so every film gets all of it:

```bash
python3 $C/scripts/probe.py out/<name>.mp4 --spec 1920x1080@60 --dur <s>                      # size, fps, duration, BT.709, AAC
python3 $C/scripts/forensics.py out/<name>.mp4 [--cues out/cues.json] --json out/qa/forensics.json  # pops, stalls, ghosts, judder, banding, loop seam
python3 $C/scripts/sheet.py out/<name>.mp4 --chunks 4 --rate 12 --out out/qa/sheet.png           # contact sheets
python3 $S/tools/originality.py check out/<name>.mp4 --refs $S/skills/video-critic/references/fingerprints.json   # not a copy of a reference
```

Slate films also get `tools/critic.py` automatically at the end of a render (sync to the beat grid, reading time, layout, loudness, originality, rubric sheet). cinetic films also get `av-audit.py` against their cues. Then load `video-critic` and score the sheet with its rubric; for a launch film or walkthrough also run cinetic's director and art/copy/UI lenses (`$C/assets/critics/`). Fix the lowest score first, one or two changes per round. Launch films get at least 2 rounds; stop after 5 and say what is still weak.

**Ship gate:** no failing script; no open P0 (visible on the hook, payoff or logo, or breaking the story); every rubric line ≥ 3, Finish and Sync at 5.

## 8. Deliver

- The MP4 and a poster from a clean still (Slate: `render.mjs --stills <t>`; cinetic: the last frame), the QA reports in `out/deliver/qa/`, and two sentences: the idea, and what you'd change with more time.
- Loops, GIF and WebM from any master: `bash $C/scripts/deliver.sh out/<name>.mp4 --loop --gif --webm --poster-from <still.png>`. Alpha stings and social re-layouts need the cinetic Remotion path (`--alpha`, `--variants`); on Slate, change `width`/`height` in `film()`, redesign the layout (never crop) and render again.
- An invented brand ships its kit (`bash $C/scripts/brand-kit.sh`, Remotion projects).
- Tell the person plainly that the sound was checked by measurement and that they should listen.

## Rules

- Never invent capabilities, metrics, quotes or customers for a real product. Sample data must look like sample data.
- Never use another company's logo, footage, music or copy. References teach principles only.
- The brand wins over every default in this plugin.
- Every frame must render the same way twice: no `Math.random()`, wall-clock time or CSS transitions that the engine doesn't seek.
