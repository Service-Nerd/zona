// Committed snapshot of the columns a Supabase `.select()` may name.
//
// SELECT-COLUMN-GATE-01, born from HK-ELEV-COLUMN-01: two selects asked
// `strava_activities` for `total_elevation_gain`. The column is
// `elevation_gain`. Supabase answers a bad column with `{ data: null, error }`,
// both call sites destructured the error away, and the guard that followed read
// the failure as "no runs" — so HealthKit runs silently failed to load for
// THREE AND A HALF MONTHS. The only trace was Postgres errors in a log nobody
// reads, until the founder exported one.
//
// ⚠️ HAND-MAINTAINED ON PURPOSE. A test that queries the live database needs
// credentials, so it would not run in CI, and a check that does not run is not
// a check — this repo has recorded that twice. Refresh with:
//
//   select table_name, string_agg(column_name, ',' order by column_name)
//   from information_schema.columns where table_schema = 'public' group by 1;
//
// ⚠️ A column added to the database and NOT to this file reads as missing here,
// which fails a build rather than shipping a silent query. That is the safe
// direction to be wrong in, and it is deliberate.
//
// Snapshot taken 2026-09-22 against project wkppmpsvqkaxbekdgzdm.
export const TABLE_COLUMNS: Record<string, string[]> = {
  admin_user_directory: ['email', 'first_name', 'id', 'is_admin', 'last_name', 'last_sign_in_at', 'signed_up', 'trial_started_at'],
  admin_user_tiers: ['email', 'first_name', 'grant_expires', 'grant_partner', 'id', 'is_admin', 'last_name', 'last_sign_in_at', 'signed_up', 'sub_provider', 'sub_renews', 'sub_status', 'tier', 'trial_days_left', 'trial_started_at'],
  ai_rate_limits: ['bucket_key', 'count', 'window_start'],
  analytics_events: ['created_at', 'event', 'id', 'props', 'user_id'],
  charity_batches: ['cap', 'created_at', 'id', 'notes', 'partner_name', 'revoked_at'],
  charity_codes: ['batch_id', 'claimed_at', 'claimed_by', 'code', 'created_at', 'expires_at', 'id'],
  daily_coach_notes: ['ai_model', 'content', 'generated_at', 'note_date', 'user_id'],
  free_insights: ['ai_model', 'body', 'created_at', 'headline', 'user_id', 'week_start_date'],
  health_daily_samples: ['created_at', 'hrv_ms', 'rhr_bpm', 'sample_date', 'sleep_hours', 'sleep_stages', 'source', 'user_id', 'vo2_max'],
  notifications: ['body', 'created_at', 'id', 'read_at', 'title', 'type', 'url', 'user_id'],
  ops_events: ['created_at', 'detail', 'id', 'kind', 'user_id'],
  phase_summaries: ['ai_model', 'content', 'generated_at', 'phase_ended', 'transition_week_n', 'user_id'],
  plan_adjustments: ['adjustment_type', 'confirmed_at', 'created_at', 'id', 'reverted_at', 'rule_engine_version', 'sessions_after', 'sessions_before', 'status', 'summary', 'superseded_at', 'trigger_detail', 'trigger_type', 'user_id', 'week_n'],
  plan_archive: ['archived_at', 'id', 'plan_json', 'race_date', 'race_name', 'user_id'],
  plan_weekly_notes: ['ai_model', 'generated_at', 'headline', 'items', 'user_id', 'week_n'],
  plans: ['created_at', 'id', 'plan_json', 'updated_at', 'user_id'],
  post_race_reshapes: ['ai_enriched_at', 'ai_model', 'ai_prompt_version', 'confirmed_at', 'created_at', 'dismissed_at', 'id', 'original_plan_json', 'race_distance_km', 'race_result', 'race_week_n', 'recovery_config_key', 'reshaped_plan_json', 'reverted_at', 'sessions_modified', 'status', 'summary_text', 'user_id', 'weeks_affected'],
  push_subscriptions: ['auth', 'created_at', 'endpoint', 'id', 'p256dh', 'platform', 'updated_at', 'user_id'],
  race_readiness_notes: ['ai_model', 'content', 'days_to_race', 'generated_at', 'race_date', 'user_id'],
  run_analysis: ['actual_load_km', 'actual_load_mins', 'apple_health_uuid', 'created_at', 'distance_score', 'ef_baseline', 'ef_score', 'ef_trend_pct', 'ef_value', 'feedback_text', 'hr_above_ceiling_pct', 'hr_below_floor_pct', 'hr_discipline_score', 'hr_in_zone_pct', 'hr_pct_z1', 'hr_pct_z2', 'hr_pct_z3', 'hr_pct_z4_5', 'id', 'pace_score', 'planned_load_km', 'planned_load_mins', 'rule_engine_version', 'session_day', 'source', 'strava_activity_id', 'superseded_at', 'total_score', 'user_id', 'verdict', 'week_n'],
  session_catalogue: ['category', 'coach_voice_notes', 'created_at', 'difficulty_tier', 'distance_eligibility', 'fitness_level_min', 'id', 'intensity_zones', 'is_free_tier', 'main_set_structure', 'name', 'phase_eligibility', 'purpose', 'typical_duration_max', 'typical_duration_min'],
  session_completions: ['apple_health_uuid', 'avg_hr', 'coaching_flag', 'created_at', 'fatigue_tag', 'id', 'rpe', 'session_day', 'skip_reason', 'status', 'strava_activity_id', 'strava_activity_km', 'strava_activity_name', 'superseded_at', 'updated_at', 'user_id', 'week_n'],
  session_guidance: ['created_at', 'how', 'id', 'phase', 'session_type', 'title', 'updated_at', 'what', 'why'],
  session_metric_overrides: ['id', 'metric', 'session_key', 'superseded_at', 'updated_at', 'user_id', 'week_n'],
  session_overrides: ['id', 'new_day', 'original_day', 'superseded_at', 'updated_at', 'user_id', 'week_n'],
  session_reflections: ['created_at', 'id', 'note_source', 'note_text', 'reframe_data_tier', 'reframe_generated_at', 'reframe_model', 'reframe_prompt_version', 'reframe_silenced', 'reframe_silenced_reason', 'reframe_text', 'session_day', 'superseded_at', 'updated_at', 'user_id', 'voice_duration_s', 'voice_transcript_confidence', 'week_n'],
  strava_activities: ['activity_type', 'apple_health_uuid', 'avg_hr', 'avg_speed', 'avg_temp_c', 'calories_kcal', 'created_at', 'distance_m', 'elapsed_time_s', 'elevation_gain', 'hr_above_ceiling_pct', 'hr_arrived_late_at', 'hr_below_floor_pct', 'hr_bpm_histogram', 'hr_in_zone_pct', 'hr_pct_z1', 'hr_pct_z2', 'hr_pct_z3', 'hr_pct_z4_5', 'hr_present_at_first_query', 'id', 'manual_uuid', 'max_hr', 'moving_time_s', 'name', 'processed_at', 'raw_payload', 'source', 'splits_metric', 'sport_type', 'start_date', 'strava_activity_id', 'suffer_score', 'user_id'],
  subscriptions: ['created_at', 'current_period_end', 'id', 'last_event_at', 'provider', 'status', 'updated_at', 'user_id'],
  user_settings: ['benchmark_recal_dismissed_at', 'birth_year', 'connect_runs_banner_dismissed_at', 'connect_runs_seen', 'daily_push_enabled', 'daily_push_last_sent_on', 'date_of_birth', 'dynamic_adjustments_enabled', 'email', 'first_name', 'gist_url', 'has_onboarded', 'healthkit_connected_at', 'id', 'is_admin', 'last_adjustment_check_at', 'last_adjustment_check_found_change', 'last_name', 'last_today_open_at', 'max_hr', 'max_hr_source', 'orientation_seen', 'plan_json', 'preferred_metric', 'preferred_units', 'push_permission_seen', 'quit_date', 'resting_hr', 'smoke_tracker_enabled', 'strava_access_token', 'strava_athlete_id', 'strava_client_secret', 'strava_refresh_token', 'strava_token_expires_at', 'timezone', 'trial_email_day11_sent_at', 'trial_email_day14_sent_at', 'trial_insight_push_sent_at', 'trial_started_at', 'updated_at', 'zone_boundaries', 'zone_drift_dismissed_at'],
  waitlist: ['created_at', 'email', 'id', 'source'],
  weekly_reports: ['acute_chronic_ratio', 'ai_model', 'avg_rpe', 'body', 'created_at', 'cta', 'dominant_flag', 'generated_at', 'headline', 'id', 'opened_at', 'rule_engine_version', 'sessions_completed', 'sessions_planned', 'superseded_at', 'total_km_actual', 'total_km_planned', 'user_id', 'week_n', 'zone_discipline_score'],
}
