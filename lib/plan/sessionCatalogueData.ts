// FREE — infrastructure
//
// ⚖️  COACHING DOCTRINE FILE. This is the canonical catalogue of concrete
// sessions the engine is allowed to prescribe. Changes to what a runner can
// be given require a Coaching Board review (ADR-017, INV-COACH-001).
// Enforced by .claude/hooks/coaching-guard.py.
//
// SOURCE OF TRUTH (SC-00, 2026-08-20 — was previously mis-stated).
// This constant IS the runtime source of truth. It is not a mirror.
//
// The Supabase `session_catalogue` table is RETIRED and read by nothing.
// It was seeded once (supabase/migrations/20260425_session_catalogue.sql,
// 14 rows) and then diverged: this file gained `goal_pace_sharpener`,
// `hm_pace_long_run`, and taper eligibility on `tempo_continuous`, none of
// which were ever migrated. Every plan ever generated came from this file.
// Do not re-point the engine at the table — as it stands that would empty
// the 5K and 10K taper (zero eligible rows → the engine falls through to an
// unnamed inline label with no purpose, structure or coach's voice).
//
// Why the file and not the table (ADR-010 amended 2026-08-20):
// - A table is invisible to the coaching-guard hook. Prescription could be
//   changed by a SQL update with no board review — an INV-COACH-001 hole.
// - Keeps `lib/plan/ruleEngine.ts` a pure function of its inputs, with no
//   network dependency on a path that must never fail (ADR-006, ADR-009).
// The cost, accepted: catalogue changes require a deploy.

export type CatalogueCategory =
  | 'aerobic' | 'threshold' | 'vo2max' | 'race_specific' | 'ultra_specific'

export type CatalogueFitness = 'beginner' | 'intermediate' | 'experienced'

export interface SessionCatalogueRow {
  id:                   string
  name:                 string
  category:             CatalogueCategory
  purpose:              string
  phase_eligibility:    Array<'base' | 'build' | 'peak' | 'taper'>
  distance_eligibility: Array<'5K' | '10K' | 'HM' | 'MARATHON' | '50K' | '100K'>
  fitness_level_min:    CatalogueFitness
  difficulty_tier:      number
  main_set_structure:   Record<string, unknown>
  /**
   * SC-09 / CD-17a — one parameterised row rather than three near-identical
   * ones. The label template renders the parameter ("Hill reps — 45s" /
   * "Hill reps — 90s") so §53's variety rule, which counts LABELS, still works
   * from a single entry with one set of voice copy.
   *
   * A parameter is a DIAL SETTING, not a different session: every variant must
   * share this row's `category`. A 3-minute hill rep is a threshold stimulus on
   * a gradient — a different session, which gets its own row and its own board
   * ruling (CD-17a addendum, 2026-08-20).
   */
  parameterisation?: {
    name_template: string
    variants: Array<{ label_suffix: string; values: Record<string, number> }>
  }
  intensity_zones:      string[]
  typical_duration_min: number
  typical_duration_max: number
  is_free_tier:         boolean
  coach_voice_notes:    string | null
}

