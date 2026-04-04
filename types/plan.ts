export type WeekType =
  | 'completed'
  | 'deload_done'
  | 'current'
  | 'normal'
  | 'deload'
  | 'race_event'
  | 'race'

export type SessionType = 'run' | 'easy' | 'strength' | 'rest' | 'race'

export interface Session {
  type: SessionType
  label: string
  detail: string | null
}

export interface Week {
  n: number
  date: string           // ISO date string e.g. "2026-04-06"
  label: string
  theme: string
  type: WeekType
  badge?: 'deload' | 'holiday' | 'race'
  sessions: Partial<Record<'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun', Session>>
  long_run_hrs: number | null
  weekly_km: number
  race_notes?: string
}

export interface PlanMeta {
  athlete: string
  handle: string
  race_name: string
  race_date: string
  race_distance_km: number
  charity: string
  plan_start: string
  quit_date: string
  resting_hr: number
  max_hr: number
  zone2_ceiling: number
  version: string
  last_updated: string
  notes: string
}

export interface Plan {
  meta: PlanMeta
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
