---
name: video-taste
description: The taste guide for launch videos, feature announcements, teasers and ads. Load before writing a treatment, beat sheet or Slate spec, and when judging a render. Covers structure, pacing, type, motion, color and sound, and how to adapt each to the product.
---

# Video taste

Rules distilled from frame-by-frame study of top-tier launch films (product demo launches and one-idea brand teasers). Each rule is here because breaking it is what makes AI video look generic. The measured numbers behind them are in [references/benchmarks.md](references/benchmarks.md).

## The two families

Pick one before anything else. Mixing them is the most common way to make mush.

| | **Demo launch** (`archetype: demo`, `feature`) | **Brand teaser** (`archetype: teaser`, `ad`) |
|---|---|---|
| Hero | The real product UI | One visual idea |
| Canvas | White or near-white, one accent | A curated palette pulled from the imagery |
| Type | Neutral grotesk, typed on | Editorial serif, focus-pulled in |
| Edit | Few hard cuts; the camera moves inside the UI | Rapid montage on the beat grid |
| Pace set by | Reading and UI actions completing | Music |
| Length | 30–100s | 6–30s |
| Music | Light bed, 90–100 BPM, UI sound design on top | Driving, 110–160 BPM, builds to a hit |

## Structure

1. **One idea per film.** Say it in five words before writing anything ("look closer", "the 5 is everywhere", "from brief to premiere"). Every shot must serve it. If a shot needs explaining, cut it.
2. **Breathe → build → peak → land.** Open calm (1–2s of space), build energy, peak right before the title, then land slow. The final quarter is the calmest part of a teaser.
3. **The title arrives after the idea is felt**, never in the first shot.
4. **Bookend.** End on the frame you opened on (same horizon, same bird, same mark). It makes 20 seconds feel complete.
5. **Logo holds 2.5–5s.** Never cut a logo short. Tagline arrives ~0.5s after the mark.
6. **Demo films alternate claim and proof:** headline → UI that proves it → next headline. Never two headlines in a row without proof, never more than ~8s of UI without a headline.

## Pacing

- **Write the edit in beats, not seconds.** Every scene length is a whole number of beats; montage shots are 2, 1, ½ or ¼ beats. Off-grid cuts feel wrong even to people who can't say why.
- **Accelerate into the peak.** Montage shots shrink geometrically (1 beat → ¼ beat). Use `pacing: "accelerate"`.
- **3-frame cuts only work with a repeated shape.** A glyph, a lens, a horizon line, a centered object. Without one, fast cuts are noise.
- **Typed text:** 14–20 characters per second for headlines, 22–28 for prompts. After the last letter, hold max(1s, words/4 + 0.4s).
- **Static is dead.** Every shot moves a little: a 3–5% push, a drift, a parallax. Holds are for titles and logos only.

## Type

- **Two voices maximum.** Demo: a neutral grotesk (Inter, the brand's sans) at weight 600, tight tracking (−0.025em). Teaser: an editorial serif (Newsreader, the brand's serif) at 400–500.
- **≤ 7 words on screen, ≤ 2 lines, centered, balanced wrap.** Break long thoughts into consecutive cards.
- **Accent one word**, not a phrase: "Introducing *Slate*".
- **Size with restraint.** Demo headlines ≈ 3% of frame width (≈55px at 1080p). Teaser titles ≈ 10–13% of the short side. Big type is not the same as confident type.
- **Brackets as motion** (`bracketTitle`): `[word]` and `(word)` pop in as a pair and the word types inside. Great for two-part claims ("from [idea] to (deployment)"). Use once or twice per film, not every card.
- **Text over montage** stays locked while the world cuts underneath; it flips black/white with the ground.
- No drop shadows, no outlines, no gradients on type, no all caps headlines.

## Motion

- **Camera, not transitions.** In demos, push in on the one control that matters (a model picker, a send button, a stat), then pull back to reveal the whole. Ease in-out, decisive in the middle (`easeCamera`).
- **Zoom between 1× and 2.3×.** Past that, UI turns to mush.
- **Match cuts over wipes.** Repeat a shape across cuts instead of using transition effects. The only soft transition used by the references is a focus-pull/blur-in on titles and logos.
- **Cursor like a person:** slight arc, slows before the target, presses (scale 0.85) on click.
- **UI floats on a world** when the film shifts from "what it is" to "what it does": put windows on `space` or `grid` backdrops.

## Color

- **Demo:** white canvas, ink near-black, exactly one accent (plus one secondary used only in brackets). Product UI keeps its true colors.
- **Teaser:** a palette of 4–5 colors that already live in the imagery. The title card color is taken from the montage (the red of the last butterfly becomes the card).
- Light grounds get a paper texture; dark grounds get a little grain. Never flat #000 or flat #fff in teasers.

## Sound

- **Master −14 LUFS integrated** for web and YouTube, −12 to −13 for social feeds, true peak ≤ −1 dBTP. The references sit at −11.6 to −16.4.
- **The edit is the score.** Cuts land on the beat; typing gets key taps; clicks get clicks; camera moves get a soft whoosh; brackets get a pop.
- **Drop before the hit.** Half a beat of near-silence (rhythm out, riser in), then the title lands on an impact.
- **Resolve on the logo:** one ringing chord, then silence. The last frame is quiet.
- Demo films: light glassy bed (pads, plucks, soft kick only in the busiest section). Teasers: driving pulse, claps on 2 and 4 at the peak.

## Adapting to the product

Read the product before choosing anything (site, app, repo, brand kit). Then decide, and write the decision into the treatment:

| Signal | Choice |
|---|---|
| Developer tool, infra, AI model | Demo family; grotesk; accent from brand; prompt box or terminal as hero; 96–100 BPM `glass` |
| Consumer app, lifestyle | Teaser or ad; serif or rounded sans; warm palette; 110–125 BPM; real people/objects in footage |
| Model or research release | Teaser; serif; scientific/archival imagery; lens or horizon motif; 120–140 BPM `pulse` |
| Feature in an existing product | `feature` archetype: 15–45s; one claim, two proofs, logo; reuse the product's own UI chrome |
| Paid social ad | 6–15s, 9:16 or 1:1; the claim in the first 1.5s; captions burned in; end card with the CTA |

Always use the brand's own fonts and colors when given (`brand` in the spec). The rules above describe structure and restraint, not a house look.

## Before you render, ask

- Can I say the idea in five words?
- Does every scene length come out in whole beats?
- Is there one focal point per frame?
- Does the energy curve go breathe → build → peak → land?
- Does the logo hold at least 2.5s on a quiet frame?

More detail: [references/archetypes.md](references/archetypes.md) (recipes with beat counts) and [references/benchmarks.md](references/benchmarks.md) (measured numbers from the references).
