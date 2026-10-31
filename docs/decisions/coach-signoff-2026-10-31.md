# Coach sign-off — Design Board, the whole screen as built (2026-10-31)

**Input:** founder, 2026-10-31: *"I want a full mock up of the new screen, validate that front end design skill has been
used and ui patterns and best practice has been used and architectural principles followed … this goes to design board
to refine and sign off on if needed."*

**Artefacts:** `full-pro.png`, `full-free.png`, `full-upgrade.png`: rendered from `/coach-preview/full` (real shared
components, the founder's production data computed by the app's own owners; Kit's read card and the "This week" card
shell are inline in `CoachScreen` and replicated style-for-style, marked `data-replica`).

## Validation

| Check | Result |
|---|---|
| Independent read-only audit (separate agent, against frontend-design, `ui-patterns.md`, CLAUDE.md, architectural principles, a11y) | **0 must-fix, 7 should-fix, 9 notes.** 5 should-fix fixed in `4ff6e039`; 2 ruled below |
| frontend-design skill | Not loaded for `EffortRecord` (built earlier the same day); loaded for `COACH-KIT-CAUGHT-01` and this sitting. Audit found `EffortRecord` token- and pattern-compliant |
| Gates | 719 files / 7,014 tests, type check, lint; mutation harness 9/9 on both owners |

## Evidence (live DOM at 375px, `/coach-preview/full`)

Pro Coach **1,982px** (≈2.4 screens), effort record at 1,111–1,454px. Free Coach **761px** (one screen). Upgrade: receipts
at 182–365px (first screen), subscribe at 1,377px (second screen, unchanged). No horizontal overflow anywhere. Densest
runner today: **24** HR runs in 8 weeks (production), against the ~35 where the record would overflow.

## The sitting

🧭 **Zhuo:** three screens, one job each; zero must-fix. ✋ **Silvanto:** now before over time holds; the one-screen free
Coach is restraint, not absence. No veto. 🎓 **Sierra:** the free screen now shows the runner their own week, and the
effort card's footer teaches the line. 📱 **Wroblewski:** cap the record before it breaks; "In your trial" on an ended
trial is false. 🎪 **Collins:** the effort record should sit directly under Kit's read. **Lost, recorded:** the order stands
until Coach opens are measured.

## Rulings

| # | Question | Ruling |
|---|---|---|
| 1 | Pro Coach, free Coach, Upgrade (trial) as built | ✅ **SHIP** |
| 2 | Effort record at 35+ runs | **SHIP WITH AMENDMENT:** at most `EFFORT_RECORD_MAX_COLUMNS` (32) most recent runs; eyebrow "last 32 runs" |
| 3 | "In your trial, Kit caught" | **AMENDED:** only while a trial runs; trial-ended and grant-ended read "What Kit caught · last 2 weeks" |
| 4 | Count-up ignores reduced motion (pre-existing) | Filed `A11Y-REDUCED-MOTION-01`: sweep every animation |
| 5 | 13.5px insight text; type gate cannot read decimals | Text fixed (`--fs-body`); filed `TYPESCALE-DECIMAL-GATE-01` |

## What this does not establish

Nothing seen on a device. The Upgrade receipts' placement relative to Apple's own sheet is unseen. Collins' ordering
question waits on Coach opens per runner per week, before and after.
