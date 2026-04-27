# Backlog — 2026-05-25 Review (Round 2)

Round-two backlog. IDs scoped to this round (`2026-05-25/H-01` etc.).

**Engine team workflow per item** (same as round one):
1. Apply principle change to `docs/canonical/CoachingPrinciples.md`.
2. Promote numerics to `GENERATION_CONFIG`.
3. Add/fix invariant in `lib/plan/invariants.ts`.
4. Re-run `scripts/generate-coaching-review.ts` and confirm fix.
5. Commit referencing backlog ID.

---

## [HIGH] — Invariant audits and coaching errors

### H-01 — Audit: VO2max session pace tolerance
**Source:** Round-two Case 02. W8/W9 labelled "VO2max" prescribe 4:36–4:47/km but Mark's true vVO2max is ~4:25/km.
**Files:** `lib/plan/invariants.ts` (existing `sessionLabelMatchesPace` from round-one H-02), `tests/invariants.test.ts`
**Problem:** The H-02 invariant from round one (2026-04-27/H-02) is either passing on incorrect input, has too-loose tolerance, or isn't wired into the test suite that runs against generated output.

**Acceptance criteria:**
- Run the existing `sessionLabelMatchesPace` invariant against Case 02's generated plan output. It MUST fail on W8 and W9.
- If the invariant currently passes, identify why: tolerance too loose, vVO2max derivation wrong, or invariant not in regression suite.
- Fix the underlying cause. After fix: either W8/W9 are renamed to "Threshold intervals" / "Cruise intervals" (matching the prescribed pace), OR the prescribed pace tightens to ~4:25/km.
- Tolerance for VO2max sessions: pace MUST be within ±5% of derived vVO2max. Anything slower is threshold, not VO2max.

**Investigation snippet:**
```typescript
// tests/round-two-audit.test.ts
import { sessionLabelMatchesPace } from '../lib/plan/invariants';
import { paceFromVDOT } from '../lib/plan/vdot';
import case02Plan from '../docs/coaching-reviews/2026-04-27/regenerated/02-10k-intermediate.json';

describe('Round-two audit: H-02 invariant', () => {
  test('W8 Classic VO2max should fail invariant for VDOT 41.2', () => {
    const result = sessionLabelMatchesPace(case02Plan, case02Plan.meta.input, 41.2);
    expect(result.ok).toBe(false);
    expect(result.message).toContain('W8');
  });

  test('vVO2max for VDOT 41.2 is ~4:25/km not ~4:40', () => {
    const vVO2max = paceFromVDOT(41.2, 'vVO2max');
    // Daniels: VDOT 41 → vVO2max ≈ 4:24/km
    expect(vVO2max).toMatch(/4:2[2-7]/);
  });
});
```

**Updated invariant (tightened tolerance):**
```typescript
export function sessionLabelMatchesPace(plan: Plan, input: PlanInput, vdot: number): InvariantResult {
  const vVO2max = paceFromVDOT(vdot, 'vVO2max');
  const threshold = paceFromVDOT(vdot, 'threshold');

  for (const week of plan.weeks) {
    for (const [day, session] of Object.entries(week.sessions)) {
      if (!session.pace_target) continue;
      const labelLower = session.label.toLowerCase();
      const midpoint = midpointOfPaceRange(session.pace_target);

      if (labelLower.includes('vo2max')) {
        // VO2max MUST be within ±5% of vVO2max
        if (!paceWithinPercent(midpoint, vVO2max, 5)) {
          return {
            ok: false,
            message: `W${week.n} ${day}: "${session.label}" pace midpoint ${midpoint}/km is not VO2max (target ~${vVO2max}/km, threshold ~${threshold}/km). Either rename or tighten pace.`,
          };
        }
      }

      if (labelLower.includes('threshold') || labelLower.includes('cruise')) {
        // Threshold MUST be within ±3% of threshold pace
        if (!paceWithinPercent(midpoint, threshold, 3)) {
          return {
            ok: false,
            message: `W${week.n} ${day}: "${session.label}" pace midpoint ${midpoint}/km is not threshold (target ~${threshold}/km).`,
          };
        }
      }
    }
  }
  return { ok: true };
}
```

---

### H-02 — Audit: goal-pace exposure ratio
**Source:** Round-two Case 02. Second-half goal-pace exposure ~40%, spec is ≥50%.
**Files:** `lib/plan/invariants.ts` (existing `raceSpecificExposure` from round-one H-05), `tests/invariants.test.ts`

