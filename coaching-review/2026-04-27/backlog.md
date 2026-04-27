# Backlog — 2026-04-27 Review

Each item has: ID, priority, source case, files to touch, acceptance criteria, and paste-ready snippets where relevant. Work in priority order. Within a priority band, work in ID order.

IDs are scoped to this review round (`2026-04-27/H-01`, etc.). Do not collide with other rounds.

**Engine team workflow per item:**
1. Apply the change to `docs/canonical/CoachingPrinciples.md` (if it's a principle change).
2. Promote any numerics to `GENERATION_CONFIG`.
3. Add the mechanical check to `lib/plan/invariants.ts`.
4. Re-run `scripts/generate-coaching-review.ts` and confirm the output for the relevant case(s) reflects the fix.
5. Commit referencing the backlog ID (e.g. `fix(engine): [2026-04-27/H-01] respect days_cannot_train in race week`).

---

## [HIGH] — Cross-cutting bugs and major coaching errors

### H-01 — Race-week scheduling must respect `days_cannot_train`
**Source:** All three cases. Universal bug.
**Files:** `lib/plan/scheduler.ts` (or wherever race-week sessions are placed), `lib/plan/invariants.ts`
**Problem:** Race week shakeouts hardcoded to Tue/Thu. All three personas have one or both blocked.

**Acceptance criteria:**
- For all three test cases, no race-week session lands on a day in `days_cannot_train`.
- Invariant fails CI if any session in any week (including race week) lands on a blocked day.

**Principle to add to `CoachingPrinciples.md`:**
```markdown
### Blocked-day enforcement (universal)

Sessions MUST never be scheduled on days listed in `days_cannot_train`,
regardless of week type (base, build, peak, taper, race). Race-week
shakeouts MUST be placed on the two `days_available` closest to but not
adjacent to race day. If only one available day exists in race week
outside the long-run/race day, prescribe a single shakeout.
```

**Invariant snippet (TypeScript):**
```typescript
// In lib/plan/invariants.ts
export function noSessionsOnBlockedDays(plan: Plan, input: PlanInput): InvariantResult {
  const blocked = new Set(input.days_cannot_train);
  for (const week of plan.weeks) {
    for (const day of Object.keys(week.sessions)) {
      if (blocked.has(day)) {
        return {
          ok: false,
          message: `Week ${week.n} has a session on blocked day "${day}"`,
        };
      }
    }
  }
  return { ok: true };
}
```

---

### H-02 — Session label must match prescribed physiology
**Source:** Case 02. "Long VO2max" / "Classic VO2max" sessions prescribe 10K pace, not VO2max pace.
**Files:** `lib/plan/sessions/library.ts` (session definitions), `docs/canonical/CoachingPrinciples.md`, `lib/plan/invariants.ts`

**Acceptance criteria:**
- A session named with "VO2max" prescribes pace within ±3% of derived vVO2max (typically 3K–5K race pace).
- A session named with a race distance ("10K-pace", "HM-pace") prescribes pace within ±2% of derived goal pace for that distance.
- If the engine cannot satisfy the label given current pace targets, it renames the session.
- For Case 02, W9 and W10 sessions are renamed to "10K-pace intervals" or "Goal-pace cruise intervals" since prescribed pace is goal pace.

**Principle to add:**
```markdown
### Session naming integrity

Session labels carry physiological meaning and must match the prescription.

- "VO2max" sessions MUST prescribe pace at 95–100% of vVO2max (3K–5K race
  pace), with rep durations 2–5 minutes and recovery ≥50% of work duration.
- "Threshold" / "tempo" sessions MUST prescribe pace at 85–90% of vVO2max
  (roughly HM pace for trained runners, slightly slower for beginners).
- Sessions named after a race distance ("10K-pace intervals", "HM-pace
  intervals", "MP segments") MUST prescribe pace within ±2% of the
  runner's derived goal pace for that distance.

If the engine cannot satisfy a label's pace requirement given the
runner's VDOT and the session structure, it MUST rename the session
to something the prescription does satisfy.
```

**Invariant snippet:**
```typescript
export function sessionLabelMatchesPace(plan: Plan, input: PlanInput, vdot: number): InvariantResult {
  const vVO2max = paceFromVDOT(vdot, 'vVO2max');
  for (const week of plan.weeks) {
    for (const [day, session] of Object.entries(week.sessions)) {
      if (!session.pace_target) continue;
      const labelLower = session.label.toLowerCase();

      if (labelLower.includes('vo2max')) {
        if (!paceWithinPercent(session.pace_target, vVO2max, 5)) {
          return { ok: false, message: `W${week.n} ${day}: "${session.label}" pace ${session.pace_target} is not VO2max pace (target ~${vVO2max}/km)` };
        }
      }
      // Repeat for race-distance labels — check against derived goal pace.
    }
  }
  return { ok: true };
}
```

---

### H-03 — Audit VDOT derivation from benchmark
**Source:** Case 02. 23:30 5K → plan derived VDOT 40, but Daniels' tables put this at VDOT 42–43.
**Files:** `lib/plan/vdot.ts` (or wherever benchmark→VDOT conversion lives), `scripts/generate-coaching-review.ts` (output)

**Acceptance criteria:**
- Benchmark-to-VDOT conversion matches Jack Daniels' published table within ±0.5 VDOT for 5K, 10K, HM, marathon benchmarks.
- Derived VDOT and the benchmark used to derive it are surfaced in `meta` block of the generated plan output.
- For Case 02 (23:30 5K), derived VDOT lands at 42 ± 0.5.

**Reference:** Daniels' Running Formula VDOT tables. A 23:30 5K = VDOT 42.5 (rounds to 42 or 43 depending on convention).

**Suggested test:**
```typescript
// In tests/vdot.test.ts
describe('VDOT derivation', () => {
  test.each([
    ['5K', 5, '0:23:30', 42.5, 0.5],
    ['10K', 10, '0:50:30', 38.4, 0.5],
    ['HM', 21.1, '1:55:00', 38.4, 0.5],
    ['5K beginner', 5, '0:30:00', 32.5, 0.5],
  ])('%s benchmark %s in %s → VDOT ~%i', (_label, dist, time, expected, tol) => {
    expect(vdotFromBenchmark({ distance_km: dist, time })).toBeCloseTo(expected, tol);
  });
});
```

**Plan output addition (in meta):**
```json
"vdot": 42.5,
"vdot_source": { "type": "race", "distance_km": 5, "time": "0:23:30", "date": "2026-03-15" },
"goal_pace_min_per_km": "4:55"
```

---

### H-04 — Injury history must modify session selection
**Source:** Case 02. `injury_history: [knee]` flagged but engine still prescribes hill repeats in W5/W7.
**Files:** `lib/plan/sessions/selection.ts`, `docs/canonical/CoachingPrinciples.md`, `lib/plan/invariants.ts`

**Acceptance criteria:**
- For `injury_history` containing any of `["knee", "shin", "calf", "Achilles", "ITB"]`, no hill repeat or steep-grade session is prescribed during base or build phase.
- Substitutes are progression runs or flat tempo at equivalent intensity.
- For Case 02, W5 and W7 quality sessions become "Progression run" or "Steady-state tempo", not "Aerobic with hills".

**Principle to add:**
```markdown
### Injury-aware session selection

`injury_history` modifies session *selection*, not just volume. The
following substitutions apply during base and build phases:

| Injury flag | Avoid | Substitute |
|---|---|---|
| knee, ITB | Hill repeats, steep downhill | Progression runs, flat tempo |
| shin, calf | High-cadence speed work, downhills | Steady-state at threshold pace |
| Achilles | Hill repeats, plyometric strides | Cruise intervals on flat |
| plantar | Hill repeats, barefoot/minimalist work | Flat steady-state |

Peak phase may reintroduce hills only if the runner has completed the
build phase symptom-free, gated by an explicit user check-in.
```

**Invariant snippet:**
```typescript
const HILL_LABELS = ['hill', 'hills', 'hill repeats'];
const KNEE_FLAGGED_INJURIES = new Set(['knee', 'shin', 'calf', 'Achilles', 'ITB']);

export function injuryHistoryRespected(plan: Plan, input: PlanInput): InvariantResult {
  const flagged = (input.injury_history ?? []).some(i => KNEE_FLAGGED_INJURIES.has(i));
  if (!flagged) return { ok: true };

  for (const week of plan.weeks) {
    if (week.phase === 'peak' || week.phase === 'taper') continue;
    for (const [day, session] of Object.entries(week.sessions)) {
      const label = session.label.toLowerCase();
      if (HILL_LABELS.some(h => label.includes(h))) {
        return { ok: false, message: `W${week.n} ${day}: "${session.label}" prescribes hills despite injury_history including ${input.injury_history.join(',')}` };
      }
    }
  }
  return { ok: true };
}
```

---

### H-05 — Race-specific exposure must scale with goal type
**Source:** Case 02. First goal-pace exposure in W9 (4 weeks out) for a 12-week time-targeted plan. Too late.
**Files:** `lib/plan/phase/build.ts` (or wherever build-phase quality is selected), `docs/canonical/CoachingPrinciples.md`, `lib/plan/invariants.ts`

**Acceptance criteria:**
- For `goal: time_target`, ≥50% of quality sessions in the second half of the plan prescribe pace within ±5% of derived goal pace.
- For Case 02, at least one of W6/W7/W8 quality sessions becomes goal-pace work (e.g. 4×1km @ 10K pace).

**Principle to add:**
```markdown
### Race-specific exposure (time-targeted goals)

For `goal: time_target`, the runner needs sustained exposure to goal
pace before race day. Counted across the second half of the plan
(weeks ≥ ceil(total_weeks/2)):

- ≥50% of quality sessions MUST prescribe pace within ±5% of goal pace.
- At least one goal-pace session MUST appear no later than week
  ceil(total_weeks/2) + 1.
- Build-phase quality MAY include sub-threshold (aerobic, steady)
  sessions, but the latter half of the plan MUST tilt toward specificity.
```

**Invariant snippet:**
```typescript
export function raceSpecificExposure(plan: Plan, input: PlanInput, goalPace: string): InvariantResult {
  if (input.goal !== 'time_target') return { ok: true };

  const half = Math.ceil(plan.weeks.length / 2);
  const secondHalfQualitySessions = plan.weeks
    .slice(half - 1)
    .flatMap(w => Object.values(w.sessions))
    .filter(s => s.type === 'quality');

  const goalPaceSessions = secondHalfQualitySessions
    .filter(s => s.pace_target && paceWithinPercent(s.pace_target, goalPace, 5));

  const ratio = goalPaceSessions.length / Math.max(1, secondHalfQualitySessions.length);
  if (ratio < 0.5) {
    return { ok: false, message: `Only ${Math.round(ratio*100)}% of second-half quality sessions are at goal pace (need ≥50%)` };
  }
  return { ok: true };
}
```

---

### H-06 — Peak volume must exceed base volume
**Source:** Case 01. Peak weeks (20km, 23km) equal base weeks (20km, 23km). No overload.
**Files:** `lib/plan/volume.ts`, `docs/canonical/CoachingPrinciples.md`, `lib/plan/invariants.ts`

**Acceptance criteria:**
- Peak week volume ≥110% of week 1 volume for any plan ≥8 weeks.
- If the engine cannot satisfy this given constraints (days available, weekday cap), the plan label changes to "maintenance" not "build" and surfaces an explanation.

**Principle to add:**
```markdown
### Peak overload requirement

A plan labelled as a "build" must produce overload. The peak week
volume MUST be ≥110% of week 1 volume for plans ≥8 weeks long.

If the engine cannot achieve this overload given the runner's
constraints (days_available, max_weekday_mins, injury caps), it MUST:
1. Change the plan label from "build" to "maintenance".
2. Surface a `volume_constraint` notice in the plan meta explaining
   which input prevented overload (e.g. "3 days/week with 60-min cap
   limits peak volume to 23km").
3. Suggest the input change that would unlock more volume.
```

**Invariant snippet:**
```typescript
export function peakExceedsBase(plan: Plan): InvariantResult {
  if (plan.weeks.length < 8) return { ok: true };
  const w1Volume = plan.weeks[0].weekly_km;
  const peakVolume = Math.max(...plan.weeks.filter(w => w.phase === 'peak').map(w => w.weekly_km));

  if (peakVolume < w1Volume * 1.10) {
    if (plan.meta.notes?.includes('maintenance')) return { ok: true }; // explicitly downgraded
    return { ok: false, message: `Peak volume ${peakVolume}km is not ≥110% of W1 ${w1Volume}km. Either downgrade label to "maintenance" or relax constraints.` };
  }
  return { ok: true };
}
```

---

### H-07 — Long-run distance must scale to race distance for time-targeted HM/marathon
**Source:** Case 03. Peak long run 15km for a 21.1km race. Anna never runs race-distance in training.
**Files:** `lib/plan/longRun.ts`, `docs/canonical/CoachingPrinciples.md`, `lib/plan/invariants.ts`

**Acceptance criteria:**
- For HM time-targeted: peak long run ≥85% of race distance (≥17.9km for 21.1km race) OR ≥90% of projected race time, whichever is higher.
- For marathon time-targeted: peak long run ≥75% of race distance OR ≥80% of projected race time, whichever is higher.
- For 10K and below: no race-distance minimum (long run is for aerobic development, not specificity).
- Long run progression is gated by `longest_recent_run_km` (don't jump >20% week-on-week).

**Principle to add:**
```markdown
### Long-run race specificity

Time-targeted plans for HM and longer require race-distance specificity
in the long run.

| Race distance | Peak long run minimum |
|---|---|
| ≤10K | No minimum (aerobic development priority) |
| HM | ≥85% race distance OR ≥90% projected race time |
| Marathon | ≥75% race distance OR ≥80% projected race time |
| Ultra (>42.2km) | Time-on-feet target (typically 4–6h regardless of distance) |

Progression to peak long run MUST not exceed +20% week-on-week from
`longest_recent_run_km`. If the runner's starting long run is too far
below the peak target to reach safely in the available weeks, extend
the plan or notify the user that the long-run target cannot be met.
```

**Invariant snippet:**
```typescript
const PEAK_LR_RATIO: Record<string, number> = {
  HM: 0.85,
  marathon: 0.75,
};

export function longRunReachesRaceDistance(plan: Plan, input: PlanInput): InvariantResult {
  if (input.goal !== 'time_target') return { ok: true };
  const dist = input.race_distance_km;
  let requiredRatio = 0;
  if (dist >= 20 && dist <= 22) requiredRatio = PEAK_LR_RATIO.HM;
  else if (dist >= 40 && dist <= 43) requiredRatio = PEAK_LR_RATIO.marathon;
  else return { ok: true };

  const peakLR = Math.max(...plan.weeks.flatMap(w => Object.values(w.sessions)).filter(s => s.type === 'easy' && s.label.includes('Long')).map(s => s.distance_km ?? 0));
  if (peakLR < dist * requiredRatio) {
    return { ok: false, message: `Peak long run ${peakLR}km is below ${Math.round(dist*requiredRatio)}km (${Math.round(requiredRatio*100)}% of ${dist}km race)` };
  }
  return { ok: true };
}
```

---

### H-08 — At least one race-specific long run for time-targeted HM/marathon
**Source:** Case 03. Anna's long runs are all flat Zone 2. No HM-pace exposure within a long run.
**Files:** `lib/plan/longRun.ts`, `docs/canonical/CoachingPrinciples.md`, `lib/plan/invariants.ts`

**Acceptance criteria:**
- Peak phase of HM time-targeted plan contains ≥1 long run with embedded race-pace segment.
- The race-pace segment is the final 25–40% of the long run.
- Naming convention: "Long run with HM-pace finish" or "Progression long run".

**Principle to add:**
```markdown
### Race-specific long run (time-targeted HM/marathon)

Peak phase MUST contain at least one "long run with embedded race-pace
segments". Structure:

- HM goal: 14–18km easy + final 4–6km at HM goal pace
- Marathon goal: 25–32km easy + final 8–12km at MP

Place this session in the second peak week if there are two. If only
one peak week exists, place it 10–14 days from race day.
```

---

### H-09 — Race-week quality must be sharpening, not tempo
**Source:** Case 03. W13 race week prescribes "Progressive tempo" 5km/27min. Tempo 7 days out adds fatigue without adding fitness.
**Files:** `lib/plan/phase/taper.ts`, `docs/canonical/CoachingPrinciples.md`, `lib/plan/invariants.ts`

**Acceptance criteria:**
- In race week (final 7 days), if any quality session is prescribed, it MUST be short reps at race pace or faster.
- Banned in race week: continuous tempo, threshold, progression runs, hill repeats.
- Allowed: 3–5×1km at goal pace with 90s recovery; 6×400m at goal pace; 4–6 strides on a shakeout.

**Principle to add:**
```markdown
### Race-week sharpening (not tempo)

In the final 7 days before race day, any quality session MUST be a
sharpening session — short reps at race pace or faster, with full
recovery, total volume ≤5km of work.

Prohibited in race week:
- Continuous tempo runs of any length
- Threshold intervals (cruise intervals, mile repeats at threshold)
- Progression runs
- Hill repeats
- Long runs >50% of peak long run distance

Permitted:
- 3–5×1km at goal pace, ≥90s recovery
- 6×400m at goal pace or slightly faster, ≥60s recovery
- 4–6×100m strides appended to a shakeout
```

**Invariant snippet:**
```typescript
const BANNED_RACE_WEEK_TYPES = ['tempo', 'threshold', 'progression', 'hill', 'long'];

export function raceWeekIsSharpening(plan: Plan): InvariantResult {
  const raceWeek = plan.weeks.find(w => w.type === 'race');
  if (!raceWeek) return { ok: true };

  for (const [day, session] of Object.entries(raceWeek.sessions)) {
    if (session.type !== 'quality') continue;
    const label = session.label.toLowerCase();
    for (const banned of BANNED_RACE_WEEK_TYPES) {
      if (label.includes(banned)) {
        return { ok: false, message: `Race week has banned session type "${banned}" (${session.label}) on ${day}` };
      }
    }
  }
  return { ok: true };
}
```

---

### H-10 — Theme and prescription must agree
**Source:** Cases 01 and 03. "This is where the fitness is built" on flat-volume peak weeks. "Volume drops. Intensity stays." on race week with no intensity.
**Files:** `lib/plan/themes.ts`, `lib/plan/invariants.ts`

**Acceptance criteria:**
- "where the fitness is built" / "highest volume" themes only apply to weeks where weekly_km > preceding non-deload week.
- "Intensity stays" themes only apply to weeks where ≥1 quality session exists.
- Race-week theme is "The work is done. Arrive rested." (already exists for Cases 01/02; missing in Case 03 W13).

**Invariant snippet:**
```typescript
export function themeMatchesPrescription(plan: Plan): InvariantResult {
  for (let i = 0; i < plan.weeks.length; i++) {
    const week = plan.weeks[i];
    const theme = week.theme.toLowerCase();

    if (theme.includes('intensity stays')) {
      const hasQuality = Object.values(week.sessions).some(s => s.type === 'quality');
      if (!hasQuality) {
        return { ok: false, message: `W${week.n} theme says "intensity stays" but no quality session present` };
      }
    }

    if (theme.includes('highest volume') || theme.includes('fitness is built')) {
      const prevNonDeload = plan.weeks.slice(0, i).filter(w => w.type !== 'deload').slice(-1)[0];
      if (prevNonDeload && week.weekly_km <= prevNonDeload.weekly_km) {
        return { ok: false, message: `W${week.n} theme implies overload but volume ${week.weekly_km}km ≤ previous ${prevNonDeload.weekly_km}km` };
      }
    }
  }
  return { ok: true };
}
```

---

## [MEDIUM] — Quality and adherence improvements

### M-01 — Add strides to one easy run per week from W3+
**Source:** Cases 01 and 02 recommendation.
**Files:** `lib/plan/sessions/library.ts`, `lib/plan/phase/base.ts`

**Acceptance criteria:**
- One easy run per week (mid-week, not pre-long-run) from W3 onwards has 4–6×100m strides appended.
- Strides described as "4×20s strides at 5K effort, full recovery" with coach note.

---

### M-02 — Returning-runner detection
**Source:** Case 01. Sarah has a 6-month gap, treated as actively running 18km/week.
**Files:** `lib/plan/inputs.ts`, `lib/plan/volume.ts`, `docs/canonical/CoachingPrinciples.md`

**Acceptance criteria:**
- Add optional `weeks_at_current_volume` input (integer).
- If `<8` weeks at current volume OR if narrative indicates layoff, start volume at 70% of `current_weekly_km` and ramp at ≤10%/week.

---

### M-03 — Reword themes when prescription is conservative
**Source:** Case 01.
**Files:** `lib/plan/themes.ts`

**Acceptance criteria:**
- For "compressed" or "maintenance" plans, peak weeks use themes like "Consistency week — the work is the volume" rather than "where the fitness is built".

---

### M-04 — Race-week shakeout pace cap
**Source:** Cross-cutting review note.
**Files:** `lib/plan/phase/taper.ts`

**Acceptance criteria:**
- Race-week shakeouts capped at 30–35min, RPE ≤3, including 4×100m strides if no other quality session in race week.

---

### M-05 — Differentiated "compressed" warning
**Source:** Cross-cutting. Warning fires uniformly but means different things per persona.
**Files:** `scripts/generate-coaching-review.ts`, plan output

**Acceptance criteria:**
- Replace single "compressed" warning with one of:
  - `"volume_appropriate_for_persona"` — when peak < target but persona doesn't need more (returning runner, finish goal).
  - `"volume_constrained_by_inputs"` — when peak < target and persona could carry more (specify which input is the bottleneck).

---

## [LOW] — Polish and additions

### L-01 — Tune-up race option
**Source:** Cases 01 and 03 recommendation.
**Files:** `lib/plan/phase/peak.ts`

**Acceptance criteria:**
- Plans ≥10 weeks offer an optional tune-up race callout in mid-build (W7–W9), suggesting parkrun PB or local 5K.

---

### L-02 — Surface VDOT and goal pace in plan meta
**Source:** Already partially included in H-03; this is the user-facing surface.
**Files:** plan output template, UI

**Acceptance criteria:**
- Plan summary header shows: derived VDOT, derived goal pace, benchmark used.

---

## Expected post-fix outcomes

After completing the [HIGH] block, the regenerated plans should show:

- **All cases:** No race-week sessions on Tue/Thu (or any blocked day for that runner).
- **Case 01:** Peak weeks at ≥22km OR plan downgraded to "maintenance" with explanation.
- **Case 02:** Quality sessions renamed away from "VO2max" (or pace updated to true VO2max). At least one of W6/W7/W8 includes goal-pace work. W5/W7 hill sessions replaced with progression/steady-state. Derived VDOT shown as ~42.5 in meta.
- **Case 03:** Peak long run ≥18km. W11 or W10 includes a long run with HM-pace finish. W13 quality is sharpening reps, not tempo.
- **All cases:** VDOT and goal pace surfaced in plan meta.

The driver prompt (`../CLAUDE_CODE_PROMPT.md`) writes a `post-fix-diff.md` in this folder summarising what actually changed against these expectations.
