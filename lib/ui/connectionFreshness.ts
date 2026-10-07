// HEALTH-SYNC-STALENESS-01 (Design Board, 2026-10-07) — a connection row reports
// ARRIVAL, not AUTHORISATION.
//
// ── WHAT WAS THERE ──────────────────────────────────────────────────────────
// `AppleHealthConnectionRow` rendered "Connected" in `--teal` whenever
// `user_settings.healthkit_connected_at` was set. That column is the timestamp
// of the moment the runner TAPPED CONNECT. It is a record of an intent, and
// nothing on the screen read whether a single run had ever arrived.
//
// ── THE MEASUREMENT THE BOARD RULED ON (production, service-role, 2026-10-07) ─
// 28 users had `healthkit_connected_at` set. THIRTEEN (46.4%) had never had one
// `strava_activities` row with `source='apple_health'`. One was the demo account;
// twelve were real, and FIVE of those tapped Connect 93, 102, 117, 118 and 123
// DAYS ago. Only 8 of 28 (28.6%) had anything from the last three days.
//
// So the row said "Connected", in a positive accent, to five real runners for
// three to four months while the thing it named had never once worked for them.
//
// ── 🔴 WHY NOT `getLastSyncIso()`, WHICH ALREADY EXISTED AND WAS INERT ───────
// 📱 Wroblewski: it reads localStorage, so it answers "this DEVICE" when the
// question is "this RUNNER". On a new phone it returns null for a runner who has
// synced happily for four months, and the row would then lie in the opposite
// direction. The filed item said it was inert and should therefore be wired.
// It is inert BECAUSE IT IS THE WRONG SOURCE. A true observation, the wrong
// conclusion. The activity list is already in memory in `DashboardClient`, is
// device-independent, and costs no new query.
//
// ── ⛔ THE TWO BINDING AMENDMENTS ────────────────────────────────────────────
// ✋ Silvanto: SILENCE WHEN FRESH. No sub-line, no second colour, no confirmation
// that we are doing our job. `ux-principles.md` "empty means calm, not broken",
// and a row that always carries a status line has taught the runner to skip it.
//
// 🎓 Sierra: STATE THE FACT, NEVER THE CAUSE. `@capgo/capacitor-health` resolves a
// DENIED read as an EMPTY RESULT rather than an error, so no code on the device
// can tell "permission off" from "has not run". "Nothing has synced yet" is a
// fact; "your permissions are off" would be a guess, and being wrongly accused of
// a settings error is worse than being told nothing. See `health_sync_swept`.
//
// Pattern: `ui-patterns.md` §17c, honest staleness, extended from the ME-ATHLETE
// card to connection rows. Its own standing rule is the one this closes:
// "Stale state must be rendered (silent staleness is the bug the card exists to fix)."

/**
 * How long a connected source may deliver nothing before the row says so.
 *
 * ⚠️ NOT in `GENERATION_CONFIG`, deliberately, and the file a numeric lives in is
 * part of the decision (`MAINT-PROFILE-01`). This governs a DISPLAY state and
 * nothing the engine prescribes: no coach would tune it, and putting it in the
 * coaching statute book would oblige a `CoachingPrinciples.md` section for a
 * sub-line. §17c's own threshold is a coaching numeric because VDOT's staleness
 * discount actually softens pace targets. This one changes a sentence.
 *
 * 14 and not 10: a fortnight absorbs a holiday, a taper or a bout of flu without
 * nagging a runner who is fine. Measured against the live cohort it fires for
 * 18 of 28 connected users (64.3%) — which is not a noisy threshold, it is the
 * feature being broken for two thirds of the people who switched it on.
 */
export const CONNECTION_STALE_DAYS = 14

export type ConnectionFreshness =
  /** Authorised, and something arrived inside the window. The row says nothing extra. */
  | 'fresh'
  /** Authorised, something arrived once, nothing since. */
  | 'stale'
  /** Authorised, and NOTHING has ever arrived. The five 93-day runners. */
  | 'never'
  /** Not authorised. The row's existing not-connected copy owns this. */
  | 'not_connected'

/**
 * @param connectedAt    `user_settings.healthkit_connected_at` (or the Strava equivalent)
 * @param lastActivityIso most recent activity START DATE for this source, server-side
 * @param now             injected so the gate is clock-independent
 */
export function connectionFreshness(
  connectedAt: string | null | undefined,
  lastActivityIso: string | null | undefined,
  now: Date = new Date(),
): ConnectionFreshness {
  if (!connectedAt) return 'not_connected'
  if (!lastActivityIso) return 'never'
  const ms = now.getTime() - new Date(lastActivityIso).getTime()
  if (Number.isNaN(ms)) return 'never'
  return ms > CONNECTION_STALE_DAYS * 86_400_000 ? 'stale' : 'fresh'
}

/** Whole days since `iso`, floored. Never negative: a future-dated run reads as today. */
export function daysSince(iso: string, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000))
}

/**
 * The sub-line, or `null` when the row should stay quiet.
 *
 * ⚠️ `null` FOR 'fresh' IS SILVANTO'S AMENDMENT, not an oversight. If this ever
 * returns a string for a working connection, the ruling has been reversed.
 *
 * ⚠️ NO EM DASH: sentences the runner reads (founder, 2026-09-22). Guarded by
 * `noEmDashApp.test.ts` for literals, and by this module's own test.
 */
export function connectionStaleCopy(
  freshness: ConnectionFreshness,
  lastActivityIso: string | null | undefined,
  sourceName: string,
  now: Date = new Date(),
): string | null {
  if (freshness === 'never') return `Nothing has synced yet. Worth checking ${sourceName}.`
  if (freshness !== 'stale') return null
  if (!lastActivityIso) return `Nothing has synced yet. Worth checking ${sourceName}.`
  const days = daysSince(lastActivityIso, now)
  return `Last run synced ${days} days ago.`
}

/**
 * The §17c state-dot / status colour. `--warn` is correct here and is NOT the
 * coaching-only use `StatusBadge`'s header warns about: that constraint is scoped
 * to a TIER badge, where any styled-up state becomes celebration. §17c rules
 * `--warn` for staleness explicitly, one document away. Both layers were checked
 * in the same pass, which is the trap this board records.
 */
export function connectionToneVar(freshness: ConnectionFreshness): string {
  switch (freshness) {
    case 'fresh':         return 'var(--moss)'
    case 'stale':
    case 'never':         return 'var(--warn)'
    case 'not_connected': return 'var(--text-muted)'
  }
}
