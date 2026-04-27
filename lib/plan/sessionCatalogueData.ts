// FREE — infrastructure
// In-memory mirror of the Supabase `session_catalogue` table for engine use.
// The migration (supabase/migrations/20260425_session_catalogue.sql) is the
// canonical store; this constant must stay in sync.
//
// Why a mirror file:
// - Keeps `lib/plan/ruleEngine.ts` a pure function (testable without Supabase).
// - Phase 7 validation diffs DB rows against this constant as a sync check.
// - Future: Phase 6 / API route reads from Supabase live; engine consumes
//   whatever array is passed in. The mirror is the dev/test default.

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
    phase_eligibility: ['build', 'peak'],
    distance_eligibility: ['HM', 'MARATHON', '50K', '100K'],
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
    distance_eligibility: ['HM', 'MARATHON', '50K', '100K'],
    fitness_level_min: 'intermediate', difficulty_tier: 3,
    main_set_structure: { type: 'repeats', reps: 3, work: { duration_mins: 10, zone: 'Z3' }, recovery: { duration_mins: 2, type: 'jog' } },
    intensity_zones: ['Z3'],
    typical_duration_min: 30, typical_duration_max: 45, is_free_tier: true,
    coach_voice_notes: 'Rep three is the test. Not rep one.',
  },
  {
    id: 'progressive_tempo', name: 'Progressive tempo', category: 'threshold',
    purpose: 'Gradual ramp from aerobic to threshold. Trains discipline at the start, honesty at the end.',
    phase_eligibility: ['build', 'peak', 'taper'],
    distance_eligibility: ['HM', 'MARATHON', '50K', '100K'],
    fitness_level_min: 'intermediate', difficulty_tier: 3,
    main_set_structure: { type: 'progression', duration_mins: 30, zone_start: 'Z2', zone_end: 'Z3' },
    intensity_zones: ['Z2', 'Z3'],
    typical_duration_min: 25, typical_duration_max: 40, is_free_tier: true,
    coach_voice_notes: 'Hold back early. Finish honest.',
  },
  {
    id: 'intervals_classic', name: 'Classic VO2max', category: 'vo2max',
    purpose: 'Hard interval work targeting Z4–Z5. Builds peak capacity.',
    phase_eligibility: ['peak'],
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
    phase_eligibility: ['peak'],
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
    phase_eligibility: ['peak'],
    distance_eligibility: ['5K', '10K'],
    fitness_level_min: 'intermediate', difficulty_tier: 4,
    main_set_structure: { type: 'repeats', reps: 4, work: { distance_m: 1000, pace_target: '5K' }, recovery: { duration_mins: 2, type: 'jog' } },
    intensity_zones: ['Z4', 'Z5'],
    typical_duration_min: 40, typical_duration_max: 55, is_free_tier: true,
    coach_voice_notes: 'Heroic openers ruin it. Even splits.',
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
  const terrain = (row.main_set_structure as { terrain?: string }).terrain
  return terrain === 'hills' || row.id.includes('hill')
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
