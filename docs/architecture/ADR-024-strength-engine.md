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

## The goals, in the founder's words (2026-10-16)

**More than one goal** (founder, correcting a misreading of his first message):
1. **Injury prevention / resilience.** Build what the evidence links to tissue capacity: calf and soleus loading, hip
   strength, single-leg control, progressive tendon loading, with injury history steering exercise choice.
2. **Achieving the goal and not failing mid-plan.** Strength that makes the runner robust enough to keep turning up and
   reach the start line having done the block.
3. **Performance** (running economy), which is where the evidence is strongest.

⚖️ **A design goal is not a promise.** The Coaching Board's rule stands for **claims**: the only runner-specific
meta-analysis (2024) found unsupervised programmes did not measurably reduce injury, so no surface says strength
*"prevents injury"* or that it *"helps you finish your plan"* (both outcome claims, W-03). Truthful descriptions of
what it DOES are fine, e.g. *"builds strength in the muscles and tendons running loads most"*, and any such sentence
goes past the Coaching Board. The product's own measure (SLT): share of starters doing ≥1 session a week over 4 weeks.

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
4. **Both focuses ship in v1** (founder, 2026-10-16, overriding the SLT's "general in v2"). **Core in most
   sessions** (a weekly dose of ≥2 exposures, delivered as a short block); **upper body is placed by the split
   (§6a), not put in every session** (founder correction, 2026-10-16). **Running-focused:** heavy lower body with a **unilateral emphasis** (founder: the
   majority of lower-body work single-leg: split squats, single-leg RDL, step-ups, single-leg calf/soleus) +
   hip abductors + anti-rotation core + plyometrics + upper-body maintenance (rows, presses). **General:** the same
   lower-body pattern and placement rules **plus more upper-body volume**, never extra leg volume.
5. **Bodyweight-only runners are told the truth**: it builds the habit and some strength; load is what moves economy.
6. **Injury tags swap exercises for kinder siblings** (`avoid_with`) and lean the programme (Achilles → calf/soleus
   loading; knee → hip + knee work). Never framed as treatment.
7. **Women and masters:** heavy work is the destination; impact gated only by the bone-health flag; conservative
   progression. **RIR, not %1RM**; novices 8–12 reps for 2–4 weeks, then heavier.
8. **No injury-prevention claim anywhere**, product or marketing.
9. **Strength does not count toward run fatigue in v1.**

### 6a. The split — the engine chooses it from strength days per week

🔶 **PROPOSED, for the Coaching Board (strength seat) to rule at the start of Phase 1.** Founder, 2026-10-16:
*"the engine should determine best split based on number of days selected for strength... either full body each
session or an upper and lower split."* Evidence: `docs/investigations/strength-split-research-2026-10-16.md`.

**The finding underneath it:** with weekly volume matched, full body vs split makes **no meaningful difference** to
strength or size (Schoenfeld 2019, Ralston 2018, Ramos-Campo 2024, unverified secondary). The ACSM 2026 stand asks only that **every major
muscle group is trained ≥2×/week**. So the split is chosen for **fit**: hitting each region twice, keeping sessions
inside 30/45/60 min, and **keeping heavy legs where §7 allows them**. Interference with running is a **lower-body**
problem (Huiberts 2023; Doma 24–48 h), so upper-body days are free to sit almost anywhere.

| Strength days | Split | Why |
|---|---|---|
| **1** | Full body | The only way to touch every region. **Labelled a maintenance dose**, honestly: below the ACSM ≥2×/wk floor |
| **2** | Full body × 2 | The only structure that hits every region twice. Both carry legs, so both need a §7 slot |
| **3** | Full body × 2 + one **upper + core** day | Two leg exposures (what §7 can place), the third day goes anywhere. Full body × 3 is the alternative when the run week has three legal leg slots |
| **4** | Upper / lower × 2 | Each region twice, shorter sessions; only two days need a §7 slot |

**The run week can change the answer.** The engine counts the legal heavy-leg slots §7 gives it (after a quality
run, or an easy day 48 h clear). If there are fewer than the split needs, it moves leg work out of a session and
turns that session into **upper + core**, rather than skipping or breaking §7. **Phase-aware:** taper and race week
drop to the maintenance dose (one session, ~1 set per exercise at kept intensity holds strength; Spiering 2021);
masters keep 2 sessions in maintenance (older adults lose more).

**Dose floors the packer must meet:** ≥4 hard sets per region per week for gains (Iversen 2021); strength plateaus
around 2–3 sets per exercise (ACSM 2026), so a 30-minute session protects **intensity**, not set count. Supersets
(non-competing pairs, e.g. split squat + row) are how 30 minutes fits.

**Focus changes the weighting, not the structure.** Running-focused: lower days carry the unilateral work, upper is
maintenance. General: more upper volume, never more leg volume (rule 4).

⚠️ **Not tested anywhere:** no study aligns a strength split with a run week. This is inference from the
interference and fatigue data, and must be declared as such in `StrengthPrinciples.md`.

### 6b. AI — where it helps, and what it costs

**The engine stays deterministic** (ADR-006): split, exercise choice, sets, reps, RIR and placement are rules, so
they are free to run, testable, and the board can rule on them. Measured cost of our current AI (30 days to
2026-10-16, `ops_events`): **467 calls, 28 users, $2.72 total**; plan enrichment ~3¢ (Haiku), daily note ~0.2¢.

| Use | Model | Cost | When |
|---|---|---|---|
| **Authoring aid:** draft the 80+ catalogue entries (cues, descriptions, siblings, `avoid_with` tags) for **human + strength-seat review**; never shipped unread | Sonnet, offline | ~$1–3 once | Phase 1 |
| **Coverage check:** a model reads the catalogue against the pattern × equipment × level grid and lists the gaps | Sonnet, offline | <$1 | Phase 1 |
| **Weekly strength note** in the coach voice, optional, silent on failure, `AIMark` | Haiku, via `callAnthropic` | ~0.2¢ per week → **<1¢ per runner per month** | Phase 2 |
| **Not AI:** the prescription, the split, per-set feedback, progression | — | — | — |

Runtime AI goes through `lib/ai/callAnthropic.ts` like every other surface (a new `surfaces.ts` entry, logged,
rate-limited). **The standalone app** would need its own copy of that owner; the package itself imports no AI.

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
| **1** | `packages/strength`: types, a **deep** catalogue (target **80+** exercises: every pattern × equipment tier × level, unilateral and bilateral variants of each lower-body pattern, core (anti-rotation, anti-extension, lateral), upper push/pull), prescription model, packer, placement rules, `validateStrengthPlan`, contract + tests. **No UI** | A sweep over the run-plan corpus with zero violations |
| **2** | App: wizard questions (focus, length, equipment, experience), Today sub-card under the run, strength session screen, per-set logging. Design Board for the new screen | Seen on a device |
| **3** | Media licensed and wired | Every catalogue entry has an animation |
| **4** | Progression from logged sets/RIR; v2 load signal into the run engine (board first) | Board ruling |

## What this does not settle

The exact numbers (Coaching Board, with the new ACSM 2026 stand checked first) · whether strength counts toward
run fatigue (Coaching Board) · free vs paid boundary (SLT) · the session screen and Today layout (Design Board) ·
media vendor and cost (SLT) · the split table in §6a (Coaching Board, strength seat).
