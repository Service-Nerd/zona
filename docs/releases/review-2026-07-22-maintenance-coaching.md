# Review — ZONA maintenance-phase coaching vs external coach (2026-07-22)

**Type:** Review & report only. No code, schema, or content was changed. All build ideas live in §4 as recommendations.
**Reviewer context:** developer + primary user, 10 days post-100k (Race to the Stones, 11 Jul 2026), in the app's maintenance phase, next race undecided. Race limiter was **eccentric quad failure on descents** (aerobic/heat/pacing all held).

---

## 1. ZONA maintenance logic, as-is

### Where it lives
| Concern | File |
|---|---|
| Generator | `lib/plan/maintenance.ts → generateMaintenanceBlock()` |
| Numerics | `lib/plan/generationConfig.ts → GENERATION_CONFIG.POST_RACE_MAINTENANCE_BLOCK` + `POST_RACE_RECOVERY_BY_DISTANCE` |
| Constitution | `docs/canonical/CoachingPrinciples.md §75` |
| Mechanical validation | `lib/plan/invariants.ts → validateMaintenanceBlock()` (5 invariants) |
| Trigger + persistence | `app/api/maintenance-block/route.ts`, fired by a `DashboardClient` effect |
| Race inputs | `types/plan.ts → RaceResult` (embedded on the race `Week.result_embedded`) |

### How it activates
`DashboardClient` calls `POST /api/maintenance-block` once when: plan is date-complete **and** the race week has `result_embedded` **and** no maintenance weeks exist yet. The route computes plan peak `weekly_km`, appends maintenance weeks to `plan.weeks`, saves. Idempotent.

### The only inputs it actually consumes
From the whole rich `RaceResult`, the generator reads **exactly two fields**: `rpe` and `outcome`. Plus, from elsewhere: `plan.meta.race_distance_km`, `plan.meta.days_available` (default 4), and the computed **plan peak `weekly_km`** (floored at 20).

**Everything else the runner logged about the race is ignored by the generator** — `splits`, `hr_drift_pct`, `what_broke`, `strategy_outcome`, `notes`. Critically, **there is no limiter/injury field at all**; `what_broke` is free text reserved for a future reshape feature (AI-DEPTH-08), not a structured input.

### The rules (what it produces)
Two phases, distance-keyed:

- **Phase 1 — Restoration** (`maintenance_restoration`). Quality blackout: easy runs + rest only. Weekly volume follows the post-race recovery curve (`% of peak`). Duration by distance: 5K/10K/HM=1wk, Marathon=2–3, 50K=3, **100K=4**. Modifiers stack: `rpe ≥ 8 → +1 week`, `outcome==='dnf' → +1 week`.
- **Phase 2 — Base** (`maintenance_base`). Volume **flat at 70% of plan peak** (hard ceiling 75%). One **mild** quality session/week (an *easy run with 4×20s strides*), starting in **week 2** of Phase 2. Duration: 100K=7wk. Final 2 weeks are "Phase 3" (ambient re-engagement — just a theme change).

Session distribution (`buildSessions`): training days are hardcoded **Mon/Wed/Fri/Sat** (Thu added if `days_available>4`); rest is **Tue/Thu/Sun**. **Saturday is the long day** (~35% of weekly km); the other days split the remainder evenly. Sessions carry `distance_km` + `zone: 'Zone 2'` only.

### What it would generate for *me*, right now
100k finish (not DNF), and a 40km-walk finish is unambiguously `rpe ≥ 8` → **Phase 1 = 4 + 1 = 5 weeks**, **Phase 2 = 7 weeks** → a **12-week** block:

