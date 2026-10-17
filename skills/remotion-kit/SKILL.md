---
name: remotion-kit
description: How Slate's Remotion studio works and how to extend it safely - scene types, camera and cursor keyframes, materials, fonts, and the rules for writing new deterministic components. Use when writing a spec that needs something the kit lacks, or when adding a scene type or material.
---

# The Slate Remotion kit

The studio lives in `studio/`. One composition, `Film`, renders any spec (`docs/spec.md`).

```
studio/src/
  Film.tsx               scenes → <Sequence>s, grain/vignette, soundtrack
  Root.tsx               composition + calculateMetadata (size, duration, screenshot sizes)
  lib/timeline.mjs       spec → frames, montage shots, sound events (shared with Node and Python)
  lib/types.ts           the spec's TypeScript types
  lib/theme.ts           brand resolution, color helpers
  lib/motion.ts          easings (easeCamera, easeOut), seeded random, enter()
  lib/fonts.ts           bundled fonts, blocks rendering until loaded
  components/
    Type.tsx             typeTitle, bracketTitle, TitleText, markup parser
    UI.tsx               uiShot, promptBox, cardGrid, camera rig, cursor
    Montage.tsx          montage with glyph / lens / horizon masks and overlay words
    Materials.tsx        procedural materials and palettes
    Brand.tsx            logo, logoEnd, titleCard, the mark
    Backdrop.tsx         paper, grid, space, horizon, grain, vignette
```

Preview while editing: `cd studio && npx remotion studio src/index.ts --public-dir ../examples/<name>` (the default props load `examples/slate-launch/spec.json`; paste another spec into the props panel).

## Rules for new components

1. **Everything is a function of the frame.** Use `useCurrentFrame()` and `interpolate`; no CSS transitions, no `setTimeout`, no `Math.random()`. Use `seeded(seed)` from `lib/motion.ts`.
2. **Timing comes from the timeline.** If a component needs a moment (a click, a cut), compute it in `timeline.mjs` and add a sound event there, so the score stays in sync. Never time something only in the component.
3. **Scale with the frame.** Size in units of `u = min(width, height*1.78)/1920` (UI) or `min(width, height)` (type, materials). Test at 1920×1080 and 1080×1080.
4. **Unique SVG ids** via `useId()`; several instances render on the same page.
5. **Assets through `staticFile()`** with paths relative to the example folder (the render script sets it as the public dir).
6. **New scene type checklist:** type in `lib/types.ts`, entry in `SCENE_TYPES` and `ENERGY` and validation in `timeline.mjs`, a case in `Film.tsx`, a row in `docs/spec.md`, and a test in `studio/scripts/timeline.test.mjs`.
7. **New material checklist:** name in `MATERIALS`, a case in `Pattern`, a default palette if it needs one, and a note on whether it is dense enough for glyph masks.

## Fonts

Bundled: Inter (400/500/600) and Newsreader (400/500/400 italic). To use a brand font, `npm i @fontsource/<font>`, import its woff2 files in `lib/fonts.ts` the same way, and set `brand.sans` / `brand.serif` to the family name. Never rely on system fonts; renders must match everywhere.

## Camera tips

- Frame the whole window first (`zoom: 1`), hold 0.5s, then push in. Viewers need the map before the detail.
- Hold a keyframe by repeating it; a move between two identical keyframes is a hold.
- Keep 0.8–1.2s per move. Faster reads as a glitch; slower drags.
- Check every keyframe with stills (`render.mjs --stills`) before a full render.

## Verify

```bash
cd studio
npm run typecheck
npm test                         # timeline invariants
node scripts/render.mjs ../examples/slate-teaser --stills 2,8,15 --scale 0.5
```
