# Miles teardown — closing the "not proven" list

**Date:** 2026-09-20 · **Against:** the negative-space sections of `ONBOARDING-AUDIT.md`,
`MILES-GAP-ANALYSIS.md` and the Phase 2 proposals.
**Constraint:** prove without changing product code. Everything below is measurement or
reading. **No product code was modified.**

**Result: 9 of 12 proven. 1 falsified — mine. 2 unprovable, and the reason is structural.**

---

## 1. 🔴 FALSIFIED — "Miles's palette is ours"

**I claimed it three times, most strongly as *"put their wizard next to ours and the
difference is the wordmark."* Measured, that is too strong and I withdraw it.**

Sampled the actual pixels from five photography-free screens and compared against our
tokens (weighted-RGB distance; Δ<12 ≈ same within rounding, Δ>40 ≈ visibly different):

| Surface | Miles | Zonna | Δ | Verdict |
|---|---|---|---|---|
| Page ground | **#FAF8F5** | `--bg` **#F3F0EB** | **21.6** | near — theirs is **lighter and less warm** |
| Card | #FFFFFF | `--card` #FFFFFF | **0.0** | identical |
| Primary accent | **#617C62** | `--moss` **#6B8E6B** | **41.8** | **visibly different** — theirs is a darker, greyer forest green |
| Amber | #B8845A | `--warn` #B8853A | 48.3 | near — theirs less saturated |

**What survives, and it is still the argument for P-01.** The *strategy* is identical:
warm near-white ground, white cards, **one** muted green accent, small-caps grey eyebrows.
Two independent teams reached the same palette **shape** without copying each other, which
is what "category default" means. **What does not survive is the claim that the values are
interchangeable.** Ours is lighter-grounded and softer-greened, and side by side you would
tell them apart.

⚠️ **Corrected in `MILES-GAP-ANALYSIS.md` and the P-01 decision note.** The P-01 case now
rests on palette *strategy* convergence, which is measured, not on value identity, which
is false.

---

## 2. ✅ PROVEN — P-03 is display-only

Generated **12 free-tier plans** (3 declared levels × 4 volumes, HM, 29-week runway,
`planStart` pinned) and ran `easyPaceAsCeiling` over every session:

```
plans generated: 12   refused: 0   sessions: 748
easy/recovery: 656    transformed to a ceiling: 656
NON-easy sessions altered: 0
```

**Zero quality, long or race sessions altered.** The function is a pure display transform
over `session.pace_target`; no plan data changes. P-03 is a render change, as claimed.

⚠️ **The first run of this measurement returned `plans generated: 0` and printed a clean
table of zeroes.** `generateRulePlan` takes `planStart` as an ISO **string**, not a `Date`,
and every call threw. Recorded because it is this repo's own `SWEEP-VACUOUS-01` class and
it nearly produced a confident, empty proof.

---

## 3. ✅ PROVEN — "ceilings on every easy run" is TRUE

Same corpus. **656 of 656 easy/recovery sessions on FREE-tier plans carry a
`pace_target` — 100%.**

The Phase 2 copy note flagged this as *"verify before asserting"*, on the theory that a
never-trialled free user might hold population-estimate paces rather than VDOT-derived
ones. **They do hold population estimates — and they still have a ceiling.** The sentence
does not claim VDOT. **The caveat is withdrawn; the copy is true as written.**

---

## 4. 🔴 PROVEN FALSE — "No make-up runs."

**Do not adopt this sentence. We do make-up runs.**

`lib/coaching/planAdjustment.ts:542–578`. On a skip with reason *"Life got busy"* or
*"Bad weather"*, the engine finds the first free day later in the same week and inserts:

```
label:  `Make-up ${sessionType} run`
detail: 'Rescheduled from earlier this week. Keep the effort easy — this is a catch-up, not extra load.'
```

*"Too tired"* is absorbed with no change; injury/illness routes to §21. So the behaviour is
narrow and sensible — **within-week only, never extra load** — but the flat claim is false.

✅ **Our marketing is already correct and says the true version.** `lib/marketing/pricing.ts:64`:
*"Miss a week and it reshapes around what you did, instead of leaving you to catch up on a
week that has gone."* **That is about a WEEK; the engine's make-up is within a week.** No
conflict, and the honest headline is *"nothing carries over"*, not *"no make-up runs"*.

---

## 5. ✅ PROVEN — Hutchinson's P-01 condition is already satisfied

He required that the "held the zone" threshold be board-ratified before the design system
encodes it, or it is the `MARATHON-VOLUME-GATE-01` defect class. **It is ratified.**

`ZONE_DRIFT_ABOVE_CEILING_PCT = 20` (`lib/coaching/constants.ts:48`) has a principle in
`CoachingPrinciples.md`, and the principle carries its derivation: the production
distribution separates with **no overlap** — too-easy runs at 0, 0, 1, 2, 3, 19% above
ceiling; too-hard at 23, 40, 47 … 94%. The threshold sits **inside that gap**.

⚠️ **Two caveats, both already written into the principle rather than found by me.**
n = 42 rows with HR data — *"Thin. The direction is unambiguous but the exact cut should be
re-measured once the cohort grows."*