export const V1_SESSION_CATALOGUE: SessionCatalogueRow[] = [
  {
    id: 'aerobic_steady', name: 'Steady aerobic', category: 'aerobic',
    purpose: 'Build the aerobic engine. Most of the work happens here.',
    phase_eligibility: ['base', 'build'],
    distance_eligibility: ['5K', '10K', 'HM', 'MARATHON', '50K', '100K'],
    fitness_level_min: 'beginner', difficulty_tier: 1,
    main_set_structure: { type: 'continuous', zone: 'Z2' },
    intensity_zones: ['Z2'],
    typical_duration_min: 30, typical_duration_max: 50, is_free_tier: true,
    coach_voice_notes: 'Boring is the point. If it feels productive, slow down.',
  },
  {
    id: 'aerobic_hills', name: 'Aerobic with hills', category: 'aerobic',
    purpose: 'Aerobic work with elevation. Effort, not pace, is the metric.',
    phase_eligibility: ['base', 'build'],
    distance_eligibility: ['5K', '10K', 'HM', 'MARATHON', '50K', '100K'],
    fitness_level_min: 'intermediate', difficulty_tier: 2,
    main_set_structure: { type: 'continuous', zone: 'Z2', terrain: 'hills' },
    intensity_zones: ['Z2'],
    typical_duration_min: 40, typical_duration_max: 60, is_free_tier: true,
    coach_voice_notes: 'Hills lie. Watch the effort, not the pace.',
  },
  {
    id: 'fartlek_unstructured', name: 'Unstructured fartlek', category: 'aerobic',
    purpose: 'Free-play surges within an aerobic run. Wakes the legs without a structured stress.',
    phase_eligibility: ['base'],
    distance_eligibility: ['5K', '10K', 'HM', 'MARATHON', '50K', '100K'],
    fitness_level_min: 'intermediate', difficulty_tier: 2,
    main_set_structure: { type: 'fartlek', zone_base: 'Z2', zone_surge: 'Z3' },
    intensity_zones: ['Z2', 'Z3'],
    typical_duration_min: 40, typical_duration_max: 40, is_free_tier: true,
    coach_voice_notes: 'Pick a tree. Run to it. Recover. No watch.',
  },
  {
    id: 'tempo_continuous', name: 'Continuous tempo', category: 'threshold',
    purpose: 'Sustained sub-threshold work. Builds the ceiling.',
    // CD-2/§36 — taper-eligible so a finish-goal taper has a second honest
    // threshold flavour to alternate with progressive_tempo (§6 keep intensity,
    // cut volume). Previously the only taper variety came from goal_pace_sharpener,
    // which is a time-target-only tool now correctly gated out of finish tapers.
    phase_eligibility: ['build', 'peak', 'taper'],
    distance_eligibility: ['5K', '10K', 'HM', 'MARATHON', '50K', '100K'],
    fitness_level_min: 'intermediate', difficulty_tier: 3,
    main_set_structure: { type: 'continuous', duration_mins: 30, zone: 'Z3' },
    intensity_zones: ['Z3'],
    typical_duration_min: 20, typical_duration_max: 40, is_free_tier: true,
    coach_voice_notes: 'Sustainable. Same pace at the end as at the start.',
  },
  {
    id: 'tempo_cruise', name: 'Cruise intervals', category: 'threshold',
    purpose: 'Threshold work in repeats. Same effort on rep 3 as rep 1 — that is the test.',
    phase_eligibility: ['build'],
    distance_eligibility: ['5K', '10K', 'HM', 'MARATHON', '50K', '100K'],
    fitness_level_min: 'intermediate', difficulty_tier: 3,
    main_set_structure: { type: 'repeats', reps: 3, work: { duration_mins: 10, zone: 'Z3' }, recovery: { duration_mins: 2, type: 'jog' } },
    intensity_zones: ['Z3'],
    typical_duration_min: 30, typical_duration_max: 45, is_free_tier: true,
    coach_voice_notes: 'Rep three is the test. Not rep one.',
  },
  {
    // SC-04 / CD-15 (2026-08-20) — threshold work sized for a runner racing 5K
    // or 10K. `tempo_cruise` above is 10-minute reps, written marathon-first;
    // five-minute reps suit the shorter-race runner and the four-day week.
    //
    // McMillan's binding amendment: band the rep at 4–12 minutes rather than
    // fixing it at five, because variety across a block matters more than any
    // single rep length. The v1 schema cannot express a band (that is SC-08),
    // so the band is delivered ACROSS ROWS for now: this row's 5-minute reps
    // and `tempo_cruise`'s 10-minute reps both sit inside 4–12, and the §53
    // variety rule alternates them. Collapse to one parameterised row when the
    // v2 structure lands.
    //
    // NAME MUST STAY DISTINCT from `tempo_cruise` ("Cruise intervals"). Two
    // rows sharing a name would break the §53 variety count (it counts labels)
    // and the display-time structure join (it matches on name — SC-08).
    id: 'tempo_cruise_short', name: 'Cruise intervals — short', category: 'threshold',
    purpose: 'Threshold work in repeats, sized for a 5K or 10K. The test is rep four, not rep one.',
    phase_eligibility: ['build', 'peak'],
    distance_eligibility: ['5K', '10K'],
    fitness_level_min: 'intermediate', difficulty_tier: 3,
    main_set_structure: { type: 'repeats', reps: 4, work: { duration_mins: 5, zone: 'Z3' }, recovery: { duration_secs: 90, type: 'jog' } },
    intensity_zones: ['Z3'],
    typical_duration_min: 25, typical_duration_max: 40, is_free_tier: true,
    coach_voice_notes: 'Rep four is the test. Not rep one.',
  },
  {
    id: 'progressive_tempo', name: 'Progressive tempo', category: 'threshold',
    purpose: 'Gradual ramp from aerobic to threshold. Trains discipline at the start, honesty at the end.',
    phase_eligibility: ['build', 'peak', 'taper'],
    distance_eligibility: ['5K', '10K', 'HM', 'MARATHON', '50K', '100K'],
    fitness_level_min: 'intermediate', difficulty_tier: 3,
    main_set_structure: { type: 'progression', duration_mins: 30, zone_start: 'Z2', zone_end: 'Z3' },
    intensity_zones: ['Z2', 'Z3'],
    typical_duration_min: 25, typical_duration_max: 40, is_free_tier: true,
    coach_voice_notes: 'Hold back early. Finish honest.',
  },
  {
    id: 'intervals_classic', name: 'Classic VO2max', category: 'vo2max',
    purpose: 'Hard interval work targeting Z4–Z5. Builds peak capacity.',
    phase_eligibility: ['build', 'peak'],
    distance_eligibility: ['5K', '10K'],
    fitness_level_min: 'intermediate', difficulty_tier: 4,
    main_set_structure: { type: 'repeats', reps: 5, work: { duration_mins: 3, zone: 'Z4_Z5' }, recovery: { duration_mins: 2, type: 'jog' } },
    intensity_zones: ['Z4', 'Z5'],
    typical_duration_min: 35, typical_duration_max: 50, is_free_tier: true,
    coach_voice_notes: 'Three minutes is long. Don\'t blow rep one.',
  },
  {
    id: 'intervals_short', name: 'Short VO2max', category: 'vo2max',
    purpose: 'Sharp speed work. Quick feet, controlled effort, even splits.',
    phase_eligibility: ['build', 'peak'],
    distance_eligibility: ['5K'],
    fitness_level_min: 'intermediate', difficulty_tier: 4,
    main_set_structure: { type: 'repeats', reps: 10, work: { distance_m: 400, pace_target: '3K' }, recovery: { duration_secs: 90, type: 'jog' } },
    intensity_zones: ['Z4', 'Z5'],
    typical_duration_min: 35, typical_duration_max: 50, is_free_tier: true,
    coach_voice_notes: 'Don\'t race your splits. Even, not desperate.',
  },
  {
    id: 'intervals_long', name: 'Long VO2max', category: 'vo2max',
    purpose: 'Race-pace 1Ks. The point is even splits, not heroic openers.',
    phase_eligibility: ['build', 'peak'],
    distance_eligibility: ['5K', '10K'],
    fitness_level_min: 'intermediate', difficulty_tier: 4,
    main_set_structure: { type: 'repeats', reps: 4, work: { distance_m: 1000, pace_target: '5K' }, recovery: { duration_mins: 2, type: 'jog' } },
    intensity_zones: ['Z4', 'Z5'],
    typical_duration_min: 40, typical_duration_max: 55, is_free_tier: true,
    coach_voice_notes: 'Heroic openers ruin it. Even splits.',
  },
  // ── SC-09 / CD-17a — hill repeats. THE FIRST v2 ROW. ──────────────────────
  //
  // Ruled CORRECT, unanimous. The engine's own stimulus ladder already had a
  // rung called "hills" (STIMULUS_RANK.hills = 3, between steady_aerobic and
  // tempo) that NOTHING in the catalogue could occupy. Adding this makes an
  // existing rule true rather than inventing one.
  //
  // Why the board wanted it: one of the highest-value sessions available to a
  // time-limited amateur — strength, economy and a VO2max-adjacent stimulus at
  // lower impact loading than flat intervals, and no track required. McMillan:
  // "self-limiting by gradient, effort-governed so it works on a day when the
  // legs are flat." Sims: bone stimulus at sub-maximal speed, specifically hard
  // to get elsewhere in a training week and specifically valuable perimenopause.
  //
  // ONE PARAMETERISED ROW, not three (see `parameterisation`).
  //
  // NO MANUAL REP ADVANCE — CD-17a struck the audit's `advance: "manual"`.
  // McMillan: "you are asking a runner to interact with their watch at the top
  // of every rep while breathing hard." Build from the ruling, not audit §E.3.
  //
  // EFFORT GOVERNS THE CLIMB, and that is deliberate: the work step carries
  // `target: { kind: 'effort' }` with NO pace. A pace up a hill is meaningless —
  // gradient decides it. This is the first session where effort is the primary
  // prescription rather than a supporting note (§41), which is why §19's
  // label-vs-pace check needs its effort-governed counterpart.
  //
  // The descent is PRESCRIBED, not left to the runner, and capped at easy pace.
  // Willy: the descent loads the knee hardest, and it is the reason the injury
  // exclusion matters MORE here, not less.
  {
    id: 'hill_reps',
    name: 'Hill reps',
    category: 'vo2max',
    purpose: 'Strength and running economy under load. Effort governs the climb; the watch does not.',
    phase_eligibility: ['build', 'peak'],
    // ⚠️ NARROWED FROM CD-17a's "5K through marathon" — 5K and 10K ONLY, because
    // those are the only distances that can REACH a vo2max-category row.
    //
    // Verified before shipping, not assumed: `preferredQualityCategory` gives
    // HM and MARATHON `threshold` in build (their signature focus is
    // ['threshold', 'race_specific'], and race_specific filters out of the
    // midweek ladder) and `race_specific`/`threshold` in peak. A vo2max row is
    // never selectable for them, so declaring the eligibility would ship DEAD
    // WEIGHT — precisely the defect SC-05 was created to fix ("the row would
    // have been dead weight as specced").
    //
    // Extending hills to HM/MARATHON is a real coaching ask — McMillan rates it
    // highly for exactly those runners — but it needs their signature focus
    // changed, which alters marathon prescription well beyond CD-17a. Filed as
    // a separate ruling rather than smuggled in via an eligibility array.
    distance_eligibility: ['5K', '10K'],
    fitness_level_min: 'intermediate',
    difficulty_tier: 3,
    parameterisation: {
      name_template: 'Hill reps — {param}',
      // Both variants are `vo2max` — that is the test for whether something is
      // a variant at all. The 3-minute rep from the audit's set is threshold
      // work on a gradient and is DEFERRED to its own row and ruling.
      variants: [
        { label_suffix: '45s', values: { rep_secs: 45, reps: 10 } },
        { label_suffix: '90s', values: { rep_secs: 90, reps: 8 } },
      ],
    },
    main_set_structure: {
      version: 2,
      sizing: { scaling: 'reps' },
      blocks: [
        {
          repeat: 1,
          label: 'to the hill',
          steps: [
            {
              role: 'transition', modality: 'run',
              length: { kind: 'to_landmark', landmark: 'hill_base' },
              // Ceiling, not a target: getting to the hill is not the session.
              target: { kind: 'pace', anchor: 'E', mode: 'ceiling' },
              advance: 'auto',
            },
          ],
        },
        {
          repeat: { kind: 'parameter', param: 'reps' },
          label: 'reps',
          steps: [
            {
              role: 'work', modality: 'run', terrain: 'uphill', grade_pct: [5, 8],
              length: { kind: 'parameter', param: 'rep_secs' },
              target: { kind: 'effort', rpe: 8 },
              advance: 'auto',
              note: 'Strong and controlled, not a sprint. The hill sets the pace.',
            },
            {
              role: 'recovery', modality: 'stand',
              length: { kind: 'open' },
              target: { kind: 'none' },
              advance: 'auto',
              note: 'Turn around, get your breath back. No rush.',
            },
            {
              role: 'recovery', modality: 'jog', terrain: 'downhill',
              length: { kind: 'mirror', of: 'previous_work' },
              target: { kind: 'pace', anchor: 'E', mode: 'ceiling' },
              advance: 'auto',
              note: 'Easy on the way down. The descent is where the damage happens.',
            },
          ],
        },
      ],
    },
    intensity_zones: ['Z4', 'Z5'],
    typical_duration_min: 35,
    typical_duration_max: 50,
    is_free_tier: true,
    coach_voice_notes: 'No track, no measured loop, no pace to chase. The gradient does the work — you just have to keep the effort honest and come back down slowly.',
  },
  {
    id: 'goal_pace_sharpener', name: 'Goal-pace sharpener', category: 'race_specific',
    purpose: 'Short reps at race pace with full recovery. Sharpens neuromuscular pace memory for race day.',
    phase_eligibility: ['taper'],
    distance_eligibility: ['5K', '10K', 'HM', 'MARATHON', '50K', '100K'],
    fitness_level_min: 'intermediate', difficulty_tier: 3,
    main_set_structure: { type: 'repeats', reps: 3, work: { distance_m: 1000, pace_target: 'goal' }, recovery: { duration_secs: 90, type: 'jog' } },
    intensity_zones: ['Z3', 'Z4'],
    typical_duration_min: 25, typical_duration_max: 40, is_free_tier: true,
    coach_voice_notes: 'Crisp at goal pace. Even splits. Exit each rep wanting more.',
  },
  {
    id: 'hm_pace_long_run', name: 'Long run with HM-pace finish', category: 'race_specific',
    purpose: 'HM-specific long run. Easy first, then race pace on legs that are already tired.',
    phase_eligibility: ['peak'],
    distance_eligibility: ['HM'],
    fitness_level_min: 'intermediate', difficulty_tier: 4,
    main_set_structure: { type: 'long_run_with_segment', easy_pct: 65, race_pace_pct: 35, race_pace_zone: 'HM' },
    intensity_zones: ['Z2', 'Z3'],
    typical_duration_min: 75, typical_duration_max: 130, is_free_tier: true,
    coach_voice_notes: 'Easy first. Final third at HM goal pace.',
  },
  {
    id: 'mp_long_run', name: 'Marathon-pace long run', category: 'race_specific',
    purpose: 'Race-specific long run. Goal pace gets practised on legs that are already tired.',
    phase_eligibility: ['peak'],
    distance_eligibility: ['MARATHON'],
    fitness_level_min: 'intermediate', difficulty_tier: 4,
    main_set_structure: { type: 'long_run_with_segment', easy_pct: 60, race_pace_pct: 40, race_pace_zone: 'MP' },
    intensity_zones: ['Z2', 'Z3'],
    typical_duration_min: 90, typical_duration_max: 180, is_free_tier: true,
    coach_voice_notes: 'Easy first. Hit goal pace on tired legs.',
  },
  {
    id: 'hm_pace_intervals', name: 'HM-pace intervals', category: 'race_specific',
    purpose: 'Race-specific intervals at HM pace. Bridges the gap between threshold and race day.',
    phase_eligibility: ['peak'],
    distance_eligibility: ['HM'],
    fitness_level_min: 'intermediate', difficulty_tier: 4,
    main_set_structure: { type: 'repeats', reps: 4, work: { distance_m: 2000, pace_target: 'HM' }, recovery: { duration_mins: 3, type: 'jog' } },
    intensity_zones: ['Z3', 'Z4'],
    typical_duration_min: 50, typical_duration_max: 70, is_free_tier: true,
    coach_voice_notes: 'HM pace, not faster. Exit each rep wanting more.',
  },
  {
    // SC-05 / CD-18 (2026-08-20) — 10K is one of two free-tier flagship
    // distances and had NO race-specific session, while HM had two. That was
    // not a decision anyone made; it is where the catalogue stopped.
    //
    // The gap was invisible in the product because the engine papered over it:
    // §33 sanctions renaming a borrowed row to "10K-pace progression" and
    // correctly replaces the voice, so the plan LOOKED like it contained
    // 10K-pace work. The board's finding: §33 closed the review by fixing the
    // symptom (borrowed voice) and left the cause (no 10K entry) in place.
    //
    // Mirrors hm_pace_intervals. v1-expressible as a fixed 4 × 1200 m, so it
    // ships on today's schema with no SC-08 dependency.
    id: 'tenk_pace_intervals', name: '10K-pace intervals', category: 'race_specific',
    purpose: 'Race-specific intervals at 10K pace. The bridge between threshold and race day.',
    phase_eligibility: ['peak', 'taper'],
    distance_eligibility: ['10K'],
    fitness_level_min: 'intermediate', difficulty_tier: 4,
    main_set_structure: { type: 'repeats', reps: 4, work: { distance_m: 1200, pace_target: 'goal' }, recovery: { duration_mins: 2, type: 'jog' } },
    intensity_zones: ['Z3', 'Z4'],
    typical_duration_min: 40, typical_duration_max: 55, is_free_tier: true,
    coach_voice_notes: 'Goal pace, not faster. If rep one feels easy, that is correct.',
  },
  {
    id: 'ultra_race_sim', name: 'Ultra race simulation', category: 'ultra_specific',
    purpose: 'Practice the race. Fuelling, pacing, kit — all rehearsed in the conditions you will run.',
    phase_eligibility: ['peak'],
    distance_eligibility: ['50K', '100K'],
    fitness_level_min: 'intermediate', difficulty_tier: 4,
    main_set_structure: { type: 'long_run_with_fuelling', duration_mins_min: 120, duration_mins_max: 180, zone: 'Z2_plus', fuel_every_mins: 25 },
    intensity_zones: ['Z2', 'Z3'],
    typical_duration_min: 120, typical_duration_max: 180, is_free_tier: false,
    coach_voice_notes: 'Eat on the clock. Hunger is too late.',
  },
  {
    id: 'back_to_back_long', name: 'Back-to-back long', category: 'ultra_specific',
    purpose: 'Train cumulative fatigue. Sunday is meant to feel heavy — that is the adaptation.',
    phase_eligibility: ['build', 'peak'],
    distance_eligibility: ['50K', '100K'],
    fitness_level_min: 'intermediate', difficulty_tier: 4,
    main_set_structure: { type: 'back_to_back', day_1: { duration_mins: 90, zone: 'Z2' }, day_2: { duration_mins_min: 120, duration_mins_max: 180, zone: 'Z2' } },
    intensity_zones: ['Z2'],
    typical_duration_min: 210, typical_duration_max: 270, is_free_tier: false,
    coach_voice_notes: 'Sunday is meant to feel heavy. That\'s the adaptation.',
  },
  {
    id: 'time_on_feet', name: 'Time on feet', category: 'ultra_specific',
    purpose: 'Pure endurance. Walk the climbs, eat on schedule, accumulate hours. Pace is irrelevant.',
    phase_eligibility: ['peak'],
    distance_eligibility: ['100K'],
    fitness_level_min: 'intermediate', difficulty_tier: 5,
    main_set_structure: { type: 'time_on_feet', duration_mins_min: 240, duration_mins_max: 360, zone: 'Z2', fuel_every_mins: 30, include_walk_breaks: true },
    intensity_zones: ['Z1', 'Z2'],
    typical_duration_min: 240, typical_duration_max: 360, is_free_tier: false,
    coach_voice_notes: 'Walk the climbs. Eat. Hours, not pace.',
  },
]

