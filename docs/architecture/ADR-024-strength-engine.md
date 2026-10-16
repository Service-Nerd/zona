# ADR-024 — The strength engine: a separate engine that reads the run plan and never writes it

**Status:** PROPOSED (2026-10-16). **Coaching Board: CORRECT WITH AMENDMENT** (architecture, rules) / INSUFFICIENT EVIDENCE (numbers). **SLT: BUILD DIFFERENTLY** (engine first, running-focused v1, wholly paid). See `docs/decisions/strength-engine-boards-2026-10-16.md`. Not built.
**Item:** `STRENGTH-ENGINE-01` (consolidates `R21`, *Supplementary session slots*, and the strength row of the
plan-settings sheet). **Evidence:** `docs/investigations/strength-conditioning-research-2026-10-16.md`.

## The founder's brief, verbatim in substance

A **separate** strength & conditioning engine that works **with** the coaching engine, never contradicts it, and
**helps the goal**. Sessions are **supplementary** to the run plan. The runner picks **running-focused** or
**general**. **45 or 60 minutes**, always with a **warm-up**. Exercise **animations** (and sometimes video),
**sets and reps**, sometimes high-rep, sometimes heavier and lower-rep. The runner says what **equipment** they
can reach, and that drives exercise choice. A **catalogue** of exercises by muscle group, with sets and reps as
**variables**. **Isolated** enough to become its own app. **Paid.**

## Decision

### 1. Two engines, one direction of dependency

```
                 ┌──────────────────────┐
  GeneratorInput │  COACHING ENGINE     │  Plan (run weeks)
  ─────────────▶ │  lib/plan  (exists)  │ ──────────────┐
                 └──────────────────────┘               │
                                                        ▼
                                          adapter: lib/strength-bridge
                                          Plan ──▶ RunContext (narrow, versioned)
                                                        │
  StrengthProfile┌──────────────────────┐               ▼
  ─────────────▶ │  STRENGTH ENGINE     │ ◀── RunContext | null
                 │  packages/strength   │
                 └──────────────────────┘ ──▶ StrengthPlan
```

- **The strength engine never imports the coaching engine**, and the coaching engine never imports it. They meet
  only through **`RunContext`**, a small versioned contract built by an adapter that lives in the app
  (`lib/strength-bridge/`). That adapter is the only code that knows both shapes.
- **`RunContext | null`**: with a run plan, strength is placed around it; with **no** run plan, the same engine
  produces a standalone programme. **That is the standalone-app path**, and it costs nothing extra: a second app
  simply calls it with `null`.
- **The run engine stays the owner of the calendar and the load.** Strength READS the run plan and never moves a
  run. This is what "never contradict" means mechanically: there is exactly one writer of each thing.
- 🔴 **The run engine's own strength stub is retired.** `ruleEngine.ts` has `strengthSession()` and
  `GENERATION_CONFIG.STRENGTH_ENABLED` (false), plus ~15 `type !== 'strength'` filters. One owner per job: the
  run engine stops scheduling strength itself; the filters stay (they are correct for any plan that still carries
  a legacy strength row).

### 2. `RunContext` — what strength is allowed to know about running

Per day, for each week: the run's **role** (`rest | easy | recovery | long | quality | race | cross`), the week's
**phase** (`base | build | peak | taper | race_week | deload | maintenance`), the **race date**, **days the runner
cannot train**, **preferred long-run day**, and the runner's **injury tags**. Nothing else: no paces, no zones, no
distances. Strength needs to know *which days are hard*, not *how hard*. A narrower contract is a contract that
survives the run engine changing.

### 3. `StrengthProfile` — what the runner tells it

