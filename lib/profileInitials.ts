/**
 * Avatar initials — the single owner of "what letter goes in the circle".
 *
 * 🔴 ONE LETTER, FROM EVERY SOURCE (PROFILE-IDENTITY-01, Design Board 2026-09-28).
 * It used to be up to two, and that was measurably INCONSISTENT once last name left the
 * profile: a runner with a saved first name would get "R" while the `planAthlete`
 * fallback still split a full name into "RS". **The circle changed shape depending on
 * where the name happened to come from**, which nobody would ever see as a bug and
 * everybody would see as sloppiness.
 *
 * Best source first: the saved profile name, then the name stamped on the plan,
 * then the account's own email.
 *
 * WHY THE EMAIL TAIL IS NOT DECORATION. Every earlier source can legitimately be
 * empty. A password signup captured no name at all until PROFILE-NAME-01, and
 * `plan.meta.athlete` is `input.athlete_name ?? ''` (ruleEngine), so it is an
 * EMPTY STRING rather than absent — `?? '?'` therefore never fired. The old
 * chain then ran `''.split(' ')`, which is `['']`, took `[0][0]` (undefined),
 * joined to `''`, and drew a blank moss circle. Exactly this repo's dangerous
 * failure class: no crash, no log, just a silently wrong render.
 *
 * Everyone who can see this circle is signed in, so `email` cannot be empty in
 * practice — but the `'?'` tail stays, because "in practice" is what the
 * previous version assumed too.
 */
export function profileInitials(input: {
  firstName?: string | null
  lastName?: string | null
  /** `plan.meta.athlete` — a full name, or an empty string. */
  planAthlete?: string | null
  email?: string | null
}): string {
  // `lastName` is still accepted and deliberately unused: Sign in with Apple hands us a
  // surname on the very first authorization and never again, so we keep STORING it while
  // no longer asking for it or showing it. Removing the parameter would invite a caller
  // to stop passing what Apple gave us.
  const fromName = (input.firstName?.trim()[0] ?? '').toUpperCase()
  if (fromName) return fromName

  const fromPlan = ((input.planAthlete ?? '').trim()[0] ?? '').toUpperCase()
  if (fromPlan) return fromPlan

  return input.email?.trim()[0]?.toUpperCase() || '?'
}
