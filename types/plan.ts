// ─── Plan generator input ─────────────────────────────────────────────────────
// Shared between the API route and the client form — must not import server modules.

export interface GeneratorInput {
  // Required
  race_date: string
  race_distance_km: number
  goal: 'finish' | 'time_target'
  fitness_level: 'beginner' | 'intermediate' | 'experienced'
  current_weekly_km: number
  longest_recent_run_km: number
  days_available: number
  resting_hr: number
  max_hr: number

  // Optional
  race_name?: string
  target_time?: string
  zone2_ceiling?: number
  days_cannot_train?: string[]
  max_weekday_mins?: number
  max_weekend_mins?: number
  training_style?: 'predictable' | 'variety' | 'minimalist' | 'structured'
  hard_session_relationship?: 'avoid' | 'neutral' | 'love' | 'overdo'
  motivation_type?: 'identity' | 'achievement' | 'health' | 'social'
  injury_history?: string[]
  terrain?: 'road' | 'trail' | 'mixed'
  athlete_name?: string
}

export type WeekType =
  | 'completed'
  | 'deload_done'
  | 'current'
  | 'normal'
  | 'deload'
  | 'race_event'
  | 'race'

export type SessionType =
  | 'run' | 'easy' | 'long'
  | 'quality' | 'tempo' | 'intervals' | 'hard'
  | 'race' | 'recovery'
  | 'strength' | 'cross-train'
  | 'rest'

// INV-PLAN-009: { name, start_week, end_week } — added R23; absent on legacy plans
export interface Phase {
  name: 'base' | 'build' | 'peak' | 'taper'
  start_week: number
  end_week: number
}

export type PrimaryMetric = 'distance' | 'duration'

export interface Session {
  /** INV-PLAN-009: deterministic ID "w{N}-{day}" e.g. "w5-wed". Present on R23+ plans; absent on legacy. */
  id?: string
  type: SessionType
  label: string
  /** Legacy free-text display field. Kept for backward compat with hand-authored gists.
   *  Generator writes structured fields below instead. App prefers structured when present. */
  detail: string | null

  // Structured fields — generator-populated, optional for legacy gists
  distance_km?: number                    // e.g. 8.5
  duration_mins?: number                  // e.g. 45
  primary_metric?: PrimaryMetric          // session-level override of plan default
  zone?: string                           // e.g. "Zone 2" | "Zone 3–4"
  hr_target?: string                      // e.g. "< 145 bpm" | "155–165 bpm"
  pace_target?: string                    // e.g. "6:30–7:00 /km"
  rpe_target?: number                     // 1–10
  /** Why this session + what to watch for. Max 3 items. */
  coach_notes?: [string, string?, string?]
}

export interface Week {
  n: number
  date: string                            // ISO date string e.g. "2026-04-06"
  label: string
  theme: string
  type: WeekType
  phase?: 'base' | 'build' | 'peak' | 'taper'
  badge?: 'deload' | 'holiday' | 'race'
  sessions: Partial<Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', Session>>
  long_run_hrs: number | null
  weekly_km: number
  weekly_duration_mins?: number           // for time-based plans, alongside weekly_km
  race_notes?: string
}

export interface PlanMeta {
  // Core identity
  athlete: string
  handle: string
  race_name: string
  race_date: string
  race_distance_km: number
  charity: string
  plan_start: string
  quit_date: string

  // HR profile
  resting_hr: number
  max_hr: number
  zone2_ceiling: number

  // Plan metadata
  version: string
  last_updated: string
  notes: string

  // Plan-level display default — 'distance' assumed if absent (legacy compat)
  primary_metric?: PrimaryMetric

  // Athlete profile — stored so R20 reshaper can operate without re-asking the user
  fitness_level?: 'beginner' | 'intermediate' | 'experienced'
  goal?: 'finish' | 'time_target'
  target_time?: string                    // e.g. "4:30:00" — only if goal = time_target
  days_available?: number
  training_style?: 'predictable' | 'variety' | 'minimalist' | 'structured'
  hard_session_relationship?: 'avoid' | 'neutral' | 'love' | 'overdo'
  motivation_type?: 'identity' | 'achievement' | 'health' | 'social'
  injury_history?: string[]               // e.g. ["achilles", "knee"]
  terrain?: 'road' | 'trail' | 'mixed'

  // Generator metadata
  generated_at?: string                   // ISO timestamp of generation
  generator_version?: string              // e.g. "1.0"

  // R18 — confidence score produced at generation time (INV-PLAN-008: PAID only)
  confidence_score?: number               // 1–10
  confidence_risks?: string[]             // e.g. ["low base volume", "tight timeline"]

  // R23 — hybrid generation fields
  tier?: 'free' | 'trial' | 'paid'       // tier at which plan was generated
  compressed?: boolean                    // true if available weeks < ideal minimum for this distance
  coach_intro?: string                    // PAID only — enricher-generated intro paragraph
}

export interface Plan {
  meta: PlanMeta
  /** Phase distribution — present on R23+ plans; absent on legacy gist plans. */
  phases?: Phase[]
  weeks: Week[]
}

export interface StravaActivity {
  id: number
  name: string
  type: string
  sport_type: string
  start_date: string
  distance: number        // metres
  moving_time: number     // seconds
  elapsed_time: number    // seconds
  total_elevation_gain: number
  average_heartrate?: number
  max_heartrate?: number
  average_speed: number
  suffer_score?: number
}

export interface UserProfile {
  id: string
  email: string
  full_name?: string
  strava_refresh_token?: string
  created_at: string
}
