# Ops digest triage — 2026-10-09 (worked through 2026-10-10)

**Why this file exists, and it is a gap being closed rather than a record being tidied.**
The 2026-09-25 digest triage has a decision note; **this one did not**, so "what is still
outstanding from yesterday's digest?" had to be reconstructed from session memory every time
it was asked — and it was asked repeatedly. `audit-docs.sh` does not check for a digest note,
so nothing flagged the absence. **This file is the single place that answers the question.**

**Provenance boundary, stated because it is where the answer goes wrong.** Three waves ran on
2026-10-09, and only the first two came from the digest. A ship on those dates is **not**
evidence it was digest-derived: `WIZARD-*`, `PRINCIPLE-COVERAGE-POPULATION-01`,
`BACKLOG-OPEN-SET-01` and `V1-DELIVERED-TAIL-01` came from board rulings, and
`STORED-PLAN-DEBT-QUEUE-01` was filed 2026-10-04. Each row below names its origin.

**Verified against live Supabase (`wkppmpsvqkaxbekdgzdm`) or by regeneration on the current
build. Status derived from the records, not from recall.**

---

## Wave 1 — the morning alert

The digest escalated an **"engine regression"**. It was a monitoring bug, and the real defect
was underneath it.

| Item | Status | Record |
|---|---|---|
| `RECAL-PACE-TWO-WRITER-01` — a confirmed recalibration moved the display and left the prescription | ✅ SHIPPED | registry |
| `AUDIT-FOUNDATION-MISCOUNT-01` — `week: 0` means "plan-wide" to invariants and "foundation" to ADR-020; **19 plans misreported, 100% wrong** | ✅ SHIPPED | registry |
| `FOUNDATION-PACE-STRIPPED-01` — `generateFoundationBlock` had **never** set a pace or HR target (381 of 381) | ✅ SHIPPED | registry |
| `RECAL-LIVE-REPAIR-01` — three live plans repaired and verified from the database | ✅ SHIPPED | registry |
| `DUNCAN-RESIDUAL-LOAD-01` — 9 errors → 1 | ✅ SHIPPED | registry |
| `DIGEST-REPAIRABLE-01` — the digest now says what to DO, standing and self-clearing | ✅ SHIPPED | registry |

---

## Wave 2 — the founder's 10-issue triage

| # | Issue | Verdict | Status |
|---|---|---|---|
| 1 | The second plan producer never stamped `generator_input` (9 of 34 plans) | REAL | ✅ `BASEBUILD-GENINPUT-01` |
| 2 | Those 9 reported under one cause — **28% of the fleet's errors were phantoms**, the audit running the RACE validator on base-build plans (mean 50.5 vs 8.2; fleet 363 → 262) | REAL, **and the checker was the broken thing** | ✅ `BASEBUILD-AUDIT-BLIND-01`, `AUDIT-MAINTENANCE-KIND-01` |
| 3 | The TS union widened while the Zod twin still rejected `base_build` on exactly those 2 of 34 | REAL (half a pair, mine) | ✅ `BASEBUILD-SCHEMA-KIND-01` |
| 4 | **Q2 — the trial KPI could never move.** It counted `subscriptions.status='trialing'`; the reverse trial is not a subscription. Live: **0 → 5 on trial, 1 at risk** | REAL | ✅ repo side `OPS-DIGEST-TRIAL-COHORT-01` · 🔻 **FOUNDER: paste into the cloud routine** |
| 5 | A designed refusal recorded **no level at all** — 20 events, 0 levels, inert from day one | REAL | ✅ `REFUSAL-TELEMETRY-LEVEL-01` |
| 6 | A raw `{{token}}` reached the post-generation screen | REAL | ✅ `COACH-INTRO-TOKEN-01` |
| 7 | 49 placeholders in `week.theme`; a 72-line component rendered it RAW with **zero** render sites | REAL | ✅ `WEEK-THEME-DEAD-01`, `WEEKTHEME-PROP-DEAD-01`, `WEEK-THEME-TOKEN-ENRICH-01` |
| 8 | **Q9 — "no cancellations" while 3 were arriving a fortnight.** The query selected only the kinds we alert on, so an event we had *decided* not to act on was indistinguishable from one that never arrived | REAL | ✅ repo side `OPS-SUBS-UNHANDLED-SEEN-01` · 🔻 **FOUNDER: paste into the cloud routine** |
| 9 | "The AI says 126, the engine says 118 — qualify the wording" | **PREMISE FALSE.** Not wording: `V4` bumped a long run in the **taper**, which §6 Am.1 already forbade | ✅ `LR-TAPER-BUMP-01` · the long-run-by-phase arm is `LR-PEAK-NOT-LONGEST-01` |
| 10 | The two unstamped base-build plans cannot be backfilled — the race date is gone | **PREMISE FALSE, and it was mine.** The date was in `plan_refused_by_design.weeks_to_race` — see below | ✅ `BASEBUILD-GENINPUT-REMEDIATION-01` |