| Field | Values | Why |
|---|---|---|
| `focus` | `running` \| `general` | Founder brief. Evidence supports the split (load type and fatigue, not exoticism) |
| `session_minutes` | `30` \| `45` \| `60` | Founder brief; **30 added by the founder 2026-10-16** after the SLT (Wood) flagged adherence after a run |
| `sessions_per_week` | engine-recommended, runner-adjustable 1–3 | Evidence: 2 in build, 1 in-season |
| `equipment` | tags: `bodyweight`, `bands`, `dumbbells`, `kettlebell`, `bench`, `box`, `pullup_bar`, `barbell`, `rack`, `cable`, `machines` | Drives exercise choice |
| `experience` | `new` \| `some` \| `regular` | Starts novices on technique (8–12 reps) |
| `injury_tags` | from the run profile (`knee`, `achilles`, `shin`, `hip`, `itb`, …) | Kinder variants, never rehab |
| `bone_health_flag` | optional: diagnosed osteoporosis / vertebral fracture | Gates impact work and loaded flexion (UK consensus) |

### 4. Catalogue — exercises are fixed, prescriptions are variables

```ts
interface Exercise {
  id: string                          // stable, e.g. 'goblet_squat'
  name: string
  pattern: 'squat' | 'hinge' | 'single_leg' | 'calf' | 'hip_abduction' | 'anti_rotation'
         | 'plyometric' | 'upper_push' | 'upper_pull' | 'mobility' | 'warmup'
  muscles: MuscleGroup[]              // quads, glutes, hamstrings, calves, soleus, hip_abductors, core, …
  equipment: EquipmentTag[][]         // any ONE inner set satisfies it (alternatives)
  level: 1 | 2 | 3                    // progression ladder within a pattern
  unilateral: boolean
  impact: 'none' | 'low' | 'high'     // plyometrics are 'high'
  avoid_with: InjuryTag[]             // contraindication → engine picks a sibling
  regress_to?: string; progress_to?: string   // the ladder
  media: { animation_id: string; external_link?: string }
  cues: string[]                      // 2–3 form cues, brand voice
}
```

**Sets, reps, load and rest are NOT on the exercise.** They come from a **prescription model**: `(focus, phase,
experience, slot in session) → { sets, reps | seconds | contacts, intensity: RIR | 'bodyweight', rest_s }`.
That is how "sometimes high reps, sometimes low and heavy" happens without the catalogue knowing.

**Load is prescribed as RIR** ("leave 2 in the tank"), not %1RM, because the app has no 1RM and the research
found no runner-specific RIR trial: the engine says so honestly rather than inventing precision.

### 5. A session

`warm-up (RAMP, ~8–10 min) → main block(s) → optional finisher → (cooldown optional)`, sized to **45 or 60
minutes** by a time-budget packer that counts sets × (work + rest) and transitions. 45 min = fewer main
exercises, not shorter rests: rest is part of the dose for heavy work.

### 6. The rules that make the two engines help each other

**As ruled by the Coaching Board, 2026-10-16** (each becomes a principle §, a `STRENGTH_CONFIG` constant and a
`validateStrengthPlan()` invariant at Phase 1; the numbers are provisional until the ACSM 2026 stand is read):

1. **§7 governs.** Heavy lower-body and plyometric work is a **stressor** (48 h). Placement, in order of preference:
   **(a)** the same day as a quality run, after it, with a ≥3 h (ideally ≥6 h) note; **(b)** an easy day 48 h clear of
   both the quality and the long run; **(c)** otherwise upper body, core and mobility only. **Never skip strength
   because of placement.** Upper body, core and mobility can go almost anywhere except race week's final days.
2. **Plyometrics and high-impact work follow §21's injury list** (knee, ITB, Achilles, shin, calf, plantar) and come
   only after strength and landing competence.
3. **Phase-aware dose:** base 2/wk building; build/peak 1–2/wk heavy-and-low-volume; **last heavy session ~10–14 days
   before the race**; race week mobility only; **deload weeks cut sets**.
4. **Running-focused** (v1): heavy lower body + calf/soleus + single-leg + hip abductors + anti-rotation core +
   plyometrics. **General** (v2): the same lower body **plus upper body**, never extra leg volume.
5. **Bodyweight-only runners are told the truth**: it builds the habit and some strength; load is what moves economy.
6. **Injury tags swap exercises for kinder siblings** (`avoid_with`) and lean the programme (Achilles → calf/soleus
   loading; knee → hip + knee work). Never framed as treatment.
7. **Women and masters:** heavy work is the destination; impact gated only by the bone-health flag; conservative
   progression. **RIR, not %1RM**; novices 8–12 reps for 2–4 weeks, then heavier.
