# Benchmarks: what the reference films measure

Five reference films were measured with `tools/analyze_reference.py` (ffmpeg scene detection at 0.25, EBU R128 loudness, librosa tempo and onsets) and studied frame by frame. Names describe the films; the files are not redistributed here.

| Film | Family | Format | Length | Cuts | Median shot | Loudness | Tempo |
|---|---|---|---|---|---|---|---|
| AI workspace launch | demo | 1920×1080 @ 60 | 100s | 11 | ~8s | −12.9 LUFS | ~99 BPM |
| Feature announcement (sites builder) | demo | 1920×1080 @ 60 | 46s | 1 hard cut | — | −12.5 LUFS | ~89 BPM |
| Model release, "look closer" lens film | teaser | 1080×1080 @ 24 | 27s | 41 | 0.125s in the burst | −13.3 LUFS | ~161 BPM |
| Model release, the number made of everything | teaser | 1080×1080 @ 24 | 20s | 62 | 0.125s (3 frames) | −11.6 LUFS | ~108 BPM |
| Model release, curved horizons + one line | teaser | 1280×720 @ 25 | 20s | 34 | 0.32s, accelerating | −16.4 LUFS | ~136 BPM |

## What each one teaches

**AI workspace launch.** White canvas; headline typed on letter by letter, accent word in the brand green. Extreme close-ups on single UI controls ("5.6 Sol Extra High", the send button) pulled back to the full window. App windows float on a deep-space background during the "it does the work" section. Phone UI for "even when you're away". Ends: headline, a soft dot, wordmark, mark. Pacing follows reading, not the beat.

**Feature announcement.** Kinetic type: `[idea]` and `(deployment)` in violet, brackets popping in as a pair; a bracket alone later becomes a graphic. Prompt box typed with `@Sites` chips, cursor click on send, UI result. A permissions dropdown is demonstrated with a real cursor. A wall of generated sites drifts diagonally (collage). Legal line in small gray at the bottom of end cards.

**Lens film.** One idea: look closer. Opens on a calm real-world shot (bird on branch), enters an eyepiece (circular mask with machined rings), then accelerates through botanical plates, maps, circuitry, microscopy, star charts, the sun and the moon at 3–4 frames per shot (7–11s), decelerates into slow clouds for the title, wordmark over the sky, and returns to the bird (bookend). Energy peaks at 12–14s, drops ~20 dB for the title.

**The number made of everything.** The digit "5" built from ~40 materials (botanical, maps, type, constellations, petri dishes, cut paper, red dots on graph paper), 3-frame cuts on the beat. Butterflies fly into camera as the transition to a coral title card; the card color comes from the last shot. Final card: black serif wordmark on graph paper.

**Curved horizons.** Every shot is the curved edge of a different surface (planet limb, pastry, leaf, lace, petri dish). Shots shrink from ~0.6s (1 beat at 136 BPM) to ~0.25s (½ beat). One line of serif text, one word-group at a time, stays locked above the horizon while the world cuts beneath it, flipping black/white with the ground. Title on dark, wordmark, back to the opening horizon. Loudness ramps −35 → −14 dB over 15s, then falls.

## Numbers to design against

- Teaser montage shots: 2–4 frames at the peak, 0.5–0.6s at the start of the build.
- Cuts within 50ms of a musical onset: 30–50% (the rest fall on subdivisions).
- Title hold after a montage: 2–4s. Logo hold: 2.5–5s.
- Integrated loudness: −11.6 to −16.4 LUFS; median ≈ −13.
- Demo headline size ≈ 3% of frame width; teaser title ≈ 10–13% of the short side.
- Typed headline speed ≈ 12–20 characters per second.