⚠️ **Item 10's correction is the one worth keeping.** The entry asserted the race date was
*"not approximate — it is gone"* after three stores were checked, while **the roadmap row for
the same item already recorded that it was recoverable**. Two registers, disagreeing, with one
author in between. It survived in `plan_refused_by_design.weeks_to_race`; the founder's
question — *"can we not recover it?"* — is what found it. The subsequent inversion was then
wrong in both anchor and rounding, producing a window that **excluded the founder's own
answer**. Honest limit: the telemetry pins a **7-day window, not a day**.

---

## OUTSTANDING — the whole answer, nothing else open from this digest

### 🔻 Founder-owned (2 items, one sitting)

Both are shipped on the repo side and **have no effect until the cloud routine's prompt is
updated**. The routine lives at claude.ai, not in this repo, so nothing here can apply them.

| | What | Consequence of not doing it |
|---|---|---|
| **Q2** | `docs/runbooks/digest-trial-funnel.md` | the trial funnel reads **0 every morning**, and `at_risk_trialing` — which the prompt tells itself to "always surface prominently" — can never fire |
| **Q9** | `docs/runbooks/digest-subscription-observed.md` | subscription events we chose not to act on stay invisible. 🔴 **BOTH HALVES OR NEITHER** — the SQL without the rendering rule makes the digest scream at **every charity redemption**, because an offer code with auto-renew off emits `CANCELLATION` ~2 min after each one |

### 🔻 Opened BY this work, not pre-existing (3 items)

All three came out of item 10's build, and none existed before 2026-10-10.

| Item | Owner | Why it is not mine to build |
|---|---|---|
| `BASEBUILD-HANDOVER-01` | 👤 FOUNDER → 💼 SLT → 🧭 DESIGN | 🔴 **I filed this on a false premise; see the backlog entry.** `base_build_onramp` is **`undefined`** on both plans — `generateGetRunningPlan` deletes it on purpose, so the code never claimed a handover. Measured: Sheena's race plan **generates (14 weeks)** at handover; Tom's needs a short-prep acknowledgment. **The gap is a product decision never taken, not a defect.** Both end in January racing 24 Apr. **Time-boxed.** |
| `BASEBUILD-ADJUST-MONOTONIC-01` | 🏃 COACHING BOARD | §111 is monotonic in `current_weekly_km` only; a *tighter* weekday cap and an injury the runner does not have each ADMIT a plan the honest answer is refused. **Coaching logic needs sign-off — proposed, not built.** |
| `BASEBUILD-ADJUST-REBUILD-01` | 🧭 DESIGN BOARD | The destination the door ruling bound itself to. Sierra's dissent is the driver. |

### 🔻 Digest-adjacent, awaiting sign-off (1 item)

`LR-PEAK-NOT-LONGEST-01` — the Coaching Board ruled 2026-10-10 **CORRECT IN PART**. The TAPER
arm was already §6 Am.1 (0 breaches); the BUILD arm is INSUFFICIENT EVIDENCE on a §24b
measurement that does not exist; **the BASE arm (309 plans, 10.8%) is ruled correct and awaits
the founder**, because it changes prescription for roughly 1 plan in 10.

### ✅ Not outstanding, and explicitly so

Every other code defect from both waves carries a feature-registry row and a build-log entry.
**Nothing from this digest is sitting unowned or unrecorded.**

### ⚠️ What this note does not cover

Pre-existing items the digest *reports on* but did not raise: `STORED-PLAN-DEBT-QUEUE-01`
(filed 2026-10-04), the charity SQL-editor founder action (2026-09-24), and
`DELIVERED-TAIL-LEVERS-01` (board thread, blocked on outcome data by §2 Amendment 2).
**And nothing in any wave has run on a device.**