**Acceptance criteria:**
- Run `raceSpecificExposure` invariant against Case 02 plan. It MUST fail.
- If currently passing, identify why: wrong "second half" boundary, wrong tolerance, or counting non-quality sessions.
- After fix: Case 02 generator must produce ≥50% goal-pace quality sessions in W6–W11. This likely means W6 becomes goal-pace work instead of "Steady aerobic", OR the build phase adds an additional goal-pace session.
- Pace tolerance: ±5% of derived goal pace counts as "at goal pace" for the ratio.

**Investigation snippet:**
```typescript
describe('Round-two audit: H-05 invariant', () => {
  test('Case 02 second-half goal-pace ratio is below 50%', () => {
    const result = raceSpecificExposure(case02Plan, case02Plan.meta.input, '5:00');
    expect(result.ok).toBe(false);
  });

  test('what counts as second half for 11-week plan?', () => {
    // ceil(11/2) = 6, so second half = W6-W11 (6 weeks)
    // Quality sessions in W6-W11: W6 steady, W7 10K-pace, W8 VO2max, W9 VO2max, W10 tempo
    // Goal-pace (within ±5% of 5:00 = 4:45-5:15): only W7 qualifies cleanly
    // → 1/5 = 20%, FAR below 50%
  });
});
```

**Generator change required:**
```typescript
// In lib/plan/phase/build.ts
// Replace W6 "Steady aerobic" with goal-pace work for time-targeted plans
function selectBuildPhaseQuality(week: number, input: PlanInput, vdot: number): Session {
  if (input.goal === 'time_target' && week >= ceil(input.total_weeks / 2)) {
    // Force goal-pace specificity in second half of build phase
    return goalPaceSession(input.target_time, input.race_distance_km, vdot);
  }
  // ... existing logic
}
```

---

### H-03 — Coach notes must match session intent
**Source:** Round-two Case 02. W8 VO2max session has coach note "Boring is the point. If it feels productive, slow down." (an aerobic/easy cue).
**Files:** `lib/plan/sessions/coachNotes.ts` (or wherever notes are attached), `docs/canonical/CoachingPrinciples.md`, `lib/plan/invariants.ts`

**Acceptance criteria:**
- Coach notes are selected by session label/type, not by zone or RPE.
- Notes mapped to session types: easy/long → calm/aerobic cues, threshold/tempo → sustainable-effort cues, VO2max → pace-control + "this should hurt" cues, sharpening → race-pace + crispness cues.
- Invariant: a session labelled "VO2max" never carries an aerobic-coaching note ("boring is the point", "if it feels productive slow down").

**Principle to add:**
```markdown
### Coach note alignment

Coach notes attached to a session MUST be selected by session label/type,
not by zone or RPE. The pipeline is:

1. Determine session type from the session label.
2. Pick a note from the type-specific note pool.
3. Never use a note from a different type pool, even if the zone matches.

Banned cross-type combinations:
- VO2max sessions never get "boring is the point" or "if it feels productive, slow down"
- Easy/long sessions never get "exit each rep wanting more" or "rep three is the test"
- Tempo sessions never get "explosive starts" or sprint-coaching cues
- Sharpening sessions never get "sustainable, same pace at the end as the start"
```

**Note pool structure:**
```typescript
// lib/plan/sessions/coachNotes.ts
export const COACH_NOTES: Record<SessionType, string[]> = {
  easy: [
    'Conversational. If you can\'t hold a sentence, slow down.',
    'Boring is the point. If it feels productive, slow down.',
    'Short and relaxed. Wake the legs, nothing more.',
  ],
  long: [
    'Time on feet. Pace is irrelevant.',
    'Easy first half, slightly stronger second half if it feels right.',
  ],
  threshold: [
    'Sustainable. Same pace at the end as at the start.',
    'Comfortably hard. Not racing.',
  ],
  vo2max: [
    'Three minutes is long. Don\'t blow rep one.',
    'Heroic openers ruin it. Even splits.',
    'This should hurt. Pace control matters more than maximum effort.',
  ],
  goal_pace: [
    'Exit each rep wanting more.',
    'Rep three is the test, not rep one.',
    'HM pace, not faster. Race rehearsal.',
  ],
  sharpening: [
    'Crisp. Short. Race rhythm.',
    'Quick legs, easy lungs.',
  ],
  progression: [
    'Hold back early. Finish honest.',
  ],
};
```

