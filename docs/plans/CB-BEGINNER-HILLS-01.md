# CB-BEGINNER-HILLS-01 — short hill strides for beginners

**Source:** Coaching Board 2026-09-18, ruling A **as amended on corrected
evidence**. The strides half was WITHDRAWN (already satisfied by §28 — 100% of
plans, mean 10.1 stride runs). What remains is hills only.

## 1. The gap, measured

| level | plans with ANY hills |
|---|---|
| beginner | **0.0%** |
| intermediate | 43.7% |
| experienced | 40.5% |

**Nobody decided beginners should not do hills.** It falls out of a type
assignment: `session-catalogue.md` types `hill_reps` as **`vo2max`** and
`aerobic_hills` as `intermediate`-minimum, and
`QUALITY_SESSIONS_PER_WEEK_MAX.beginner = 0` (§110, ratified). Hills reach
beginners through no path at all.

Willy: *"A short hill sprint is not a VO2max session. Six by ten seconds up a
moderate gradient is neuromuscular and tendon-loading — eccentric-heavy, builds
the tissue stiffness pure easy volume does not, and carries lower impact per
unit of stimulus than flat fast running because the ground comes up to meet
you."*

## 2. Design — same mechanism as §28, not a new one

A hill stride is a **coach note on an easy run**, exactly as §28's strides are.
That is what makes it structurally impossible for it to count as quality: the
session's `type` stays `easy`, so `QUALITY_SESSIONS_PER_WEEK_MAX` and §1's
session-count distribution are untouched **by construction**, not by a rule
somebody has to remember.

⚠️ **ALTERNATE WITH STRIDES — do not add a second neuromuscular session.** The
board authorised hills *"dosed like §28's strides"*. Beginners already get one
stride run per week; adding a hill run on top would DOUBLE the neuromuscular
dose, which no seat asked for and which Willy would object to. So on hill weeks
the stride run **becomes** the hill run. Total dose is unchanged; variety
increases, which is McMillan's separate point arriving for free.

⚠️ **Beginners only.** Intermediate and experienced already get real hills
(43.7% / 40.5%) through the catalogue. Extending this to them would give them a
second, weaker hill stimulus they have not asked for.

## 3. Build order, tested at each step

1. Config: `BEGINNER_HILL_STRIDE_EVERY_N_WEEKS`, reusing `STRIDES_FIRST_WEEK`
   for onset (DRY — one onset constant, not two).
2. Placement in `buildWeekSessions`, at the §28 site, sharing its day-selection
   and blocking rules (day before the long run, day after quality).
3. Principle: §28 amendment — strides and hill strides as ONE neuromuscular
   family, rather than a new section that splits the rule.
4. Invariant: a beginner plan carries neuromuscular stimulus at the governed
   cadence, and hill notes never appear on a quality-typed session.
5. Measure: `measure:fitness`, `cohort:shape` (**will move — adding a session
   shape to 100% of beginner plans is a population change and must be declared
   with a number**), sweep, parity.

## 4. What this does NOT do

- Does not raise `QUALITY_SESSIONS_PER_WEEK_MAX.beginner` — the board was
  explicit that it stays 0 and must not be raised.
- Does not give beginners `hill_reps` or `aerobic_hills`. Those are `vo2max` /
  `intermediate`+ and stay closed.
- Does not touch STRIDE-VISIBILITY-01 (SLT ruled separately, filed, not built).