- **Phase 1 (5 wks):** volume ramps **10% → 25% → 40% → 55% → 70%** of plan peak. All easy Zone 2 + rest. Mon/Wed/Fri short easy, Sat "long easy," Tue/Thu/Sun rest.
- **Phase 2 (7 wks):** **flat 70% of peak**, every week. From week 2, Saturday becomes "easy with strides."
- **Long run:** Saturday, distance-based (no `long_run_hrs`), ~35% of the week.
- **Voice:** flat/factual ("Restore. Nothing more." / "Back to base."). No celebration. (AI voice enrichment, MAINT-02, is not built — so it's rule-engine copy only.)

*(Illustrative: if the 100k plan peaked at ~70 km/wk, Phase 2 holds ~49 km/wk — a ~17 km Saturday + three ~10.5 km midweek runs. The exact numbers scale with your plan's actual peak.)*

---

## 2. Side-by-side — ZONA vs coach (running only)

| Dimension | External coach | ZONA | Verdict |
|---|---|---|---|
| Intensity | All easy Z2, **no strides/quality** whole block | Easy Z2; **adds mild strides from Phase 2 wk 2** | ~Agree, mild divergence |
| Recovery-is-the-constraint stance | Explicit, central | Explicit (§75 doctrine) | **Strong agree** |
| Midweek runs | Short (~5 km), **flat**, barely grow | Scale with weekly volume (~10 km at 70% of a big peak) | **Diverge (volume + growth)** |
| Progression location | Parked in the **weekend long run** only | Phase 1 ramps *everything*; Phase 2 is **flat** | Diverge |
| Terrain | **Keep flat, avoid downhills** (knee) | **Silent** — no terrain/elevation concept | **Diverge (silence on the key point)** |
| Long-run day | **Sunday** | **Saturday** (hardcoded) | Diverge |
| Long-run unit | **Time** (60→90 min) | **Distance** (km) | Diverge |
| Long-run shape | Gently **progresses**, then travel-week pullback | Phase 1 ramps; Phase 2 flat; no travel-week awareness | Partial |
| Week 1 framing | A **knee test** — regress on sharp pain → physio | A light restoration week; **no injury-response logic** | Diverge |
| Non-impact aerobic top-up | **Bike** Z2 (protect knee, aid fat-loss) | **Silent** — no cross-train generated | Diverge |
| Overall volume | Minimalist (recovery + quit + deficit) | 70% of plan peak (can be ~2× the coach) | **Diverge (likely too much)** |
| "Don't add load to fill time" guardrail | Explicit | Implicit via the 75% ceiling + 1-quality cap | Agree (for running) |
| Strength & conditioning | Half the plan | **None** (running-only; `STRENGTH_ENABLED=false`) | Absent (see §4) |

**Headline:** on the *running-recovery philosophy* — quality blackout, restraint, recovery-first, flat base, hard volume ceiling, no celebration — **ZONA and the coach genuinely agree**. §75 is a good doctrine. The divergences cluster in (a) things ZONA can't see and (b) distribution rules it lacks.

---

## 3. Divergence analysis — cause of each

Classified as: **[INPUT]** missing input · **[RULE]** missing rule the engine could have · **[SIMP]** deliberate simplification · **[GAP]** genuine gap.

1. **Terrain / avoid-downhills — [INPUT] + [GAP].** The single most important divergence. ZONA has no terrain/elevation/descent concept anywhere in session generation, and no structured limiter field to know the knee/eccentric-quad is the weak link (`what_broke` is free text the generator never reads). It cannot say "keep it flat." **This is the clearest place ZONA is potentially *worse* than the coach** — not by actively routing you downhill (it never says *where* to run), but by being silent on the one variable that ended your race. A runner who reads "17 km easy Zone 2" and feels aerobically fine may run their normal hilly route — exactly the contraindicated eccentric load.

2. **Overall volume too high — [INPUT].** Phase 2's 70%-of-peak is a defensible *generic* number (§75), but it anchors to your 100k plan's peak, not your current recovery state. Stack three constraints ZONA can't see — 10 days post-100k, quitting smoking, calorie deficit — and 70% of a big peak is likely **more than the coach would prescribe** (~2×). ZONA isn't wrong for its inputs; it's blind to the inputs that would lower the number. **Second place ZONA may give worse guidance.**

3. **Midweek doesn't stay parked — [RULE].** ZONA distributes volume evenly (Sat 35%, rest split equally), so midweek grows with weekly volume. The coach's "park midweek at ~5 km, progress only the long run" is a *distribution philosophy* ZONA doesn't encode. Purely a missing rule — no input needed.

4. **Long run on Saturday, not Sunday — [RULE].** ZONA *has* the input (`plan.meta.preferred_long_run_day: 'sat'|'sun'`) but the maintenance generator **ignores it** and hardcodes Saturday (`maintenance.ts` line ~130). Missing rule / small oversight — the data is already there.

5. **Long run by distance, not time — [RULE/SIMP].** ZONA supports a duration metric elsewhere (`primary_metric`), but the maintenance builder writes `distance_km` and leaves `long_run_hrs: null`. Recovery blocks are arguably better time-capped. Missing rule.

6. **Strides introduced in Phase 2 — [SIMP] vs [INPUT].** ZONA re-stimulates gently by design (§75). The coach defers even strides — because of constraints ZONA can't see (quit + deficit + knee). The *rule* is a reasonable simplification; the *divergence* is a missing input.

7. **No "knee test / regress on pain" logic — [GAP].** ZONA has no injury-response branch anywhere (no "sharp pain → regress + refer"). Genuine gap; also needs an input (a live symptom signal).

8. **No bike/cross-train option — [RULE].** §75 *permits* cross-training in Phase 1, and the invariant allows it, but the **generator never produces a cross-train session** (`buildSessions` only makes easy/rest/mild-quality). So a non-impact aerobic option — exactly what a knee-limited runner needs — can't be offered. Missing rule (principle already exists).

9. **Phase 2 flat vs gently-progressing long run — [SIMP].** Deliberate per §75 ("holding a base, not ramping toward anything"). Legitimate design choice; the coach's gentle progression is a different (also valid) philosophy.

10. **Smoking cessation invisible — [INPUT].** ZONA sees elevated easy-pace HR only *reactively* (readiness signal on RHR/HRV, and only in the live plan, not the static maintenance block). It has no life-factor input to *proactively* ease the block for a quit. Missing input.

11. **Beach/body-comp goal invisible — [INPUT].** ZONA has no body-composition or fat-loss concept, no notion of a dated non-race goal, so it can't bias toward the bike-for-deficit suggestion. Missing input.

### Meta-verdict (the question you asked)
**Your hypothesis is substantially correct.** ZONA is producing a *defensible, doctrine-driven generic post-100k maintenance block from running data alone*, and its recovery philosophy is genuinely aligned with the coach. The bulk of the divergence is **missing inputs** (eccentric-quad/knee limiter, smoking cessation, body-comp goal) plus a handful of **missing distribution rules** (park-midweek, use the preferred long-run day it already has, generate cross-train, time-cap the long run) and one **deliberate simplification** (flat Phase 2). The gap is mostly the inputs, not the logic — **with two caveats where ZONA may actively under-serve you**: it is **silent on terrain** (the limiter that matters most) and its **volume may run high** for your current stacked constraints. Neither is a logic error; both are consequences of the engine not being able to see the knee, the quit, or the deficit.

---

## 4. S&C expansion — recommendations only (do not build)

Good news: this is **not greenfield**. ZONA already has most of the scaffolding, and there's a scoped design to reuse.

### Reuse, don't reinvent
- **Session type already exists:** `strength` is in the session-type colour map (`--s-strength #5A6578`), and `GENERATION_CONFIG.STRENGTH_ENABLED` is a real flag (currently `false`, gated on backlog **R21**). Strength stubs were an early concept (INV-PLAN-006).
- **The data model is already scoped:** backlog **"Supplementary session slots" (option B — primary + secondary)** is exactly the right shape. It adds an optional `secondary_session: Session | null` per day + a `slot` column (`'primary'|'secondary'`) to `session_completions` / `session_overrides` / `run_analysis`, with the unique constraints and every `onConflict` upsert extended to include `slot`. **This is the canonical place S&C should live** — don't invent a parallel model.
- **Catalogue pattern exists:** runs have a session catalogue (ADR-010). S&C needs an analogous **strength catalogue** (exercise, sets/reps, tempo, unilateral flag, eccentric-emphasis flag, progression rule) — same authoring pattern, new content.

### Data model (high level)
- `secondary_session` on `Week.days[day]` holds the S&C session (reuses the plan JSON-first model, INV-PLAN-001 — no new "plan" store).
- New **strength catalogue** (JSON, like the run catalogue): entries tagged by emphasis (`eccentric_lower`, `aesthetic_upper`, `mobility`, `skill`) and by phase-appropriateness.
- New generation numerics in `GENERATION_CONFIG` (never inline, per INV-CFG): sessions/week by phase, eccentric-progression rate, intra-day load caps.
- A **structured limiter/injury field** on the athlete profile *and* on `RaceResult` (see §5) — this is what lets the lower-body catalogue bias toward eccentric-durability instead of guessing.

### Generation logic (high level)
- A **strength generator** parallel to the run rule engine: deterministic-first (produces the plan), optional AI enricher for voice (same hybrid pattern, ADR-006 — and the `maintenance_coaching` PAID gate already exists for the voice half).
- **Phase-aware:** in the maintenance block specifically — Phase 1 = mobility/light + skill snacks (low systemic cost); Phase 2 = progressive eccentric-lower + aesthetic-upper. This directly serves the coach's "fix the chassis before adding distance."
- **Cross-engine interaction (the hard part):**
  - **Adjacency / load:** `buildReorderAdjustment` adjacency must go 2-D — a heavy lower session the day before/after the long run is a back-to-back-hard violation (backlog already calls this out). New intra-day load cap when primary is hard + secondary is hard.
  - **Fatigue model:** the `acuteChronicRatio` / load engine currently counts running km only. A coaching decision is needed (flag it in CoachingPrinciples) on **whether/how strength counts toward fatigue load** — the backlog explicitly leaves this open. This is the single biggest engine-integration question.
  - **Invariants:** extend `validatePlan` — secondary may only exist when primary exists; secondary type ∈ allowed supplementary types; intra-day cap. Add a strength principle to `CoachingPrinciples.md` (three-layer rule: principle → config → validator).

### UI touchpoints (high level)
- **Today:** render `secondary_session` as a **smaller, indented sub-card under the primary** (backlog rule: *one day = one block, optional sub-row* — visually subordinate, not a second equal card). Reuse the session-card left-accent language with `--s-strength`.
- **Plan screen:** `DayRow` gains a "+" ("Add a session") + slot-aware move.
- **Session detail (strength):** exercise list with sets/reps/tempo — a new detail layout, the one genuinely new screen. Trigger `frontend-design`.
- **Wizard:** one question ("Do you do strength or cross-training? We'll fit it around your runs"). Framing = *accommodation, not capability* (backlog copy already drafted).
- **Coach voice:** name doubled-day discipline when it lands ("Strength yesterday, easy run today. Kept it under control").

### Effort & risk (from the scoped backlog item)
~3 weeks, phased (schema+backfill → engine integration → wizard/AI placement → coach copy). Biggest risks: the PK-migration footprint (every `session_completions` upsert needs `slot` — grep before merge), autoMatch mis-routing (a `WeightTraining` activity arriving at a day with no secondary slot), and 3-layer invariant drift. **Scope discipline:** the backlog explicitly bans letting "slot exists" creep into AM/PM run-doubling — hold that line.

---

## 5. Open questions / missing inputs (to close the coaching gap)

The inputs, roughly in order of coaching leverage:

1. **A structured limiter / acute-injury flag.** The highest-value missing input. Not free-text `what_broke` — a typed signal (`eccentric_quad`, `knee`, `achilles`, …) on the athlete profile *and* capturable at race debrief, that the generator reads to (a) bias lower-body S&C toward eccentric durability and (b) drive terrain guidance. This single input unlocks most of the coach's diagnostic approach.
2. **Terrain / elevation modelling.** Sessions currently carry distance + zone only. A `terrain`/`avoid_descents` concept (even a boolean at the block level) would let ZONA say "keep it flat" for a descent-limited runner. Genuine gap today.
3. **Life-factor flags** (smoking cessation, acute sleep debt, high life-stress). ZONA has reactive readiness signals in the *live* plan but nothing that feeds the *static* maintenance block or that a runner can declare proactively ("I'm quitting this week — ease it").
4. **Body-composition / dated non-race goals.** No fat-loss concept and no notion of a dated non-race target (holiday, event). Would enable the bike-for-deficit and "hold volume, don't add" guidance.
5. **Cross-train generation.** The principle and invariant already permit it; the generator doesn't produce it. Wiring a non-impact option is low-hanging and directly serves injury-limited athletes.
6. **Use inputs it already has:** the maintenance generator ignores `plan.meta.preferred_long_run_day` (hardcodes Saturday) and `injury_history`. Cheapest wins — the data is already in the model.
7. **Time-capped long runs in recovery blocks** (`long_run_hrs`) rather than distance.

### Suggested framing for prioritisation (not a build order)
- **Correctness-ish, cheap:** use `preferred_long_run_day` in maintenance; generate a cross-train option; time-cap the recovery long run. Small, all reuse existing inputs/principles.
- **High-leverage, needs a new input:** the structured limiter flag + a terrain concept. These are what would have changed *your* block materially.
- **Big, scoped separately:** the full S&C dimension (§4) and body-comp goals — real product surface, best taken as the already-scoped "Supplementary session slots" work with the limiter input landed first.

---

*Report only. No code, schema, or content changed. Recommendations in §4–5 are for a future scoped build, not this pass.*
