# RepDB, assessed in full (STRENGTH-MEDIA-01, 2026-10-21)

Read on repdb.co on 2026-10-21: pricing, FAQ, Standard License v1.2, and the public coverage manifest
(`repdb.co/exercise-list.json`, 650 exercises). Supersedes the 2026-10-18 spot check (~22 of 37).

## Coverage, counted against all 98 catalogue exercises (by hand, movement by movement)
- **Same movement: 63 (64%).**
- **Close, usable with a caveat: 18 (18%).** marching high knees (theirs: running high knees), bodyweight and dumbbell
  box squat (barbell box squat), weighted and barbell step-up (bodyweight step-up), single-leg box squat (pistol),
  weighted single-leg and bent-knee heel raise (calf raises), cable hip abduction (banded standing), low skips (jump
  rope), banded chest press (cable), half-kneeling single-arm press (one-arm shoulder press), table row (inverted row),
  banded row (cable row), weighted dead bug, kneeling walkout (inchworm), side plank on knees, 90/90 switch (90/90 hold).
- **None: 17 (17%).** standing hip circles, world's greatest stretch, knee-to-wall ankle rocks, A-skip, skater squat,
  single-leg balance reach, pogo hops, single-leg pogo, lateral bound, bounding, drop jump, prone Y-T-W, half-kneeling
  chop, plank shoulder tap, Copenhagen plank, open book rotation, hamstring floss. Mostly the running-specific
  plyometrics and mobility.
- Static holds (plank, side plank, holds, stretches) ship as a still by design, not an animation.

## Terms (Standard License v1.2)
- $499 once, VAT included; female character +$99; stills-only Starter $299. Updates to the bought version via the
  order link; future editions may be charged.
- Commercial use in any number of our own products, no revenue cap; self-host, CDN, bundle, cache.
- **Colour adjustment is in the licence**, not only the FAQ; AI restyling is prohibited. Meets the Design Board's
  recolour condition (2026-10-21).
- No bulk redistribution; no training models on it. Attribution requested, not required.
- Licensee is the name on the order and is non-transferable; to make a company the licensee, email support after
  checkout. A product sale does not carry the licence.
- **Images are AI-generated** by RepDB ("original works generated with AI tooling"); protection is claimed as a
  database right. Movement accuracy needs a coaching check before shipping.
- Sole operator (Berlin), German law, "as is".
- Size: WebP masters ~3 MB each; their measured MP4 export ~71 KB at 512 px, ~175 KB at 960 px.

## Free preview evaluated (2026-10-21)
Preview bundle downloaded (171 MB, 181 files, `cdn.repdb.co/.../repdb-preview.zip`), kept in the session scratchpad,
never in the repo. Its licence is CC BY-NC 4.0 and says evaluation inside a commercial organisation is fine; credit:
"Exercise data & images: RepDB (https://repdb.co)". 22 exercises, male and female, 960 px animations.

**Form check (six frames per loop, the strength seat's lens), on the four that match our lifts:**
- Front squat: front rack, upright torso, depth to about parallel, heels down. **Pass.** Elbows sit near shoulder
  height, a little lower than our cue ("Elbows high").
- Single-arm row (theirs: one-arm kettlebell row, hand on bench): hinge with a neutral back, elbow drives to the hip.
  **Pass** for our dumbbell row.
- Pull-up: dead hang to chin over bar, legs still. **Pass.**
- Reverse lunge (theirs: barbell): the bottom is good (back knee near the floor, front shin near vertical), but in the
  transition frames the stepping leg swings **out to the side** rather than straight back. **Caveat:** check in motion
  before using; and theirs is barbell-loaded where ours is bodyweight or dumbbells.
- Sample of the rest: bent-over dumbbell row has the head craned up (a minor neck cue we would not teach).
- ⚠️ A frame check by the modelled seat, not a coach watching the clips in motion on a phone.

**Cost measured:**
- Recolour of the orange highlight to `--s-strength` with a 40-line Pillow script: **2.8–4.7 s per clip** at 512 px.
  The muscles still read on the grey figure. A thin orange fringe survives on anti-aliased edges: the threshold needs
  tuning (or RepDB's own script).
- Files: masters 1.6–4.3 MB (960 px). Re-encoded animated WebP at 512 px: **757 KB–1.1 MB**, too heavy per open.
  Stills at 512 px: **19–24 KB**. MP4 not measured (no ffmpeg here); RepDB's figure is ~71 KB at 512 px on a solid
  background, which our fixed `--bg-soft` inset allows.
