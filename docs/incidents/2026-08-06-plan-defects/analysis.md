# Zonna — Plan Generator Defect Analysis

**Date:** 2026-08-06
**Type:** Analysis only. No code changed.
**Subject:** First organic user ("User A") generated a plan on 2026-08-01 containing multiple defects.
**Status:** Complete. Every finding F1–F15 has a verdict with evidence.

**Method note.** User A's plan was reproduced byte-for-byte from the live rule engine — identical weekly-km series, long-run series, session-day placement, week labels, themes and `meta.notes`. Recovered inputs: `current_weekly_km: 30`, `longest_recent_run_km: 12`, `preferred_long_run_day: 'sat'`, `days_cannot_train: ['tue','sun']`, plus the values visible in `meta`. Every structural claim below is therefore reproducible, not inferred. A seven-persona simulation established which defects are universal and which are input-conditional.

---

## 1. Executive summary

Three defects are real, severe, and hit users beyond User A.

**The plan stops 11 days before race day.** `calcPlanLength` builds forward from plan start and caps length at the distance's ideal weeks, discarding the remainder. Every plan tested — all seven personas — ends 3 to 24 days short of the race. Universal.

**Heart-rate zones are wrong by 28 bpm.** The wizard reads Apple Health's highest recorded heart rate and passes it as `max_hr`. User A's is 138 — barely above their easy-run peak of 136, because they have never worn a sensor while running hard. That yields a Zone 2 ceiling of 118. Their logged easy runs average 117–129 bpm. Their own data shows 88–96% of recent running above the ceiling the plan sets. Age-derived Tanaka gives 178, ceiling 146. Affects every iOS user who connects Apple Health without a true max effort on record — likely most of the target demographic.

**Beginners get no quality sessions, but the copy promises them.** `QUALITY_SESSIONS_PER_WEEK_MAX.beginner = 0` is deliberate; week labels and themes are generated from phase names and never read session content, so week 6 reads "Build — first quality session" over three easy runs.

**Volume never progresses.** Peak week is week 3, in the base phase. Each deload ratchets the ceiling permanently downward. Code faithfully implements the documented 10% rule — this one is a coaching-rule decision, not an engineering bug.

**Cost for User A: near zero.** Three days in, zero runs logged, zero completions, no Strava. **Recommendation: correct their HR zones now (no regeneration), fix the structural defects, then offer a rebuilt plan.** Regenerating today would not help — a plan generated today still ends 3 days before their race.

**Added by SLT review (§11):** pause acquisition until the first four fixes land — every user acquired meanwhile is burned *and* contaminates the INSTRUMENT-01 baseline. And the enricher silently not running (N1) is commercially worse than it looks: it is indistinguishable from "the trial user didn't find it valuable", so it corrupts the conversion diagnosis rather than just one plan.

---

## 2. Verified defect register

Severity is my ranking, not the brief's. **U** = universal, **C** = input-conditional, **I** = isolated to User A.

| ID | Claim | Verdict | Root cause | Location | Sev | Scope |
|---|---|---|---|---|---|---|
| **F2** | Plan ends 11 days before race | **Confirmed** | `totalWeeks = min(available, idealWeeks)`; weeks built forward from `plan_start`, surplus dropped from the end | [length.ts:73](lib/plan/length.ts:73), [ruleEngine.ts:2379](lib/plan/ruleEngine.ts:2379) | P0 | **U** (7/7 personas, gap 3–24d) |
| **F1** | `max_hr` 138 for a 43-year-old | **Confirmed** — hypothesis (b), via HealthKit not Strava | Wizard passes `max(heartRate samples, 90d)` as max HR; no plausibility check vs age | [clientSync.ts:143](lib/health/clientSync.ts:143), [GeneratePlanScreen.tsx:624](app/dashboard/GeneratePlanScreen.tsx:624) | P0 | **C** — every iOS user w/ HealthKit + no true max effort |
| **F4** | Labels promise absent quality sessions | **Confirmed** (mechanism differs from hypothesis) | `weekLabel`/`weekTheme` are pure functions of phase; §27 guards cover peak+taper only, not build | [ruleEngine.ts:1414–1435](lib/plan/ruleEngine.ts:1414), [:2429](lib/plan/ruleEngine.ts:2429) | P0 | **C** — all beginners (3 lying weeks each) |
| **F3** | Peak week and peak LR both week 3 | **Confirmed** — but code is correct per canon | Pass-2 cap applies to post-deload bounceback by design; each deload permanently lowers the ceiling | [ruleEngine.ts:444–457](lib/plan/ruleEngine.ts:444) | P0 | **C** — 4/7 personas peak outside peak phase |
| **F9** | 3-week taper, note says "two week taper" | **Confirmed** | Hardcoded string; HM taper is 3 weeks, marathon 4 | [ruleEngine.ts:2142](lib/plan/ruleEngine.ts:2142), config `TAPER_QUALITY_PER_WEEK` | P1 | **U** for HM+ (4/7) |
| **F8** | Recalibration weeks contain no 5K | **Confirmed** | Theme instructs a parkrun; no session is ever inserted | [ruleEngine.ts:2428](lib/plan/ruleEngine.ts:2428) | P1 | **U** (7/7) |
| **F14** | Two identical race-week shakeouts, consecutive days | **Confirmed** | `shakeout1`/`shakeout2` built from same template; differ only by a stride note | [ruleEngine.ts:970–981](lib/plan/ruleEngine.ts:970) | P1 | **U** (7/7) |
| **F6** | `race_name: "Target Race"`, `athlete: "Athlete"` | **Confirmed** | Fallback literals surface directly in user-facing copy incl. `race_notes` | [ruleEngine.ts:2713](lib/plan/ruleEngine.ts:2713), [:2453](lib/plan/ruleEngine.ts:2453) | P1 | **U** when race name omitted |
| **F5** | `hard_session_relationship: "love"` ignored | **Partially refuted** | Consumed at [:1100](lib/plan/ruleEngine.ts:1100) (LR stretch ratio) and [:1505](lib/plan/ruleEngine.ts:1505); both no-ops for User A (beginner, `<6mo`). Passed to enricher, which never ran | | P2 | **C** |
| **F7** | Generator self-report arithmetically wrong | **Refuted as stated; real defect underneath** | `peakKmActual` is computed from the finished plan, correctly — but scoped to the *peak phase*, missing the plan-wide max in base. `compressed` OR-combines two unrelated meanings and was true for 5/6 personas incl. a 'build' plan with 24 days spare | [ruleEngine.ts:2611](lib/plan/ruleEngine.ts:2611), [:2749](lib/plan/ruleEngine.ts:2749) | P1 | **U** |
| **F10** | `longest_run_ever_km` unconsumed | **Confirmed, worse than stated** | Field is in the contract but **exists nowhere in code or `GeneratorInput`**. The real field `longest_recent_run_km` *is* consumed. Week 1 at 33 km is a 10% step from User A's self-reported 30 km/wk — not reckless | [generate-plan.md:40](docs/contracts/api/generate-plan.md:40) | P2 | **U** (doc/code divergence) |
| **F11** | Peak LR 64% of race duration | **Confirmed as a rule gap** | The ≥85% floor (§45) applies to *time-targeted* HM only. Finish-goal has no floor | CoachingPrinciples §45 | P1 | **C** — finish-goal HM/marathon |
| **F12** | Pace band 81s wide | **Refuted as a bug** | `buildPaceFromVDOT` uses Daniels E-range 59–74% VO₂max end-to-end. Working as designed; whether an 81s band is useful coaching is a separate rule question | [ruleEngine.ts:121–122](lib/plan/ruleEngine.ts:121) | P2 | **U** |
| **F13** | `preferred_long_run_day` not consumed | **Refuted** | Consumed at [:1128](lib/plan/ruleEngine.ts:1128). User A's Saturday long run is correct — they blocked Sunday | | — | — |
| **F15** | 4 themes, notes on ~8/42 sessions | **Refuted on the numbers** | 6 unique themes, 13 unique labels, coach notes on **13** of 42. Still thin, but the stated figures are wrong | | P2 | **U** |