🔴 **AND A SECOND, DEAD THRESHOLD EXISTS, which is the trap.** `ZONE_DISCIPLINE_BANDS`
(`disciplined: 85, decent: 70, loose: 50`) is read only by `classifyZoneDiscipline`, which
**has no call sites** — confirmed, and documented at `loadCalc.ts:182`. It is the obvious
thing someone would reach for. **P-01 must bind to `ZONE_DRIFT_ABOVE_CEILING_PCT`.**

**Consequence: P-01 does not need a new board sitting.** Hutchinson's condition becomes
"use the ratified one, and do not use the dead one."

---

## 6. ✅ PROVEN — P-05a's tile ranges read from config

`PLAN_SIGNATURES` already carries `min_weeks` and `max_weeks` per distance, so the tile
subtitle is `${min_weeks}–${max_weeks} week plan` with **no typed number** (INV-CFG-001).

| | 5K | 10K | HM | Marathon | 50K | 100K |
|---|---|---|---|---|---|---|
| **Zonna** | 8–12 | 10–14 | 12–16 | 14–20 | **16–22** | **20–26** |
| Miles | 8–12 | 10–16 | 12–20 | 16–24 | — | — |

⚠️ Our marathon range is **shorter** than theirs (14–20 vs 16–24), which is a coaching
position, not an oversight, and the tile will make it visible. Worth knowing before it ships.

---

## 7. ✅ PROVEN, and worse than filed — the hardcoded-colour gap

All 26 rgba instances triaged by reading each one:

| Class | n | Verdict |
|---|---|---|
| **Palette at alpha** (`--moss` ×8, `--coach-ink` ×4, `--ink` ×3, `--strava` ×1, `--bg` ×1) | **17** | **Breach.** A token exists. |
| Scrim/overlay (pure white or black at alpha) | 6 | **Arguably legitimate.** No token for a scrim. |
| Other | 3 | see below |

🔴 **A BANNED COLOUR IS LIVE IN THE PRODUCT.** `components/GeneratingCeremony.tsx:265–266`:

```
/* rgba(91,192,190) = --color-teal */
background: linear-gradient(90deg, var(--border-col) 25%, rgba(91,192,190,0.14) 50%, …);
```

`rgba(91,192,190)` is **`#5BC0BE`** — the retired System-B teal, listed BANNED in
`CLAUDE.md:169` and explicitly blocked by `.githooks/pre-commit:57`. **The guard checks the
hex form only, so writing it as rgba walked straight past it** — and the comment names the
colour, so this was not accidental obfuscation, just a gap nobody knew existed. It renders
in the **generating-ceremony shimmer**, which every runner sees.

Also found: `rgba(74,154,90)` = `#4A9A5A`, a legacy green in no palette
(`DashboardClient.tsx:11092`), and `rgba(243,240,235)` = `#F3F0EB` = `--bg` at alpha
(`PhoneFrame.tsx:394`).

**This moves P-13(b) from hygiene to a demonstrated guard failure.** The SLT approved it as
engineering; this is the evidence for why.

---

## 8. ✅ PROVEN — the free tier never sees amber

`activity_intelligence` is in `FEATURE_GATES.PAID_ONLY_ONGOING`, and run analysis is what
produces `hr_above_ceiling_pct`. A free runner therefore has no drift signal and no amber.
**Confirmed as stated** — this is the tension the SLT flagged for founder confirmation, not
a defect.

---

## 9. ✅ PROVEN — the three "door" items shipped

`MARATHON-VOLUME-GATE-01` (2 registry rows), `REFUSAL-SCREEN-01` (3), `LONGEST-RUN-GATE-01`
(§113, 1). The route's hardcoded gate is gone; `app/api/generate-plan/route.ts:32–48` now
carries only a `days_available < 2` check and a comment recording the removal.
**Phases 1 and 2 had all three wrong. Corrected.**

---

## Still not proven, and why

| Claim | Provable without code? | Why |
|---|---|---|
| **P-16: the on-ramp builds the runner safely** | ❌ **No — structurally** | `measure:fitness` runs on generated plans. The cohort is refused, so there are no plans. **The only way to get the evidence is to build the shape behind a flag and generate.** That is the chair's gate and it cannot be shortcut. |
| **P-04's block needs no new data** | ⚠️ **Partly** | The columns exist and are in the fetch (`DashboardClient.tsx:1195`). Whether they are *populated densely enough* to render a weekly count needs real runners, and we have ~3. |
| **Day-one Today/Plan renders no bare zero** | ⚠️ **Only on a device** | Static read says no rendered `0%` exists (`PlanProgressBar` is dead code, 0 call sites). Confirming what a real day-one screen shows needs the app running, which is founder-owned. |

## What changed as a result

1. **P-01's argument is narrowed** — palette *strategy* convergence, measured; not value identity, falsified.
2. **P-01 loses a blocker** — the threshold is ratified; it gains a constraint (bind to `ZONE_DRIFT_ABOVE_CEILING_PCT`, never `ZONE_DISCIPLINE_BANDS`).
3. **"No make-up runs." is rejected outright**, not held for verification.
4. **The "ceilings on every easy run" caveat is withdrawn** — 100%, measured.
5. **P-13(b) gains its evidence** — a banned colour is live in the ceremony.
6. **P-05a is unblocked** — ranges read from `PLAN_SIGNATURES`.
