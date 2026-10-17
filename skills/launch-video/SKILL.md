---
name: launch-video
description: Direct a launch film, feature announcement, teaser, ad or changelog clip for a product - from reading the product, through three original concepts and style frames, to a rendered, scored and critic-passed MP4. Use when someone asks for a product video, launch film, promo, ad or announcement video.
---

# Direct a launch film

You are the director. The output is a finished MP4 that passed the critic, the film's source in `films/<name>/`, and two sentences on the idea. Work in this order. Most of the quality is decided before any rendering.

Setup (once): `cd engine && npm install`, then `python3 -m pip install -r requirements.txt`. You need Node 20+, Python 3.10+, ffmpeg and a Chromium (found automatically from Playwright's cache, or set `SLATE_CHROME`).

## 1. Study the product

Load `video-taste` first. Then read everything you can about the product: the site, the README, the app itself, its brand kit. Write down:
- **The promise** in the product's own words (tagline, hero line).
- **Its material:** the nouns of its UI, the shape of its logo, its fonts, colors, and the feeling of using it.
- **The tension it resolves** for its user.
- **Real assets** you can use: screenshots (capture fresh ones at 2x if you can run it), fonts with their license, logo SVG, product photos.

If the person gave no assets, ask for the product's site or repo instead of inventing a UI.

## 2. Pitch three concepts

Write three different concepts, each in this form:
- **Idea:** one sentence, the product's promise made visible.
- **Why only this product:** the material it is made from.
- **The move:** the one motion repeated at every scale.
- **First frame / last frame.**
- **Sound:** instrument and arc.

Then gate them:
1. Reject any concept whose central image or main transition is on `video-taste/references/do-not-copy.md`, or is the same move in different clothes. Write the rejection reason.
2. Reject any concept that would still work with a competitor's logo at the end.
3. Pick the strongest one left and say why. If the person is around, show them the three; otherwise pick and keep going.

Store the decision with `F.notes({idea, motif, rejected})` so it travels with the film.

## 3. Style frames before motion

Build the film's look as still frames first: the opening, the peak, a product moment and the ending. Write the HTML and CSS for those scenes, then:

```bash
node engine/render.mjs films/<name> --stills 1,9,22,48
```

Look at every PNG in `films/<name>/build/stills/`. Judge it against the image bar in `video-taste` (real assets, light, depth, material, one focal point, brand type). Fix and repeat until the stills look like frames from a film you'd want to watch. They are cheap, and renders are not.

## 4. Get the footage

The film is made of real moving pictures. Plan each proof shot as footage, then get it (load `film-engine`, section Footage):
- **The product's UI:** write a shot script per shot in `films/<name>/shots/` and record it with `node engine/record.mjs`. Real data, real typing, real clicks; record at the picture's aspect and `scale: 1.25`.
- **A CLI or build:** record the real run with `engine/termcast.mjs`, film it with the terminal player.
- **People, places, objects:** filmed video the person gives you (`engine/footage.mjs prepare`), or generated atmosphere with Veo if `GEMINI_API_KEY` is set. Never generate the product's UI.

Watch every clip (a contact sheet: `ffmpeg -i footage/x.webm -vf "select='not(mod(n,30))',scale=480:-1,tile=4x2" -frames:v 1 sheet.jpg`). Re-record anything that stutters, starts blank, or shows nothing worth seeing. If there's no way to get footage of something, say so; don't fake it with a sliding screenshot.

## 5. Write the film

A film is a web page: `films/<name>/index.html` plus its CSS and JS, written new for this film. Load `film-engine` for the contract and the primitives. Write every scene yourself, for this idea. Never start from another film's code. The one exception is small utilities you've already written (a word-landing helper, for example).

- Time everything in beats (`F.b(n)`), with the tempo chosen for the film's energy.
- Declare each scene with what must be readable (`words`) and its `kind`.
- Put every word on the grid you chose (see `video-taste`, Layout), then run `node engine/render.mjs films/<name> --audit` and fix every line it prints.
- Place sound cues on the frames where things happen (`F.cue('land', t)`), and set the energy arc (`F.music({arc})`).
- Preview in a browser with `node engine/serve.mjs`, then open `http://localhost:4173/films/<name>/`, where you can scrub with the arrow keys.

## 6. Render, critique, fix

```bash
node engine/render.mjs films/<name>            # full quality: motion blur, grain, score, critic
node engine/render.mjs films/<name> --draft    # half size, no blur: for checking timing
```

Load `video-critic`. The critic measures the file and runs the originality check. Then look at `build/critic/contact.jpg` and score it with the rubric. Fix the lowest score first, and change one or two things per round. Usually 2–3 rounds; stop after 4 and say what is still weak.

## 7. Deliver

Hand over the MP4 in `out/`, a poster frame (`ffmpeg -ss <t> -i out/<name>.mp4 -frames:v 1 poster.png`), the critic report, and two sentences: the idea, and what you'd change with more time (a licensed track, filmed footage of people using it). For other aspect ratios, change `width`/`height` in `film()`, re-check stills (layouts must be redesigned, not cropped), and render again.

## Rules

- Never invent capabilities, metrics, quotes or customers for a real product. Sample data in the UI must look like sample data.
- Never use another company's logo, footage, music or copy. Reference films are for learning principles only.
- The brand wins: its fonts, colors and voice override any default here.
- Never use `Math.random()` or wall-clock time in a film. Every frame must render the same way twice (use `seeded()`).
