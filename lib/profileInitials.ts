/**
 * Avatar initials — the single owner of "what two letters go in the circle".
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
  const fromName = `${input.firstName?.trim()[0] ?? ''}${input.lastName?.trim()[0] ?? ''}`
    .toUpperCase()
    .slice(0, 2)
  if (fromName) return fromName

  const fromPlan = (input.planAthlete ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
  if (fromPlan) return fromPlan

  return input.email?.trim()[0]?.toUpperCase() || '?'
}
