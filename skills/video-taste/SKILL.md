---
name: video-taste
description: The taste guide for launch films, feature announcements, teasers and ads - principles for idea, structure, pacing, type, motion, image and sound, and how to find a film's look in the product itself. Load before pitching concepts or writing a film, and when judging a render.
---

# Video taste

This is not a style. It is why good launch films work, written so you can make a film nobody has seen before. Every film starts from the product in front of you, never from another film.

The principles come from frame-by-frame study of five reference films (measurements in [references/benchmarks.md](references/benchmarks.md)). Their signature moves are listed in [references/do-not-copy.md](references/do-not-copy.md). Read that list before pitching: those moves belong to those films. Learn why they work, then find this product's own version.

## 1. The idea comes from the product

A film is one idea, made visible. The idea is never "show the features". It is a truth about the product, said with images that could only belong to this product.

Where ideas come from, in order of strength:
1. **The product's promise, taken literally.** A product called Slate, which lines picture up with sound, gets a film built from a clapperboard's clap. A sync tool promises "in step", so show things falling into step. Say the promise, then picture it with no words.
2. **The product's own material.** Its UI nouns (cards, files, a canvas, a terminal), its logo's shape, its colors, its sound, its users' desk at 11pm. A mark with four petals can be four sheets landing. A product made of documents can be a film made of paper.
3. **The tension it resolves.** Show the before, honestly and briefly, then the after. Noise into calm, chaos into order, slow into instant, many tools into one.
4. **A single verb.** Settle, unfold, focus, connect, lift. The verb becomes the film's motion: how everything enters, moves and leaves.

The test for an idea: could you swap in a competitor's logo at the end and the film still works? Then it is not an idea yet.

## 2. One move, everywhere

Great films repeat one motion at every scale, so fast or varied images still read as one thought. Choose the film's move from the idea's verb (landing, folding, focusing, aligning, growing) and use it for everything: how type enters, how UI arrives, how scenes change, and how the logo forms. A film with one move feels designed. A film with five transitions feels like a template.

## 3. Shape

- **Breathe, build, peak, land.** Open with space (1–2s), build, peak just before the main line or the product reveal, then land slower than you started. The last quarter is the calmest.
- **Contrast makes the peak.** A silence before a hit, stillness before motion, darkness before light. The biggest moment in a film is often the moment everything stops.
- **The reveal arrives after the idea is felt.** Never open on the logo or the product name.
- **End where you started, changed.** The closing frame answers the opening one (the scattered sheets become the mark).
- **The logo holds 2.5–5s** on a quiet frame. The tagline arrives after the mark.
- **Claim, then proof.** Each line on screen is followed by the product proving it. Never two claims in a row with nothing shown, never long stretches of UI with nothing said.

## 4. Pacing

- **Write in beats.** Every scene starts on the beat grid; montage shots are 2, 1, ½ or ¼ beats. Off-grid cuts feel wrong even to people who can't say why.
- **Pace follows the content's job.** Reading sets the pace for type (hold words/3.5 + 0.6s at least). Music sets the pace for montage. A UI action sets the pace for a demo (the shot ends when the action lands).
- **Fast cuts need a constant.** Three-frame cuts only read when something stays fixed (a shape, a position, a line of type). Without one they are noise.
- **Nothing is static.** Every shot moves a little (a 3–8% push, a drift, parallax). True holds are for the logo.

## 5. Type

- **Use the brand's own typefaces.** If there are none, pick one serif or one sans and stay with it. Two voices at most: a display voice for lines, a quiet voice for labels.
- **≤ 7 words per line, ≤ 2 lines, ≤ 9 words on screen.** Break long thoughts across moments.
- **Size with restraint.** Main lines 4–6% of frame width (75–110px at 1080p). Big is not confident; space is.
- **Type moves with the film's move.** If things land, words land. If things focus, words focus. Never a generic fade or typewriter by default.
- **One accent at most** (a word in the brand color, an italic). No outlines, no gradients on type.