8. **No injury-prevention claim anywhere**, product or marketing.
9. **Strength does not count toward run fatigue in v1.**

**Help in the other direction (v2, Coaching Board decision first):** a strength completion becomes a **load
signal** the run adjustment engine may read: a heavy-legs day the runner logged as Wrecked is information about
tomorrow's quality session. **Not in v1**: the run engine changes nothing until the board rules on whether strength
counts towards fatigue.

### 7. Storage — its own, not inside the run plan

`strength_plans (user_id, plan_json, profile_json, run_plan_sig)` and `strength_completions (user_id, week_n, day,
exercise_id, set_n, reps, load_kg?, rir?)`, both with `ON DELETE CASCADE` to `auth.users` (DB-USER-PURGE-01).
🔴 **This supersedes the *Supplementary session slots* model**, which put a `secondary_session` inside the run
plan JSON and a `slot` column on `session_completions`. A strength plan inside the run plan is a strength plan
the standalone app cannot own, and a migration of `session_completions`' primary key for every upsert in the app.
`run_plan_sig` (race identity + plan_start) tells the strength plan when the run plan it was placed around has
been replaced, so it re-places rather than drifting.

### 8. Media

**Licensed animations** as the default (e.g. a library like WorkoutLabs, from ~$1,200/yr; licence checked before
contract). **No embedded YouTube in a paid tier**: YouTube's developer policies forbid charging to watch content
in an embedded player, and third-party videos vanish, carry other brands' ads and can contradict the coaching.
At most an optional external "learn more" link. Commissioned media is the long-term option if a standalone app
happens.

### 9. Tier

**PAID**, founder's instruction. **🔒 Admin-only first (founder, 2026-10-16), while he tests it.** ⚠️ **A tier check
alone cannot do this:** `resolveTier` returns `paid` for every admin, so "paid only" would admit every paying runner too.
The gate is a separate release switch, `STRENGTH_RELEASE: 'admin' | 'paid'` (one constant), read by ONE function
`canUseStrength({ isAdmin, tier })`: while `'admin'`, only `is_admin` accounts pass; flipped to `'paid'` at launch, paid
and trial pass. **Enforced server-side on every strength route**, not just hidden in the UI. ⚠️ **This contradicts the current gate list**: `FEATURE_GATES.FREE_ALWAYS`
names *"basic strength sessions"* and `PAID_ONLY_ONGOING` *"tailored strength sessions"*
(`CoachingPrinciples.md`). The SLT must rule, and the gate list is amended in the same commit as the ruling.

### 10. Governance

- **`docs/canonical/StrengthPrinciples.md`** (new constitution), **`packages/strength/config.ts → STRENGTH_CONFIG`**
  (every numeric), **`validateStrengthPlan()`** (invariants) — the same three layers as the run engine.
- **The coaching guard extends to the strength doctrine files.**
- **A strength seat on the Coaching Board** (proposed: modelled on Richard Blagrove's published positions; founder
  decision).
- Engine contract written before code (`docs/contracts/strength-engine.md`), as the run engine's was.

## Phasing

| Phase | What | Exit |
|---|---|---|
| **0** | This ADR ruled by both boards; `StrengthPrinciples.md` v1; founder appoints the seat | Rulings recorded |
| **1** | `packages/strength`: types, catalogue (~40 exercises covering every pattern × equipment tier), prescription model, packer, placement rules, `validateStrengthPlan`, contract + tests. **No UI** | A sweep over the run-plan corpus with zero violations |
| **2** | App: wizard questions (focus, length, equipment, experience), Today sub-card under the run, strength session screen, per-set logging. Design Board for the new screen | Seen on a device |
| **3** | Media licensed and wired | Every catalogue entry has an animation |
| **4** | Progression from logged sets/RIR; v2 load signal into the run engine (board first) | Board ruling |

## What this does not settle

The exact numbers (Coaching Board, with the new ACSM 2026 stand checked first) · whether strength counts toward
run fatigue (Coaching Board) · free vs paid boundary (SLT) · the session screen and Today layout (Design Board) ·
media vendor and cost (SLT) · whether "general" is in v1 at all.
