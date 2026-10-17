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

## 3. Form

Every film has a form: the way its pace and sound move from the first second to the last. Most AI films have one form, the trailer: it builds, cuts faster and faster, the music stops dead, the logo slams in. It works for a big launch, about once. As a habit it is the clearest sign a film was made by a template. Choose the form from the product and the occasion, before any shot, and write down why.

| Form | Pace | Sound | Ends on | Right for |
|---|---|---|---|---|
| **The take** | A few long shots or one unbroken move, the same calm pace start to finish | One instrument, steady, no build | A held frame, the music finishing its phrase | Craft, premium, confidence. A product that doesn't need to shout |
| **Call and response** | Claim, proof, claim, proof, at an even rhythm. The rhythm is the structure, not a ramp | A groove that stays in one gear | The last proof, then the name | Feature announcements, demos, changelogs |
| **Settle** | Opens busy and cut fast (the problem), then each shot is longer than the one before, until it is still | Starts cluttered or rhythmic, thins out until one instrument or the room is left | Stillness and the room's air | Calm tools: focus, notes, wellbeing, anything that removes noise |
| **Slow reveal** | One image, getting clearer the whole time. Few or no cuts | A drone or chorale that swells and recedes | The answer the image was hiding | Teasers, brands, a single idea |
| **Loop** | Even, and the last frame flows into the first | A figure that repeats | The beginning | Habits, daily rituals, social clips that replay |
| **Trailer** | Builds, cuts accelerate, stops dead, the name | Builds to a peak, a silence, a hit | A slam, then the logo | A big, loud launch, when the energy is the message. Never twice in a row |

- **Decide the last second first.** It is what people remember. A frame held while a note rings, a cursor coming to rest, the room after the music stops, a line of type, a fade under the name. Then work backwards.
- **Peaks are optional.** Plenty of great films never peak. Steady confidence, or a slow settle, is often the better taste.
- **Contrast is the tool, not the formula.** Stillness before motion, silence before sound, dark before light. Use it where the idea needs it, not always before the logo.
- **The reveal arrives after the idea is felt.** Never open on the logo or the product name.
- **End where you started, changed.** The closing frame answers the opening one.
- **The logo holds 2.5–5s** on a quiet frame. The tagline arrives after the mark.
- **Claim, then proof.** Each line on screen is followed by the product proving it.

## 4. Pacing

Pace is how long the viewer is allowed to look. Cut a shot when it has said its thing, not when the music says so.
- **Shots last as long as their content.** A UI action ends when the action lands. A line of type holds words/3.5 + 0.6s at least. Footage of something beautiful holds longer than footage of something busy.
- **Choose the film's pace curve, and make it deliberate.** Even, slowing, or rising. A film whose cuts get faster to the end is a trailer; only do it when that is the form. Most films should slow down at the end: the last shots are the longest.
- **Vary shot length within the curve.** Three shots of identical length feel mechanical. Long, short, long reads as an edit.
- **Write in beats, but not every cut on the beat.** Cuts sit on the beat grid when the music is rhythmic. Over a rubato or ambient score, cut on the action and the breath instead; an off-grid cut against a free score feels natural.
- **Fast cuts need a reason and a constant.** A montage is a choice of the trailer and loop forms, not a default. When used, keep something fixed (a shape, a position, a line of type) so it reads.
- **Leave air.** A second of nothing between a claim and its proof lets the claim land. Room is a luxury signal.
- **Nothing is static.** Every shot moves a little (a 3–8% push, a drift, parallax). True holds are for the logo and for the end.

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

Sound is taste you hear. Most generated films fail here the same way: the same bright music, building, stopping, booming. Choose the sound like a music supervisor, from the product's voice and the film's form.
- **Start from what the product sounds like.** A writing app is a pencil and a quiet room. A developer tool is keys and a terminal bell. A camera app is a shutter. Its own sounds are often a better score than music; `room` (no music at all) is a real choice.
- **Then pick an ensemble with a reason, at the references' production level.** Launch films and ads are scored with produced music: recorded instruments, a sub, a pocket or a swell, mastered loud. A groove with vibes for an everyday app; plucks over a sub for a reveal; strings and horns for something serious; a bright kit and piano for an optimistic launch. A lone piano or room tone is a deliberate exception, never the default. Write the reason in the notes; "it's the default" is not one.
- **Fewer instruments, more space.** One instrument played with feeling beats five layers. Rests are part of the music.
- **The score doesn't have to follow the edit.** It can stay steady while the picture changes, thin out while the picture gets busier, or finish its phrase after the last cut. Matching every rise is the trailer's habit.
- **Choose the ending:** a chord that rings, the phrase simply finishing, one short button note, a fade under the end card, or a cut to the room. Silence before the logo is one option among them, not the rule.
- **Every action has its sound, quietly.** Clicks, keys, landings on their frames, mixed under the music, never louder than it.
- **Don't repeat yourself.** If the last film used a style and an ending, this one needs a reason to use them again.
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
- The form, the pace curve, and the last second, and why the trailer form is or isn't right here.
- The sound: what the product itself sounds like, the ensemble and why, and the ending.
- The palette and the type.
- The grid: where every kind of words goes.
- The footage: what will be recorded, filmed or generated for each shot.
- The first frame and the last frame.
