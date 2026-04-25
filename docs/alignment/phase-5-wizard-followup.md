# Phase 5 — Wizard Changes (Follow-up Plan)

**Status:** Deferred from R23 rebuild autonomous run — needs browser-in-loop verification.
**Scope:** Update `app/dashboard/GeneratePlanScreen.tsx` and `app/dashboard/DashboardClient.tsx` to collect the new R23 wizard inputs and remove obsolete ones. Engine + API contract already accept the new fields (Phase 3).

---

## What is already done (server-side, no UI risk)

| Surface | Change | Done in |
|---|---|---|
| `types/plan.ts` | `TrainingAge` type; `GeneratorInput.training_age?`; `BenchmarkInput.benchmark_date?` | Phase 3 |
| `lib/plan/schema.ts` | Zod additions for above | Phase 3 |
| `lib/plan/ruleEngine.ts` | Consumes `training_age` for returning-runner detection; `benchmark_date` for VDOT stale discount | Phase 3 |
| `docs/contracts/api/generate-plan.md` | New optional fields documented | Phase 0.5 |

The wizard can be updated in any subsequent session without further engine changes.

---

## Required UI changes

### Add (5.3)

| Field | Wizard step | Type | Optional? | Engine effect |
|---|---|---|---|---|
| `training_age` | New step in fitness/profile group | OptionCard 4-way: `<6mo / 6–18mo / 2–5yr / 5yr+` | Optional, drives returning-runner allowance | Already wired |
| `longest_run_ever_km` | New chip selector after "longest recent run" | Chip selector or number | Optional | Not yet consumed by engine; placeholder for Phase 6+ heuristics |
| `preferred_long_run_day` | Schedule step | Toggle: Sat / Sun (default Sun) | Optional | Not yet consumed; layout currently defaults Sun |
| `treadmill_primarily` | New constraint step | Boolean toggle | Optional | Not yet consumed; affects strides/hills coaching when wired |
| `benchmark_date` | Inside benchmark step | Date picker | Required if benchmark provided | Already consumed by VDOT stale discount |

**Note:** RHR is already in the wizard (post-pull state — confirmed in pre-flight audit). MaxHR override field not yet exposed; could add as optional with "Estimate from age (Tanaka)" default.

### Remove (5.4)

| Field | Why |
|---|---|
| `motivation_type` | Phase 0 decision C-21 — never observed to change plan output |
| `training_style` | Phase 0 decision C-21 — same |

Look for `motivation_type` and `training_style` references in:
- `app/dashboard/GeneratePlanScreen.tsx` — step state, sessionStorage keys, validation, handleGenerate input mapping
- `app/dashboard/DashboardClient.tsx` — wizard prop wiring (if any)
- Any OptionCard arrays defining their selectable values

`'podium'` goal value: spec wants this removed but never existed in current code (`goal: 'finish' | 'time_target'`). No-op.

### Modify (5.5)

| Field | Change |
|---|---|
| `target_time` | Already a `DurationPicker` post-pull. No structural change. Already drives goal_pace_per_km for peak-phase race-pace specificity. |
| `terrain` | Existing field. Today only used as a `meta` label. Phase 6+ should make trail selection actually change catalogue selection (favour `aerobic_hills` and `time_on_feet`). For Phase 5: no change. |
| `injury_history` | Currently substring-matched. Add the 3 new options to the wizard's selectable list: `shin_splints`, `hip_flexor`, `plantar_fasciitis`. Engine rules already exist (Phase 3.8). |

### Copy (5.6)

Every new field needs ZONA voice. Drafts below — follow brand rules from `docs/canonical/brand.md`:

| Field | Question | Help text |
|---|---|---|
| `training_age` | "How long have you been running consistently?" | "Includes weeks where you ran twice or more." |
| `longest_run_ever_km` | "Longest run you've ever done?" | "Roughly. The number doesn't need to be exact." |
| `preferred_long_run_day` | "Long run day?" | "Saturday or Sunday — pick the one your week protects." |
| `treadmill_primarily` | "Mostly treadmill or outdoor?" | "Affects strides and hill work. Treadmill is fine — we'll adjust." |
| `benchmark_date` | "When did you run this?" | "If it's older than 6 months, we'll be more conservative with paces." |

Three new injury options:
- `shin_splints` → label: "Shin splints"
- `hip_flexor` → label: "Hip flexor"
- `plantar_fasciitis` → label: "Plantar fasciitis"

### sessionStorage (`zona_wizard_draft`)

Add the new fields to:
- Restore block (`if (s.training_age) setTrainingAge(s.training_age)` etc.)
- Persist block (the JSON.stringify object)
- Clear on `handleUsePlan` success — already happens

---

## Suggested step sequence (free / paid)

Same overall shape as today (post-pull, one question per screen). Insert new steps:

**Free (8 → 9 steps):** insert `training-age` after `fitness` step.

**Paid (12 → 14 steps):**
- After `fitness`: `training-age`
- After `schedule`: `long-run-day`
- After `constraints`: `treadmill`
- Inside `benchmark`: add `benchmark_date` field

Update `getStepSequence()` in GeneratePlanScreen accordingly. Keep validation logic per step.

---

## Verification (browser-required)

These cannot be smoke-tested without a browser:

1. Wizard step transitions render correctly.
2. SessionStorage persists across reload mid-wizard.
3. Validation gates each step appropriately.
4. handleGenerate maps new fields into GeneratorInput correctly.
5. Free-tier users see the right step subset.
6. UpgradeScreen → wizard resumption preserves new fields.
7. Mobile (375px) layout for all new screens.

Use agent-browser per `CLAUDE.md` UI Testing rule.

---

## Rollback safety

All new wizard fields are **optional** in `GeneratorInput`. Removing them post-merge is a wizard-only revert; engine stays compatible. The two removed fields (`motivation_type`, `training_style`) are gone from `PlanMeta` documentation but stale plans containing them still validate (`schema.ts` doesn't reject extra fields by default — confirmed via `.passthrough()` is not used; need to verify Zod strict mode in schema).

---

## Estimated effort

3–5 hours for an in-loop session: ~2h coding wizard steps, ~1h voice/copy review, ~1–2h browser testing across user matrix + free/paid divergence + sessionStorage edge cases.