### Independent findings (Task 2)

| ID | Finding | Evidence | Sev |
|---|---|---|---|
| **N1** | **The AI enricher never landed on User A's plan.** Every label, theme and `meta.notes` is verbatim rule-engine output. A trial user paid nothing and received nothing; the failure is silent by design (ADR-006) with no telemetry | Reproduction matched labels/themes exactly; [enrich.ts:129–156](lib/plan/enrich.ts:129) returns `plan` unchanged on 4 distinct failure modes, each only `console.error` | **P0** |
| **N2** | **Observed-but-unreliable HR is never surfaced as an assumption.** `INV-PLAN-HR-ASSUMPTIONS-SURFACED` explicitly exempts the `karvonen` branch — "non-Karvonen methods surface `hr_assumption_note`". A HealthKit-sourced max lands in `karvonen`, so User A's plan carries **no** assumption note. Had HR been *missing*, they'd have been told the estimate could be ±10 bpm | [invariants.ts:1036–1047](lib/plan/invariants.ts:1036); User A's `hr_assumption_note` is absent | **P0** |
| **N3** | **No invariant asserts the plan reaches the race date.** `race_date` appears in `invariants.ts` exactly once, in a metadata mapping — never in an assertion. 37 invariants, none covering the highest-severity defect | [invariants.ts:1354](lib/plan/invariants.ts:1354) | **P0** |
| **N4** | **`INV-PLAN-THEME-MATCHES-PRESCRIPTION` is a string denylist, not a semantic check.** It matches four literals: "highest volume", "fitness is built", "intensity stays", "feel hard". "One quality session…" and "Build — first quality session" pass cleanly | [invariants.ts:319–353](lib/plan/invariants.ts:319) | **P0** |
| **N5** | **`INV-PLAN-PEAK-OVER-BASE` can be satisfied by relabelling.** A plan that fails the overload ratio passes the invariant if `volume_profile === 'maintenance'`. The engine sets that flag itself. A non-progressing plan is therefore constitutional | [invariants.ts:828](lib/plan/invariants.ts:828) | **P1** |
| **N6** | **VDOT-first fitness classification silently disables 14 weeks of intensity.** A 29:00 5K → VDOT 30.8 → `beginner` (<35). Volume-based classification would have returned `intermediate` (30 km/wk, 12 km longest). `beginner` forces `QUALITY_SESSIONS_PER_WEEK_MAX = 0`. One threshold, cascading to the whole plan shape | [ruleEngine.ts:179–188](lib/plan/ruleEngine.ts:179), [generationConfig.ts:315](lib/plan/generationConfig.ts:315) | **P1** |
| **N7** | **HR correction does not propagate to HealthKit-sourced history.** `/api/recalibrate-hr` re-buckets Strava runs from raw streams but explicitly cannot for HealthKit — "raw samples aren't stored". Correcting zones leaves HK-sourced `hr_pct_z*` permanently stale. HealthKit is the SOR (ADR-011), so this is the common case | [recalibrate-hr/route.ts:149](app/api/recalibrate-hr/route.ts:149) | **P1** |
| **N8** | **Race-week save race condition.** `handleUsePlan` persists whatever is in state. If a user taps through before `final_plan` arrives, the rule plan is saved and enrichment is lost with no error | [GeneratePlanScreen.tsx:711–722](app/dashboard/GeneratePlanScreen.tsx:711) | **P2** |
| **N10** | **`INV-PLAN-QUALITY-EXPECTED` conflicts with a legitimate reshape.** The AEF-downgrade adjustment deliberately swaps a build week's quality session to easy ("aerobic efficiency trending down") — that is the intervention working. `INV-PLAN-QUALITY-EXPECTED` then fires at **error** severity, so every such reshape records a `reshape_invalid` ops event and soft-degrades in production. Pre-existing and unrelated to Wave 1b — surfaced while closing open-Q4. **This is a textbook D-21 case**: a principle a legitimate action necessarily violates. Either the invariant must exempt weeks whose quality was intentionally downgraded (the plan would need to record that it was), or its severity is wrong. **RESOLVED 2026-08-06 — Option B (§82).** The invariant asks "did the generator build this correctly?", which is the wrong question of a week the generator no longer owns. The reshaper now records `Week.quality_downgraded` and the invariant exempts recorded downgrades; quality absent with no recorded reason still violates, so the exemption is earned rather than assumed | [invariants.ts](lib/plan/invariants.ts) `INV-PLAN-QUALITY-EXPECTED` vs [planAdjustment.ts:357](lib/coaching/planAdjustment.ts:357) | **P2** |
| **N9** | **The engine never emits a rest day, and every plan violates an error-severity invariant because of it.** §64 requires ≥1 `type: 'rest'` session per week; `INV-PLAN-WEEK-HAS-REST-DAY` enforces it at **error** severity. `generateRulePlan` emits `type: 'rest'` **nowhere** — the only producer in the codebase is `lib/plan/maintenance.ts:265`. Every plan therefore fails the invariant once per non-race week (13× for User A's), and has since R23. *Found 2026-08-06 while diffing violation counts across the GEN-FIX-03 change — the counts were identical before and after, which is what exposed the pre-existing floor.* **This is N5's pattern in its purest form**: all three constitutional layers exist and agree (principle §64, mechanical check, error severity) and the engine simply ignores all of them. It survives only because `validatePlan` throws in dev/test but *logs* in production — so the one environment that would have caught it is the one nobody generates plans in. Rest days are implicit (a day with no session), which is a defensible design; if so **§64 or the invariant is wrong**, and that is an SLT call, not an engineering one | [invariants.ts](lib/plan/invariants.ts) §64 enforcement vs [ruleEngine.ts](lib/plan/ruleEngine.ts) (no `type: 'rest'` anywhere) | **P1** |

---

## 3. Root cause clustering

The brief's first-pass hypothesis was three clusters. **Two confirmed, one refuted, two added.**

**Cluster A — Forward generation instead of backward from race date. CONFIRMED.**
Sole cause of F2. `calcPlanLength` computes available weeks correctly (15) then discards the surplus by taking `min(available, idealWeeks)` and building forward. The race date is used to compute *length* and is never used to *anchor* the final week. Isolated, mechanical, and the single highest-value fix in this document.

**Cluster B — Absent input validation. REFUTED as stated; replace with "validation exists but only checks range, never plausibility."**
`validateInputFields` enforces `max_hr ∈ [120, 220]`. 138 passes. What is missing is not validation but *cross-field* plausibility: 138 for a 43-year-old is 40 bpm below Tanaka and 2 bpm above their own easy-run peak. Both signals were available at generation time and neither was consulted. Same shape as N2 — the system distinguishes *present* from *absent*, never *present but implausible*.

**Cluster C — Copy generated from phase names rather than session content. CONFIRMED, and broader than F4.**
`weekLabel` and `weekTheme` take `(phase, weekIndex, isDeload)` and never see `sessions`. F4, F8, F9 and F6 are all instances. The §27 guards bolted on at [ruleEngine.ts:2429](lib/plan/ruleEngine.ts:2429) patch two symptoms (peak, taper) without addressing the pattern, and N4 shows the corresponding invariant repeats the same mistake at the validation layer.

**Cluster D (new) — Silent degradation with no observability.**
N1, N2, N8 and the enricher's four `console.error`-only exits. ADR-006 mandates silent fallback, which is right for availability and wrong for operations: nothing records that a trial user received an unenriched plan. This is why the defect was found by reading one user's JSON rather than by a dashboard.

**Cluster E (new) — The constitution ratifies the outcome.**
F3 and N5. The engine implements the 10% rule faithfully; the invariant permits a non-progressing plan provided it is labelled `maintenance`; the engine applies that label itself. Three layers agree, and the output is still a 14-week plan whose hardest week is week 3. This is the one cluster engineering cannot fix alone.

---

## 4. Coaching decisions requiring SLT sign-off

### D1 — Post-deload bounceback and the 10% rule (F3). **Rule defect.**

`buildVolumeSequence` pass 2 explicitly exempts deload weeks from the cap but *not* the week after: "After-deload bouncebacks are NOT exempt — this is the primary effect of the cap" ([ruleEngine.ts:441–443](lib/plan/ruleEngine.ts:441)). Deload drops to 70%; the next week may rise only 10% above *that*, i.e. 77% of pre-deload. The ceiling ratchets down every cycle, permanently.

**For the rule:** the 10% guideline is standard injury-prevention orthodoxy, and this is the most conservative reading of it. **Against:** no mainstream periodisation model applies the ramp cap to a bounceback — the near-universal convention is that a deload is a step back within a block and the following week resumes from the pre-deload level. Applied as written, it makes progressive overload arithmetically impossible in any plan with a deload, which is every plan ≥4 weeks.

**Recommendation: change the rule.** Exempt the first week after a deload from the cap, ceilinged at the pre-deload volume. Would change my mind: evidence that Zonna's specific demographic is injuring itself on bouncebacks. There is none — the product has one organic user.

### D2 — Beginners and zero intensity (F4, N6). **Rule defect in the threshold; code defect in the copy.**

Two separable decisions. **The copy is unambiguously a code defect** — promising a session that cannot exist is indefensible under any coaching philosophy. Fix regardless of D2's outcome.

The rule itself — `QUALITY_SESSIONS_PER_WEEK_MAX.beginner = 0` — is defensible: a `<6mo` runner building aerobic base needs consistency, not intervals, and this is on-brand ("You can't outrun your easy days"). **But** the classification reaching it is wrong. User A runs 30 km/week with a 12 km long run. VDOT-first classification calls them `beginner` on a 29:00 5K; the volume heuristic would say `intermediate`. A 14-week half-marathon plan with zero intensity for someone already running 30 km/week is under-prescription, and they told us they *love* hard sessions.

**Recommendation: keep the beginner ceiling at 0; fix the classifier.** Require *both* VDOT and volume to indicate beginner before applying the intensity ceiling; on disagreement, use the lower-risk structure (beginner volume) with the higher classification's intensity allowance (≥1 quality/week from build). Would change my mind: injury data showing low-VDOT/moderate-volume runners are hurt by one weekly quality session.

### D3 — Long run for finish-goal HM runners (F11). **Rule gap.**

§45 mandates peak LR ≥85% of race distance for *time-targeted* HM. Finish-goal has no floor, so User A peaks at 1:46 against a projected ~2:45 finish (64%). §45's own stated rationale — "the fatigue profile of running for ~2 hours is fundamentally different" — applies *more* to a first-timer walking the last 5 km than to a 1:55 runner.

**Proposed rule text:** *"For finish-goal HM and marathon plans, peak long-run duration must reach ≥70% of projected race duration, subject to `LONG_RUN_CAP_MINUTES`. Where the cap binds, the plan must surface the gap rather than omit it."* Recommend adopting, with the duration-based framing (not distance) since finish-goal runners are time-on-feet limited.

### D4 — What "compressed" means (F7). **Rule gap.**

One boolean OR-combines "fewer calendar weeks than ideal" and "the volume ramp never reached peak". It was `true` for five of six personas, including a 12-week 5K plan with 24 days to spare and a plan classified `build`. It feeds the enricher's confidence-score deduction ("2 if plan is compressed"), so paid confidence scores are being deducted on a near-constant.

**Recommendation:** split into `time_compressed` and `volume_constrained`; keep `compressed` as a deprecated alias for one release. Engineering-led, but it changes a paid-visible number, so it needs sign-off.

### D5 — Recalibration without a session (F8). **Rule gap.**

Two mechanisms (`recalibration_weeks`, `tune_up_callout`) that both instruct a parkrun and neither of which prescribes one. **Recommendation:** the engine should place an actual 5K time-trial session in recalibration weeks. This is also the cheapest structural fix for D2 — it gives beginners one legitimate hard effort per block without breaching the intensity ceiling, and it directly attacks F1 by generating a genuine max-HR observation.

---

## 5. Blast radius matrix

| Change | R20 reshaper (Adj-A/B/C) | R18 confidence | R24 multi-race | Strava/HK coaching pipeline | Schema | Saved & legacy plans | Free/trial/paid | Verdict |
|---|---|---|---|---|---|---|---|---|
| **F2** anchor final week to race date | Reshaper reads `week.n` (ADR-013), not array position — unaffected | none | Per-race lengths shift | none | No schema change; `weeks[]` length varies | Existing plans keep their shape; no migration path exists | uniform | **Isolated.** Highest value / lowest risk |
| **F1** HR plausibility check | none | none | none | **Cascades hard** — see below | none | Only new plans | uniform | **Cascades** |
| **F4/F8/F9/F6** copy from session content | Reshaped weeks must regenerate labels — currently they inherit | none | none | none | none | Stale copy persists on saved plans | uniform | **Isolated**, but reshaper needs the same fix |
| **F3/D1** bounceback exemption | Reshape magnitude thresholds (ADR-012) measured in % week volume — larger deltas may cross the 15% confirmation threshold and surface more tiles | Volume inputs change | none | none | none | Only new plans | uniform | **Cascades (mild)** |
| **D2/N6** classifier | Reshaper may now add quality where none existed | Scores shift | none | `zoneForSessionType` starts returning Z3/Z4 for some sessions → `hr_in_zone_pct` semantics change | none | Only new plans | uniform | **Cascades** |
| **D4** split `compressed` | none | **Directly** — enricher deducts 2 for `compressed` | none | none | `meta` field add + alias | Readers must handle both | paid-visible | **Cascades** |

### The HR cascade, specifically

`zone2_ceiling` is the denominator of the coaching signal. Changing it changes history:

1. **Displayed targets fix themselves.** `getSessionHRDisplay` ([DashboardClient.tsx:5573](app/dashboard/DashboardClient.tsx:5573)) computes live Karvonen from `user_settings` and takes precedence over baked `hr_target` — the comment says "stale `hr_target` on a regenerated user is the bug, not a feature". `effectiveZone2Ceiling` ([:1656](app/dashboard/DashboardClient.tsx:1656)) does the same. **Correcting `user_settings` corrects every displayed HR target with no regeneration.**
2. **Historical `coaching_flag` values become retroactively wrong.** User A's seven pre-plan runs carry `hr_above_ceiling_pct` of 33–96% computed against 118. Against a corrected 146 they are almost entirely in-zone. Every "you ran too hard" verdict derived from these is inverted.
3. **`/api/recalibrate-hr` cannot fully repair this (N7).** It re-buckets Strava runs from raw streams; HealthKit runs keep stale `hr_pct_z*` because raw samples aren't stored server-side. Under ADR-011 HealthKit is the SOR, so **the common case is unrepairable without re-ingesting from the device.**
4. **Aerobic pace and EF trend** derive from runs inside the Z2 band; the band moving re-selects the input set.

**Not affected:** `session_completions` (user-entered RPE/fatigue, never device-overridden per ADR-011 §3); plan structure; session IDs.

---

## 6. Integration and data-source audit

### 6a — What Zonna actually has

Two integrations. No Garmin Connect, Google Fit, Fitbit, Polar, Coros or Whoop code exists — the only references are comments noting that such data may arrive *through* HealthKit as a third-party writer.

| Integration | Status | Tier | Writes | Can influence HR fields? |
|---|---|---|---|---|
| **Apple HealthKit** (`@capgo/capacitor-health`) | Fully wired; SOR per ADR-011 | FREE | `strava_activities`, `health_daily_samples`, `user_settings.{resting_hr,max_hr}` | **YES — four paths** |
| **Strava** | Wired; OAuth pending API approval | PAID | `strava_activities` (patch-only onto an existing HK row) | **No.** `lib/strava.ts:133` *reads* `user_settings.max_hr`; no write path exists |

**The critical answer: yes, HealthKit can write `max_hr`, `resting_hr` and transitively `zone2_ceiling`, through four paths, three of them silent, none of them sanity-checked.**

| # | Path | When | Guard |
|---|---|---|---|
| 1 | `fetchAppleHealthHRSnapshot()` → `GeneratorInput.max_hr` | **At generation time** | Only if value otherwise missing. **This is the F1 path.** |
| 2 | `ConnectRunsScreen onHRFound` → `user_settings` ([:1862](app/dashboard/DashboardClient.tsx:1862)) | Post-plan onboarding | Only writes missing values |
| 3 | `AppleHealthConnectionRow onHRFound` → `user_settings` ([:11668](app/dashboard/DashboardClient.tsx:11668)) | Profile › Connections | Only writes missing values |
| 4 | Manual Profile edit → `user_settings` + `plan.meta` + recalibrate ([:2109](app/dashboard/DashboardClient.tsx:2109)) | User-initiated | User-authored |

**The defect is in how max HR is derived** ([clientSync.ts:143](lib/health/clientSync.ts:143)):

```
const maxHRRaw = hrRes.samples.reduce((m, s) => Math.max(m, s.value || 0), 0)
```

This is the maximum of up to 5,000 heart-rate samples from the last 90 days — *any* samples, including passive resting readings. It is labelled "max HR" and consumed as physiological maximum. For anyone who has not recorded a genuine maximal effort, it is simply "the hardest my watch has seen me work", which for Zonna's stated demographic is the whole point: these are people who never truly push.

**The self-reinforcing loop is real and confirmed in User A's data.** Depressed ceiling → every easy run flagged above ceiling → coaching says slow down → never approaches true max → next HealthKit read returns the same depressed value. Nothing in the system can break out of it, because path 1 only fires when the value is missing and it is now present.

Data is consumed at **both** generation time (path 1) and post-generation (paths 2–4 plus the coaching pipeline). A plan the user sees can therefore drift from the plan generated.

### 6b — What User A actually connected

Read-only. Identity confirmed by matching the incident plan JSON's `meta` signature against the `plans` table — exactly one of 13 rows matched.

| Question | Finding | Impact on F1 | Impact on remediation |
|---|---|---|---|
| Strava connected? | **No** (`strava_refresh_token` null) | Refutes hypothesis F1(b)-via-Strava | No Strava mappings to break |
| Apple Health connected? | **Yes** — `healthkit_connected_at` 2026-08-01T22:17:21Z; workouts ingested from 22:11:05 | **Confirms F1(b) via HealthKit** | HK is the only data source |
| Any integration write HR fields? | **Yes** — `user_settings` holds `resting_hr 72`, `max_hr 138`, written by the HealthKit connect flow | Establishes the mechanism | HR is correctable in `user_settings` alone |
| Activities since plan start (2026-08-03)? | **Zero** | — | **Nothing to lose** |
| Observed HR vs the 118 ceiling | 7 runs (3–27 Jul): **avg HR 109–129, peak 136**. `hr_above_ceiling_pct` 33%, 36%, 43%, 57%, 89%, 95%, 96% | **F1 confirmed empirically.** Their habitual easy running sits at or above the ceiling; a "max" of 138 is 2 bpm above their easy-run peak — physiologically incoherent | Corrected ceiling 146 puts these runs in-zone |
| RPE / fatigue logged? | **Zero** `session_completions` | — | No completion state |
| Data present at generation time? | **Yes** — HK workouts ingested 22:11:05–22:11:14; plan generated 22:15:59 | The wizard read HealthKit ~5 min after permission was granted | — |

**Timeline.** 22:08:03 trial started → 22:10:45 `plans` row created → 22:11:05–14 seven HealthKit workouts ingested → **22:15:59 plan generated with `max_hr: 138`** → 22:17:21.268 `healthkit_connected_at` set, `user_settings` HR written → 22:17:21.724 plan saved.

Also: `plan_archive` empty, `run_analysis` empty, `plan_adjustments` empty. `hr_zone_method: 'karvonen'`, `hr_assumption_note` **absent** (N2).

**On the brief's reverse case:** it does not apply — User A had connected HealthKit and 138 did come from observed data. That is better than the "worse outcome" the brief anticipated, but only narrowly: the defect is conditional on HealthKit connection rather than universal, and HealthKit is the default iOS onboarding CTA under ADR-011. Web users are unaffected; iOS users who have recorded a genuine hard effort are unaffected.

### Fields accessed (constraint 7)

| Table | Fields | Why |
|---|---|---|
| `plans` | `user_id`, `created_at`, `updated_at`, `plan_json` | Identify User A by plan-signature match; confirm saved plan is unenriched |
| `user_settings` | `strava_refresh_token`, `healthkit_connected_at`, `resting_hr`, `max_hr`, `trial_started_at`, `connect_runs_seen`, `birth_year`, `timezone` | Connection state; whether `user_settings` carries HR |
| `strava_activities` | `source`, `start_date`, `created_at`, `distance_m`, `moving_time_s`, `avg_hr`, `max_hr`, `hr_in_zone_pct`, `hr_above_ceiling_pct` | Observed HR vs the 118 ceiling — the empirical test of F1 |
| `session_completions` | all (count + `week_n`, `session_day`, `rpe`, `fatigue`, timestamps) | Size the cost of regeneration |
| `health_daily_samples` | all (count) | Corroborate HK connection / RHR |
| `run_analysis` | `created_at`, `coaching_flag`, `hr_in_zone_pct`, `hr_above_ceiling_pct`, `session_day` | Whether historical coaching signal used the wrong ceiling |
| `plan_adjustments` | `created_at`, `status` | Rows a regeneration would orphan |
| `plan_archive` | `created_at`, `plan_json.meta` HR fields | Whether an earlier plan had different HR |

No writes were issued. No fields beyond the above were read. All figures are reported in aggregate or as ranges; no identifier appears in this document.

---

## 7. User A remediation — recommendation

**Their position is the best it will ever be:** three days in, zero runs logged, zero completions, no Strava, no adjustments, no archive. Nothing to preserve. This window closes the moment they run.

**But regeneration today does not work.** Verified by running the generator with today's date: `plan_start` would be 2026-08-10, producing 14 weeks ending 2026-11-15 — **still 3 days before their race** — and still zero quality sessions. Regenerating now would replace a broken plan with a differently-broken plan while burning the one clean intervention we get.

| Path | Experience | What breaks | Possible today? | Reputational risk |
|---|---|---|---|---|
| **A — silent regeneration** | Plan changes overnight | Nothing (no state exists) | Yes | **High.** A plan that silently rewrites itself is the opposite of the brand promise |
| **B — surfaced regeneration** | Explanation + new plan | Nothing | Yes | Low, but **would ship a plan still ending before their race** |
| **C — fix forward only** | Nothing changes | Nothing | Yes | **Unacceptable.** Leaves a safety-relevant 28 bpm error in place |
| **D — split: HR now, structure surfaced later** | Zones correct immediately; rebuild offered when it is genuinely better | Historical `hr_pct_z*` on 7 HK runs stay stale (N7) | **Yes — entirely** | Low |

**Recommendation: D, executed in two stages.**

*Stage 1 — now.* Correct `user_settings.max_hr` to the Tanaka value (178, ceiling 146) and `plan.meta` alongside it. This requires **no new build**: the Profile HR editor already writes `user_settings`, syncs `plan.meta`, and triggers `/api/recalibrate-hr` ([DashboardClient.tsx:2102–2129](app/dashboard/DashboardClient.tsx:2102)), and `getSessionHRDisplay` recomputes every displayed target live. Session IDs, completion state and the trial clock are untouched. Note the HealthKit connect paths only write *missing* values, so a corrected value will not be clobbered.

*Stage 2 — after F2 and F4 ship.* Offer a rebuilt plan with an explanation. Not before: a rebuild that still ends before race day spends the trust and fixes nothing.

Why not A: silent mutation contradicts ADR-012's magnitude-calibrated confirmation model and the product's whole posture. Why not B now: it would ship a plan with F2 intact. Why not C: the HR error is safety-relevant — this runner is being told 118 bpm is their easy ceiling when their easy pace already sits at 129.

**Would change my mind:** if F2's fix is more than a few days out, escalate to B on the structural items and accept a plan ending before race day as the lesser harm — a runner following a plan that stops 11 days early will improvise the taper badly.

**No plan-migration mechanism exists.** `plan_archive` stores a pre-generation copy for data protection with no restore UI. Stage 1 needs none. Stage 2 needs a "your plan has been rebuilt" surface — roughly the existing pending-adjustment tile pattern; small, but it is a build.

### Draft copy — Stage 1 (Zonna voice)

*Revised per SLT (§11, Wood). The original draft contained "every easy run since has looked like you were pushing" — cut, because it installs a bad memory in order to apologise for it. The user may not have noticed the error at all. State what was wrong and what is now true; end on the reassuring clause.*

> **Your zones were wrong. They're fixed.**
>
> We set your Zone 2 ceiling from the highest heart rate Apple Health had on record. You'd never worn it for a hard effort, so the number was too low.
>
> Your ceiling is now 146. Your recent runs were in Zone 2 after all.
>
> Nothing else has changed.

**Delivery (SLT, Traynor):** founder-sent and personal, not a system notification or in-app card. This is the first organic user and the best customer-development conversation available; ask one question. Do **not** comp the trial or offer a discount — the trial clock is not the problem and comping it signals that it is.

### Draft copy — Stage 2

> **We rebuilt your plan.**
>
> Two things were wrong. It finished eleven days before your race. And it promised quality sessions it never scheduled.
>
> Both are fixed. Same race, same three days a week, same starting point — it now runs to race day and says what it actually gives you.
>
> Your first three weeks were right. Nothing you've done is wasted.

---

## 8. Proposed fix sequence

**Re-ordered after SLT review (§11).** Three changes from the pre-review draft: **D5 promoted from 9th to 5th** (it is the only exit from the HR feedback loop, not a nice-to-have); **N1 promoted from 8th to 2nd** (silent enrichment failure corrupts the conversion diagnosis, not just the plan); and a **new item 0** — pause acquisition — which was not in the pre-review draft at all.

| # | Item | Depends on | Size | Notes |
|---|---|---|---|---|
| **0** | **Pause acquisition spend / push** | — | — | **SLT-added (Traynor).** Every user acquired before 1–4 land is burned *and* contaminates the INSTRUMENT-01 baseline. The only item here with money attached |
| 1 | **User A HR correction** | — | XS | No build. Do today. Founder-sent (§7) |
| 2 | **N1 — enrichment outcome logging** | — | XS | **Promoted from 8.** One boolean column + weekly glance — not a dashboard. Silent enrichment failure is indistinguishable from "trial user didn't convert", so it corrupts the funnel diagnosis. N-015 class, recurring |
| 3 | **`INV-PLAN-COVERS-RACE-DATE`** (error severity) | — | XS | Land the test *before* the fix so the failure is visible |
| 4 | **F2 — anchor final week to race date** | 3 | S | `calcPlanLength` returns a plan-start offset; weeks laid out backward from race week. Delays start rather than truncating the end |
| 5 | **D5 — real 5K time trial in recalibration weeks** | — | S | **Promoted from 9.** Unanimous board priority. Refreshes VDOT *and* produces the genuine max-HR observation that F1's fix depends on. Also the contrast case that makes zone discipline learnable (§11, Wood) and the cheapest partial fix for D2 |
| 6 | **F1 — HR plausibility gate** | — | S | Flag supplied `max_hr` deviating >15% from Tanaka; when HealthKit-sourced, always emit `hr_assumption_note` and set `hr_zone_method: 'observed_max'` (N2). Requires §50 amendment. **Tanaka is a stopgap, labelled as an estimate — replaced by 5's real observation** |
| 7 | **F4/F8/F9/F6 — copy reads session content** | — | M | Fix the *mechanism*, not the sentences: if a label can't see `sessions`, it shouldn't exist. Drop placeholder literals; taper note derives from actual taper length |
| 8 | **N4 — semantic theme invariant** | 7 | S | Replace the four-literal denylist with "copy naming a session type must have that type present that week" |
| 9 | **D1 — bounceback exemption** | SLT ✅ | S | Approved. Rewrite §2's *"Why"* — cite Nielsen / ACWR, drop "it's a coaching cliché because it works" |
| 10 | **N6 / D2 — dual-signal classifier** | SLT ✅ | M | Approved. Require VDOT *and* volume to agree before applying the beginner intensity ceiling |
| 11 | **D3 — finish-goal long-run floor** | SLT ✅ | S | Approved **differently**: duration-based, run-walk permitted explicitly in the session note, surfaced early, honest note when the time cap binds |
| 12 | **F7/D4 — split `compressed`** | SLT ✅ | S | Paid-visible. Ship in the same release as the confidence-score touch; don't announce |
| 13 | **F14 — differentiate race-week shakeouts** | — | XS | |
| 14 | **N7 — HK re-bucketing** | — | M | Either store HK HR histograms at ingest or trigger device-side re-ingest on HR change |
| 15 | **F10 + feature-registry reconciliation** | — | XS | Remove `longest_run_ever_km` from the contract or implement it. **And correct the registry**, which records "max_hr field removed from wizard / Tanaka" — contradicted by the HealthKit path with no entry |
| 16 | **User A Stage 2 rebuild** | 4, 7 | S | Plus the notification surface. **~2-week clock** (§11 conflict 3) — if 4 and 7 slip beyond that, revisit and escalate to path B |

Items 0–4 matter this week. Items 9–12 were blocked on §4 and are now unblocked.

---

## 9. Verification strategy

**Deploy-blocking (error severity, in `validatePlan`):**

- **`INV-PLAN-COVERS-RACE-DATE`** — the final week's date range must contain `meta.race_date`. Closes N3, the gap that let the highest-severity defect ship. **Block.**
- **`INV-PLAN-COPY-MATCHES-SESSIONS`** — no week label or theme may name a session type absent from that week's `sessions` (replaces N4's denylist). **Block.**
- **`INV-PLAN-HR-PLAUSIBLE`** — `max_hr` within 15% of Tanaka, or `hr_assumption_note` present. Amends the §50 exemption in N2 so *observed* values are surfaced like *estimated* ones. **Block.**
- **`INV-PLAN-TAPER-COPY-MATCHES-DURATION`** — no coach note may state a taper length differing from the actual taper phase. **Block.**