// Fitness ordering for catalogue eligibility filtering.
const FITNESS_RANK: Record<CatalogueFitness, number> = {
  beginner: 0, intermediate: 1, experienced: 2,
}

export interface CatalogueSelectorArgs {
  catalogue:         SessionCatalogueRow[]
  phase:             'base' | 'build' | 'peak' | 'taper'
  distanceKey:       '5K' | '10K' | 'HM' | 'MARATHON' | '50K' | '100K'
  fitness:           CatalogueFitness
  tier:              'free' | 'trial' | 'paid'
  weekN:             number
  slotIndex?:        number  // 0 or 1 for second quality session in a peak week
  preferredCategory?: CatalogueCategory
  // CoachingPrinciples §21 — exclude hill sessions during base/build when set.
  excludeHillSessions?: boolean
}

// Hill rows are tagged via main_set_structure.terrain === 'hills' OR id includes 'hill'.
// Defensive across both since not every future hill row will have terrain set.
function isHillSession(row: SessionCatalogueRow): boolean {
  const m = row.main_set_structure as {
    terrain?: string
    blocks?: Array<{ steps?: Array<{ terrain?: string }> }>
  }
  // v1: terrain is a tag on the whole session.
  if (m.terrain === 'hills') return true
  // v2 (SC-09): terrain is a property of a STEP, which is the point — a hill
  // session is one that sends the runner up (or down) a hill, and that is now
  // stated structurally rather than inferred. Checked before the id fallback so
  // a future gradient session is caught without being named "hill".
  if (Array.isArray(m.blocks)) {
    for (const b of m.blocks) {
      for (const st of b.steps ?? []) {
        if (st.terrain === 'uphill' || st.terrain === 'downhill') return true
      }
    }
  }
  // Legacy fallback for v1 rows whose terrain lives only in the id.
  return row.id.includes('hill')
}