## 6. Layout

Bad placement is what makes a film look generated. Words that land wherever there was room read as an accident, even when every frame is pretty.
- **Pick a grid before the first frame.** One axis for type (the center line, or one left edge), one baseline position per kind of line, margins of at least 6% (title-safe), and a picture area. Write them down at the top of `film.css`.
- **Every line goes to the same place.** A claim always arrives on the same axis and baseline; a label always sits in the same slot. The viewer stops looking for the words and just reads them.
- **Words and pictures take turns, or take sides.** Type sits on its own card, in a matte bar, or on a clean, dark side of the frame. Never over busy UI or footage. If it must overlap (a title over a wide landscape), darken under it and mark it `data-over`.
- **The end card is composed, not stacked.** The mark on the optical center (a touch above the middle), the tagline a clear step below on the same axis, the URL quietest and lowest. Nothing touches the edges, nothing is centered on a different axis than its neighbor.
- **Labels are quiet.** Small sans, tracked out, dim, in the same corner every time. Small text under 18px at 1080p can't be read on a phone.
- **Check it.** The renderer audits every word's position six times a second (`--audit`), and the critic fails a film with type outside title-safe, over a picture, or on other type.

## 7. Image

This is where most AI video looks cheap. The bar:
- **Real footage, not still images.** A launch film is moving pictures. Record the real product in use with `engine/record.mjs` (smooth, frame-accurate video of any web app, with a real cursor, typing and scrolling), play back a real CLI session with `engine/termcast.mjs`, bring in filmed video with `engine/footage.mjs prepare`, or generate atmosphere with Veo (`engine/footage.mjs generate`). A screenshot sliding across the frame is a slide, not a shot. Stills are for a frozen beat on purpose.
- **Real product, real assets.** The product's actual UI, its real fonts, logo and colors. Never redraw a UI as boxes. Never zoom footage past its recorded pixels (record at `scale: 1.25` or more if you will push in).
- **Light and depth.** A key light (a warm glow, a gradient pool), real shadows under things that float, depth of field on things far from the focus, a vignette. Flat elements on flat color look like slides.
- **Material.** Paper has a grain and a soft gradient, glass reflects, cards have a 1px edge and a shadow that tightens as they land. Finish with fine film grain.
- **Motion blur** on anything moving fast (the engine samples subframes; set `post.blur`).
- **One focal point per frame.** If two things compete, cut one or blur one.
- **Color from the product.** Ground, ink, one accent, all from the brand. A dark product gets a dark film; a white-canvas product gets a white film.

## 8. Sound

- **The edit is the score.** The music follows the film's energy arc; every landing, click and flip has a sound placed on its frame.
- **Silence is an instrument.** Stop the music dead before the biggest moment, then let it land.
- **Pick an instrument that fits the product's voice:** felt piano for calm, human tools; glass and bells for precise ones; a pulse for energetic consumer ads.
- **Resolve on the logo:** a chord that rings out, then quiet.
- **Master to −14 LUFS** (web), −12 to −13 (social feeds), true peak ≤ −1 dBTP.

## 9. Format

| Use | Length | Aspect | Notes |
|---|---|---|---|
| Launch film | 30–90s | 16:9 | The idea, three or four proofs, the mark |
| Feature announcement | 15–40s | 16:9, 1:1 | One claim, one or two proofs, the mark |
| Teaser | 6–25s | 1:1, 16:9 | One image idea, no UI or a single glimpse |
| Paid social ad | 6–15s | 9:16, 1:1 | The claim within 1.5s, captions burned in, a CTA end card |

## Before you build, answer in writing

- The idea in one sentence, and why it belongs only to this product.
- The film's one move.
- What this film does that none of the references do.
- The palette, the type, the instrument.
- The grid: where every kind of words goes.
- The footage: what will be recorded, filmed or generated for each shot.
- The first frame and the last frame.
