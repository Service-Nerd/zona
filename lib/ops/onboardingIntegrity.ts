// ONBOARD-OBS-01 — the pure decision behind the onboarding-integrity probe.
//
// The broken state is a runner who has a saved plan (a `plans` row) but whose
// `user_settings.has_onboarded` is still false — the finalise write that should
// have followed the plan save never landed. Observing the state directly (like
// reshape-integrity) catches it wherever the write failed, and needs no content
// diff. Kept pure so it is unit-tested rather than proven by a live cron.

export interface OnboardingSettingsRow {
  id: string
  has_onboarded: boolean | null
}

/**
 * User ids that hold a saved plan but are not marked onboarded.
 *
 * A missing settings row is treated as NOT onboarded (the flag defaults false),
 * so a user with a plan and no settings row at all is still flagged — that is
 * the same leak, not a healthy state.
 */
export function incompleteOnboardingUserIds(
  planUserIds: readonly string[],
  settings: OnboardingSettingsRow[],
): string[] {
  const onboarded = new Set<string>()
  for (const s of settings) {
    if (s.has_onboarded === true) onboarded.add(s.id)
  }
  const seen = new Set<string>()
  const out: string[] = []
  for (const uid of planUserIds) {
    if (onboarded.has(uid)) continue
    if (seen.has(uid)) continue   // a user has at most one plan, but stay idempotent
    seen.add(uid)
    out.push(uid)
  }
  return out
}