// Long-run-with-segment rows are race-specific long runs (e.g. mp_long_run,
// hm_pace_long_run). They live in the catalogue but are selected directly by
// the long-run path in ruleEngine — never as a quality session.
function isLongRunSession(row: SessionCatalogueRow): boolean {
  const t = (row.main_set_structure as { type?: string }).type
  return t === 'long_run_with_segment'
}

/**
 * Selects a catalogue row deterministically. Filter chain:
 *   1. phase_eligibility includes phase
 *   2. distance_eligibility includes distanceKey
 *   3. fitness_level_min ≤ user fitness
 *   4. tier-aware: free users see only is_free_tier=true rows
 *   5. preferred category, with graceful fallback if none match
 *
 * Determinism: weekN + slotIndex → modulo eligible-row count. Same plan
 * regenerated produces same selection.
 */
export function selectCatalogueSession(args: CatalogueSelectorArgs): SessionCatalogueRow | null {
  const { catalogue, phase, distanceKey, fitness, tier, weekN, slotIndex = 0, preferredCategory, excludeHillSessions } = args

  const userRank = FITNESS_RANK[fitness]
  const tierFilter = (row: SessionCatalogueRow) => tier === 'free' ? row.is_free_tier : true

  const baseEligible = catalogue.filter(row =>
    row.phase_eligibility.includes(phase) &&
    row.distance_eligibility.includes(distanceKey) &&
    FITNESS_RANK[row.fitness_level_min] <= userRank &&
    tierFilter(row) &&
    !isLongRunSession(row) &&  // long-run-with-segment rows are picked by the long-run path, not as quality
    (!excludeHillSessions || !isHillSession(row))
  )

  if (baseEligible.length === 0) return null

  // Try preferred category first; fall back to all eligible if no match.
  const candidates = preferredCategory
    ? (() => {
        const filtered = baseEligible.filter(r => r.category === preferredCategory)
        return filtered.length > 0 ? filtered : baseEligible
      })()
    : baseEligible

  // Deterministic pick: weekN + slotIndex modulo candidates length.
  const idx = (weekN + slotIndex * 7) % candidates.length
  return candidates[idx]
}