**Invariant snippet:**
```typescript
const FORBIDDEN_NOTE_COMBINATIONS = [
  { sessionContains: 'vo2max', noteContains: ['boring is the point', 'if it feels productive'] },
  { sessionContains: 'easy', noteContains: ['exit each rep', 'rep three is the test'] },
  { sessionContains: 'tempo', noteContains: ['explosive', 'sprint'] },
];

export function coachNotesMatchSessionIntent(plan: Plan): InvariantResult {
  for (const week of plan.weeks) {
    for (const [day, session] of Object.entries(week.sessions)) {
      const label = session.label.toLowerCase();
      const notes = (session.coach_notes ?? []).join(' ').toLowerCase();

      for (const rule of FORBIDDEN_NOTE_COMBINATIONS) {
        if (label.includes(rule.sessionContains)) {
          for (const forbidden of rule.noteContains) {
            if (notes.includes(forbidden)) {
              return {
                ok: false,
                message: `W${week.n} ${day}: "${session.label}" carries note "${forbidden}" which doesn't match session intent`,
              };
            }
          }
        }
      }
    }
  }
  return { ok: true };
}
```

---

### H-04 — Invariant test wiring meta-check
**Source:** Round-two cross-cutting. H-02 and H-05 invariants existed but didn't catch issues in generated output.
**Files:** `tests/invariants.test.ts`, `scripts/generate-coaching-review.ts`

**Acceptance criteria:**
- Add a meta-test that fails if any function exported from `lib/plan/invariants.ts` is not asserted against all three test cases in the regression suite.
- The regression suite must run every invariant against the regenerated output of all three cases.
- CI fails if a new invariant is added but not wired into the regression suite.

**Meta-test snippet:**
```typescript
// tests/invariants-coverage.test.ts
import * as invariants from '../lib/plan/invariants';
import { runInvariantsAgainstCase } from '../tests/helpers';

describe('Invariant coverage', () => {
  const definedInvariants = Object.keys(invariants).filter(k => typeof invariants[k] === 'function');

  test.each(['01-5k-beginner', '02-10k-intermediate', '03-hm-intermediate'])(
    'all invariants run against %s',
    (caseId) => {
      const results = runInvariantsAgainstCase(caseId);
      const tested = Object.keys(results);

      const missing = definedInvariants.filter(name => !tested.includes(name));
      expect(missing).toEqual([]);
    }
  );
});
```

---

## [MEDIUM] — Quality and persona-aware behaviour

### M-01 — Floor-stopping in long-run progression
**Source:** Round-two Case 03. Anna's peak long run sits at 18km (85% of 21.1km, exact spec floor) when her experience and history could carry 19–20km.
**Files:** `lib/plan/longRun.ts`, `docs/canonical/CoachingPrinciples.md`

**Acceptance criteria:**
- For runners with `hard_session_relationship: love`, no `injury_history`, and `longest_recent_run_km` ≥ floor target, peak long run targets 90–95% of race distance for HM (instead of stopping at 85%).
- Marathon equivalent: 80–85% (instead of 75%).
- Plan output explicitly states whether the long run was placed at floor, target, or stretch level.

**Principle to add:**
```markdown
### Persona-aware prescriptions

Spec floors are minimums, not targets. When persona signals support more
aggressive prescriptions, the engine SHOULD push higher than the floor
where doing so doesn't violate other principles.

Long-run targeting tiers (HM example):
- Floor (85%): default, conservative
- Target (90%): runner has `longest_recent_run_km` ≥ 90% race distance
- Stretch (95%): runner has `hard_session_relationship: love`, no injury history,
  and `longest_recent_run_km` ≥ 90% race distance

