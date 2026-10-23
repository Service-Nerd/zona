// REBUILD-HR-FROM-PROFILE-01 (2026-10-23) — the input for rebuilding a plan from its stored answers.
//
// `meta.generator_input` is a snapshot of the answers on the day the plan was built. Heart rate moves after that:
// confirming a max in Profile writes `user_settings` and re-zones the plan (`applyHrToPlan`), and a device sync
// fills a missing value into `user_settings`. Neither touches `generator_input`, so every rebuild from it (Modify
// plan, the base-build handover, the regeneration scripts) quietly put the runner back on the old number. Measured:
// two plans reverted (a confirmed 143 bpm rebuilt to 178; 185 to 188) and two more one edit away.
//
// The profile is the heart-rate record, as the wizard already treats it and the device-sync write in
// `DashboardClient` says in as many words ("any re-generation uses the real Karvonen values"). So a rebuild takes
// heart rate from the profile and everything else from the stored answers. Pure: callers fetch the row.

import type { GeneratorInput } from '@/types/plan'

export interface ProfileHr {
  resting_hr?: number | null
  max_hr?: number | null
  max_hr_source?: GeneratorInput['max_hr_source'] | null
}

const real = (n: number | null | undefined): n is number => typeof n === 'number' && n > 0

/** The stored answers with the profile's heart rate laid over them. A missing or zero profile value keeps the stored
 *  one. A profile max brings its OWN source, never the stored one: carrying a stored `user_confirmed` onto a different
 *  number would tell §50's guard to trust a value nobody confirmed. */
export function withProfileHr(input: GeneratorInput, profile: ProfileHr | null | undefined): GeneratorInput {
  if (!profile) return input
  const next = { ...input }
  if (real(profile.resting_hr)) next.resting_hr = profile.resting_hr
  if (real(profile.max_hr)) {
    next.max_hr = profile.max_hr
    if (profile.max_hr_source) next.max_hr_source = profile.max_hr_source
    else delete next.max_hr_source
  }
  return next
}
