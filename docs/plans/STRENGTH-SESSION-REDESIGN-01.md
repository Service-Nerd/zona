# Build plan: the strength session, redesigned (STRENGTH-SESSION-REDESIGN-01)

**Input:** founder, 2026-10-28, after two sessions: *"formulate a plan to fix and build ... the screens and wording ... feel
part of the app and consistent with the run sessions but also distinct. Take all board sittings first ... full analysis and
regression tests and code reviews along the way."*

**Rulings this plan builds** (all 2026-10-28):
- Coaching Board: `docs/decisions/coaching-2026-10-28-strength-session-shape-sitting.md` (A, A2, C, D)
- Design Board: `docs/decisions/design-2026-10-28-strength-session-screen-sitting.md` (E, F, the bodyweight bug)
- SLT: `docs/decisions/slt-2026-10-28-strength-guided-tier.md` (PAID, inherited from the strength engine)

**Screens and wording:** the canvas *Strength session redesign* (overview in parts; guided warm-up, part, rest, end; the
wording sheet). **Founder approved the canvas and the wording, 2026-10-28.**

## The builds, in order

Each build: `/build` analysis block first; engine builds measured with `npm run verify:strength:full` before and after and
the run engine proven unchanged (`verify:parity`); every new check falsified; full `npm run verify`; a code review; then
the records (`/ship`). The founder's own strength plan is regenerated after each engine build so he sees it.

| # | Item | What changes | Board tag | Depends on |
|---|---|---|---|---|
| 1 ✅ 2026-10-28 | `STRENGTH-BW-LOG-01` | A bar used as an anchor (inverted row) is a bodyweight lift: logs the feel only | ⚙️ defect | none |
| 2 ✅ 2026-10-28 | `STRENGTH-AB-SESSIONS-01` | Two sessions of one kind in a week are an A and a B; no two training sessions in a week identical (measured 10,178 of 14,870 multi-session weeks; now 0) | 🏃 ruled | none |
| 3 | `STRENGTH-SUPERSET-MAINS-01` | A lower and an upper main lift pair, resting the longer rest; warm-up as rounds (2 at 45/60 min, 1 at 30) | 🏃 ruled | 2 |
| 4 | `STRENGTH-REP-BLOCKS-01` | General focus cycles main reps by block (e.g. 10 → 8 → 6); running keeps heavy 5s; numbers set by measurement | 🏃 ruled | 2 |
| 5 | `STRENGTH-SESSION-PARTS-01` | The overview in parts; rest and effort once per part; supersets linked; new wording; the no-legs line with the swap day | 🧭 ruled, 👤 words | 1, 3 |
| 6 | `STRENGTH-GUIDED-SESSION-01` | Start session; one part per page; weight stepper; rest countdown; exercise timers; End session; session time stored | 🧭 ruled, 👤 words | 5 |

### What each build must prove

1. **Bodyweight log.** Every catalogue lift whose kit only anchors the body logs no weight; the founder's 90 kg inverted-row
   log stops feeding a suggestion. Test over the catalogue, falsified by restoring the old rule.
2. **A/B.** `S-AB-DISTINCT` (no two training sessions in a week share every exercise); each lift still appears once a week
   and holds `BLOCK_WEEKS`; S14 progression unchanged per lift; sweep: identical-week rate 34% → 0, no new S-violations.
3. **Pairs and rounds.** `S-MAIN-PAIR-REST` (a main pair rests at least the longer rest; never two lower, never heavy +
   plyo) and `S-WARMUP-ROUNDS`; session clocks within `FILL_FLOOR`..budget; time saved reported (measured 5.8–7.7 min).
4. **Rep blocks.** A config cycle, a principle amendment, a check that general mains follow the block's reps and running
   lower mains stay heavy; session clocks re-measured (higher reps cost time); no "toning" string anywhere.
5. **Overview.** Markup arms: rest and effort once per part; superset rows linked; no effort line on timed items; "New
   lifts this block" once; Start session present; the no-legs line on a converted session only. Website untouched (no
   strength on marketing). Checked against `ui-patterns.md` and the run session screen.
6. **Guided.** A state-machine test (rounds, rest countdown from `rest_s`, timed moves, back, end mid-way, resume the same
   day); a migration adding start and end time to `strength_completions` with grants (MIGRATION-GRANTS-01) and the
   `userDataSurfaces` declaration; device check in the simulator (screen awake, timers when backgrounded) before release,
   said plainly if not possible.

## Not in this plan

- A knee-dominant light item on a no-legs day (Coaching Board: INSUFFICIENT EVIDENCE; Willy wants it measured first).
- Demo media (STRENGTH-MEDIA-01, parked on the supplier).
- Strength for non-admin runners (release is a separate decision).