The same tiering applies to weekly volume, quality session frequency, and
goal-pace exposure. Defaults are conservative; persona signals unlock more.
```

---

### M-02 — Quality session variety in taper
**Source:** Round-two Case 03. W11 and W12 both prescribe "Progressive tempo" with identical pace and coach notes.
**Files:** `lib/plan/phase/taper.ts`, `lib/plan/invariants.ts`

**Acceptance criteria:**
- No two consecutive quality sessions in taper phase use the same session label and identical pace target.
- Taper quality variety: progressive tempo, HM-pace reps, goal-pace cruise intervals, sharpening reps — at least 2 distinct types across the taper weeks.

**Invariant snippet:**
```typescript
export function taperVariety(plan: Plan): InvariantResult {
  const taperWeeks = plan.weeks.filter(w => w.phase === 'taper' && w.type !== 'race');
  let prevQuality: { label: string; pace: string } | null = null;

  for (const week of taperWeeks) {
    const quality = Object.values(week.sessions).find(s => s.type === 'quality');
    if (!quality) { prevQuality = null; continue; }

    if (prevQuality && prevQuality.label === quality.label && prevQuality.pace === quality.pace_target) {
      return {
        ok: false,
        message: `W${week.n} repeats quality session from previous week (${quality.label} @ ${quality.pace_target}). Vary the stimulus.`,
      };
    }
    prevQuality = { label: quality.label, pace: quality.pace_target ?? '' };
  }
  return { ok: true };
}
```

---

### M-03 — Returning-runner detection (deferred from round one)
**Source:** Round-one M-02. Sarah has a 6-month gap, treated as actively running 18km/week. W1 starts at 20km.
**Files:** `lib/plan/inputs.ts`, `lib/plan/volume.ts`, `docs/canonical/CoachingPrinciples.md`

**Acceptance criteria:**
- Add optional `weeks_at_current_volume` input (integer).
- If `weeks_at_current_volume < 8` OR if a `returning_from_layoff_weeks` field is set ≥8, start volume at 70% of `current_weekly_km` and ramp at ≤10%/week.
- For Case 01, W1 volume drops from 20km to 13–14km if returning-runner detection fires.

---

### M-04 — `volume_constraint_note` actionability
**Source:** Round-two Case 03. Note explains math but doesn't suggest input change.
**Files:** `lib/plan/volume.ts` (or wherever the note is generated)

**Acceptance criteria:**
- When the engine downgrades to maintenance, the `volume_constraint_note` MUST include both diagnosis and prescription.
- Format: "{diagnosis}. To enable a build profile: {actionable input changes}."
- Engine identifies which input is the bottleneck (days_available, max_weekday_mins, longest_recent_run_km) and suggests the minimum change required.

**Example output for Anna:**
```
"Peak volume 44 km is 102% of week 1 (43 km) — below the 110% overload
threshold. Plan maintains current fitness rather than building it.
To enable a build profile: increase days_available from 4 to 5,
OR raise max_weekday_mins from 75 to 90."
```

---

### M-05 — Race-week mid-week run for HM/marathon
**Source:** Round-two Case 03. Race week non-race volume only 8km across two 4km shakeouts.
**Files:** `lib/plan/phase/taper.ts`, `docs/canonical/CoachingPrinciples.md`

**Acceptance criteria:**
- For HM and marathon time-targeted plans, race week includes one slightly longer easy run (6–8km for HM, 8–10km for marathon) on a non-shakeout day.
- For 10K and below, current shakeout-only race week is fine.

---

## [LOW] — Polish

### L-01 — 5K long-run cap for finish-goal plans
**Source:** Round-two Case 01. W9 long run 84min for a 5K finish goal.
**Files:** `lib/plan/longRun.ts`

**Acceptance criteria:**
- For `goal: finish` and `race_distance_km <= 5`, peak long run capped at 70 min.
- Aerobic development through frequency and total volume, not extended long runs.

---

### L-02 — Theme/copy tightening
**Source:** Round-two Case 01. "It will feel hard. That is correct." appears on all-easy peak weeks.
**Files:** `lib/plan/themes.ts`, `lib/plan/invariants.ts`

**Acceptance criteria:**
- "It will feel hard" or similar effort-language themes only apply to weeks containing quality sessions OR weeks where `weekly_km` is the absolute peak of the plan AND volume is ≥125% of W1.
- Extend the existing `themeMatchesPrescription` invariant to cover this case.

---

### L-03 — VDOT discount staleness compounding
**Source:** Round-two new finding. VDOT discount uniform regardless of benchmark age.
**Files:** `lib/plan/vdot.ts`, `docs/canonical/CoachingPrinciples.md`

**Acceptance criteria:**
- VDOT discount % scales with benchmark age: 3% for benchmarks ≤4 weeks old, +1% per additional 4 weeks (so 4% for 5–8 weeks, 5% for 9–12 weeks, max 7%).
- For Case 02 (benchmark 6 weeks old at plan start), discount becomes 4% instead of 3%.
- Surface the staleness adjustment in `vdot_discount_reasoning` field in meta.

---

## Expected post-fix outcomes

After completing the [HIGH] block, the regenerated plans should show:

- **Case 02 W8/W9:** Either renamed to "Threshold intervals" / "Cruise intervals" with pace 4:36–4:47/km accepted, OR pace tightened to ~4:25/km and labels stay as VO2max.
- **Case 02 second half:** ≥50% of quality sessions at goal pace (within ±5% of 5:00/km). Likely means W6 becomes goal-pace work.
- **Case 02 W8 coach note:** No longer "Boring is the point". Replaced with VO2max-appropriate cue.
- **All cases:** Meta-test fails CI if a new invariant isn't asserted against all three cases.

After [MEDIUM]:
- **Case 03 peak long run:** Pushed to 19–20km (90–95% of race distance) given Anna's persona.
- **Case 03 W11/W12:** Different quality sessions, not repeated "Progressive tempo".
- **Case 01 W1:** Drops to 13–14km if returning-runner detection fires.
- **Case 03 `volume_constraint_note`:** Includes actionable input change suggestion.
- **Case 03 race week:** Adds 6–8km mid-week easy run.

After [LOW]:
- **Case 01:** Long-run cap at 70min for 5K finish.
- **Theme copy:** "It will feel hard" no longer on all-easy peak weeks.
- **VDOT discount:** Scales with benchmark age.