**Warn severity:**

- **`INV-PLAN-PEAK-IN-PEAK-PHASE`** — plan-wide max `weekly_km` should fall in the peak phase. Warn until D1 is decided, then promote to error. Currently fails 4 of 7 personas.
- **`INV-PLAN-NO-PLACEHOLDER-COPY`** — no user-facing string contains "Target Race" or "Athlete".
- **`INV-PLAN-RECALIBRATION-HAS-SESSION`** — a week whose theme instructs a time trial contains one.

**Golden-plan snapshots.** Commit the seven personas used here (P0 is User A's exact reproduction) as fixtures with full JSON snapshots. They already discriminate: 4/7 peak outside the peak phase, 2/7 have zero quality, 7/7 fail race-date coverage. Snapshot diffs on any engine change. **Block on unreviewed diff.**

**Input validation bounds for HR.** Keep the `[120, 220]` range check and add the cross-field plausibility gate above — the lesson of Cluster B is that range checks alone cannot catch a physiologically incoherent value that happens to sit inside the range.

**Extend `scripts/property-validate-plans.ts`** to sweep `max_hr` (absent, Tanaka, Tanaka −30%, observed-low) × HealthKit-connected states. The existing sweep has no HR dimension, which is why F1 was invisible to it.

**Enrichment.** Add a test asserting a trial plan's labels differ from `weekLabel()` output when the enricher succeeds — the assertion that would have caught N1. Non-blocking (external API), but alert on failure rate.

---

## 10. Open questions

1. **Why did enrichment not land (N1)?** Four silent exits and one client race condition; nothing is logged persistently. Vercel logs for 2026-08-01T22:15–22:17Z would settle it. Needed before sizing item 2.
2. **What is User A's true max HR?** Tanaka's 178 is an estimate with ±10 bpm population spread. A real observation needs a hard effort with the watch on — which is exactly what item 5 (D5) produces. Stage 1 uses Tanaka as the best available estimate, not as truth, and must be labelled as such.
3. ~~**How many other users are affected?**~~ **ANSWERED 2026-08-06** — `scripts/gen-fix-01-user-a-hr.ts --survey` (read-only, aggregate-only output). **1 of 13 plans flagged**: User A's, at −22% from Tanaka. No other live plan has an implausible `max_hr`.
   **Read this precisely.** It means *current exposure* is one user, not that the mechanism is rare. The other 12 are largely founder/test accounts, several predate the HealthKit auto-populate path, and any user without a HealthKit connection takes the Tanaka branch and is unaffected by construction. **The defect remains universal-in-mechanism for iOS users who connect Apple Health without a recorded maximal effort** — which is the intended acquisition path (ADR-011: HealthKit-only on day one). GEN-FIX-05's urgency is unchanged; what drops is the size of any backfill. Re-run `--survey` after acquisition resumes.
4. **Does the reshaper regenerate labels?** I did not trace R20's Adj-A/B/C label handling. If reshaped weeks inherit rule-engine copy, item 7 must cover that path too.
5. **Is `hr_pct_z*` recoverable for HealthKit runs (N7)?** Depends on whether the device retains samples beyond the ingest window and whether `@capgo/capacitor-health` can re-read them. Determines whether item 14 is a re-ingest or a store-at-ingest change.
6. **Should `plan_archive` gain a restore path?** Not needed for User A, but Stage 2 and any future migration would be materially safer with one.
7. **What is the voice pattern for "we got something wrong"?** *(SLT-raised, §11.)* `brand.md` allows one sentence, with the post-run reframe the only sanctioned exception. A system-correction notice is neither, and Stage 1's copy runs to four sentences. Needs a pattern added to `brand.md` rather than a quiet breach — this will not be the last correction Zonna has to send.
8. **Is acquisition currently running?** *(SLT-raised, §11.)* Fix-sequence item 0 assumes there is a tap to turn off. I did not verify whether any paid spend, ASO push, or waitlist send is live. If none is, item 0 costs nothing and can be struck.

---

## 11. SLT review

Board convened 2026-08-06 on the five §4 decisions plus the §7 remediation call. Members: Sutherland (behavioural), Fried (growth/retention), Hutchinson (performance science), Wood (habit science), Traynor (commercial). Full transcript retained in session; material positions below.

### Verdicts

| # | Decision | Verdict | Change from §4 |
|---|---|---|---|
| **D5** | 5K time trial in recalibration weeks | **Build first** — unanimous | **Promoted 9th → 5th, and reframed.** Not a bug fix |
| **D1** | Exempt post-deload bounceback from the 10% cap | **Build** — unanimous | Unchanged; §2's rationale must be rewritten |
| **D2** | Dual-signal classifier; keep beginner ceiling at 0; fix copy | **Build** — unanimous | Unchanged; sharpened to "fix the mechanism, not the sentences" |
| **D3** | Finish-goal long-run floor | **Build differently** | **Changed** — duration-based, run-walk permitted, surfaced early |
| **D4** | Split `compressed` | **Build** — no debate | Unchanged |
| **§7** | User A — path D, two stages | **Confirmed**, two amendments | Copy revised; delivery changed; ~2-week clock on Stage 2 |

### Positions that changed the analysis

**D5 is load-bearing, not cosmetic (Hutchinson, Wood, Sutherland — converging from three lenses).** Everything downstream — paces, zones, confidence score — descends from two unrefreshed numbers: a VDOT from one stale 5K, and a max HR inferred from passive watch data. The only exit from F1's feedback loop is a genuine maximal effort, and the plan structurally forbids one. A scheduled time trial refreshes both. Wood adds the behavioural case: forty-two sessions of one type is not restraint, it is an **absence of contrast**, and zone discipline is a discrimination behaviour that cannot be learned from a single exemplar. One hard effort per block is what makes the other eleven sessions legible as a choice. Sutherland: restraint is only legible if there is something to restrain from.

**The HR defect inverts the core positioning (Sutherland).** `brand.md` claims the edge as *"Runna has no point of view on effort — Zonna tells you when you're overcooking."* The observed-max mechanism is guaranteed to be **most wrong for the ideal customer**: the target user is defined as someone who never truly pushes, so their observed maximum is definitionally not their maximum. The better a user fits the segment, the more wrong the number. The product's one differentiating opinion fired at the one person who did not deserve it.

**Learned disregard is the real cost (Wood).** A signal firing on 89–96% of repetitions carries no information and cannot shape behaviour. What it does teach is that the feedback is noise — and that lesson generalises to the corrected version. Miscalibration is recoverable; learned disregard requires re-earning attention against a direct memory of being wrong. This is the argument for urgency on Stage 1, not for delaying it behind structural work.

**§2's stated rationale is not defensible (Hutchinson).** The current text — *"The 10% rule is a coaching cliché because it works"* — is contradicted by Buist (2008), which found a graded 10%/week programme produced no injury reduction versus control. Nielsen's work points at change relative to recent chronic load, which is the ACWR basis this product already uses elsewhere. Under any ACWR framing, returning to a volume held comfortably two weeks earlier is a **low**-risk week. Rewrite the "Why", don't just change the config.

**N1 corrupts the conversion diagnosis, not just one plan (Traynor).** Silent enrichment failure is indistinguishable from "trial user didn't find it valuable." A funnel cannot separate them. The likely wrong conclusion — "the paid tier is weak, rebuild it" — would be caused by a missing log line. Compounding: a trial user reaching day 14 in an all-easy plan with no enrichment has experienced approximately none of what they would be paying for. This is the N-015 failure class recurring in the one path that produces the paid product, three weeks after W1 was declared to have closed it.

**Sample size is the uncounted casualty (Traynor).** One organic user, one plan, six defects. INSTRUMENT-01 shipped in W0 specifically to provide measurement; that baseline is now being built from a contaminated cohort. Hence fix-sequence item 0.

### Live conflicts

1. **Hutchinson vs Sutherland on D3.** Sutherland: raising the long-run floor increases dropout and injury risk; solve for the start line, not race day. Hutchinson: a progressive long run is the *least* injurious way to add load — the risk framing is backwards. **They are arguing about different risks** — physiology versus adherence. Resolved by Wood's framing: duration-based floor, run-walk permitted explicitly, surfaced early enough to arrange the Saturday. This is why D3 is "build differently" rather than "build".

2. **Fried vs the existence of this review.** D1/D3/D4 are afternoon fixes that reached a board because the code faithfully implemented the canon, and the canon is treated as constitutional. **This is a governance gap.** Proposed rule about rules: *a principle that no plan can satisfy without producing a bad plan is a defect in the principle; fixing it is an engineering call, not a board one.* Worth adding to the architectural principles — otherwise every future rule defect takes the same slow path.

3. **Wood vs the two-stage sequencing.** Not a true conflict — Stage 1 is already today — but it puts a clock on Stage 2. If items 4 and 7 slip beyond roughly two weeks, revisit: a plan ending 11 days before the race begins doing its own damage.

### MUST/NEVER check on the revised recommendation

| Rule | Status |
|---|---|
| INV-CFG-001 / 003 — no inline coaching numerics | ⚠️ D1's exemption, D3's duration ratio and D5's cadence must all land in `GENERATION_CONFIG` |
| INV-CFG-002 — principle backstop | ⚠️ D1, D3, D5 each need a `CoachingPrinciples.md` section in the same commit; §2 needs its rationale rewritten |
| N-015 — no silent failure without a backstop | 🔴 **Currently violated in spirit by N1.** Fix-sequence item 2 |
| INV-CFG-005 — brand/pricing singularity | ✅ No pricing in any copy |
| No popups / modals | ✅ Stage 1 passive; Stage 2 uses the pending-adjustment tile pattern |
| No gamification | ✅ Nothing proposed uses streaks, badges or social comparison |
| Voice rules | ⚠️ Stage 1 copy is four sentences; `brand.md` sanctions only the post-run reframe as a multi-sentence exception. **Genuine gap — see open question 7** |
| ADR-011 — source-agnostic queries | ✅ Nothing filters by source. N7 stands |
| ADR-012 — magnitude-calibrated confirmation | ⚠️ Stage 2 is a full plan replacement, well past the structural threshold — **must** surface. Reinforces D over A |
| ADR-006 — enricher fails silently | ✅ Unchanged for the user; item 2 adds operator-side observability only |

### Registry divergence found during review

`docs/canonical/feature-registry.md` records **"Age field + Tanaka max HR | FREE (infra) | R24 — Max HR calculated via Tanaka formula (208 − 0.7 × age). max_hr field removed from wizard."** The HealthKit auto-populate path reintroduced a `max_hr` input source that bypasses Tanaka, with no registry entry. F1 is therefore not only a defect but an **undocumented reversal of a registered decision**. Correcting the registry is fix-sequence item 15 and should happen regardless of the D-decisions.

---

*No code was changed in the production of this analysis. No production data was written.*
