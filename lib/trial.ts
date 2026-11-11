import { isGrantActive } from '@/lib/charity/grantWindow'

const asDate = (v: string | Date | null | undefined): Date | null =>
  v == null ? null : v instanceof Date ? v : new Date(v)

export const TRIAL_DAYS = 14

/**
 * ACT-TRIAL-AT-FIRST-READ-01 — the ceiling on a trial whose clock has not started.
 * Thirty days from the trial stamp, whatever happens, so a runner who never gets a read does
 * not hold full access forever.
 */
export const TRIAL_MAX_DAYS_FROM_START = 30

/**
 * 🔴 OFF, AND IT STAYS OFF UNTIL THE FOUNDER SAYS OTHERWISE. This is a PRICING decision: it
 * changes when a runner is asked to pay. The founder directed the build on 2026-11-11 and has
 * not authorised enabling it.
 *
 * WHAT IT DOES. Today the 14 days run from `trial_started_at`, which is stamped on first
 * dashboard load. The plan often does not START for weeks, because a distant race defers it —
 * and a run can only be READ if it matches a planned session. 📐 Measured 2026-11-11: of 37
 * trialists, **24 (64.9%) had no trainable plan week inside their trial at all** (10 had no
 * plan; 14 of the 27 who did held only versions beginning after it ended, worst gap 242 days),
 * and **exactly 1 of 37 has ever had a run read during their trial.** The trial expires before
 * the product has had a chance to do the one thing it is for.
 *
 * ON, the 14 days begin at the FIRST RUN READ, capped at `TRIAL_MAX_DAYS_FROM_START` from the
 * stamp.
 *
 * ⚠️ IT CANNOT BE TURNED ON ALONE, AND THAT IS MECHANICAL, NOT A NOTE. The day-11 and day-14
 * emails count days from `trial_started_at`; with this ON and no read yet, "3 days left" would
 * be sent to a runner whose trial runs on to the cap. `trialWindowEmailInterlock.test.ts` fails
 * the build if this is `true` while those sends still key off the signup stamp. Items 4 and 5
 * of the activation brief are that wiring.
 */
export const TRIAL_STARTS_AT_FIRST_READ = false

export type UserTier = 'free' | 'trial' | 'paid'

const MS_PER_DAY = 24 * 60 * 60 * 1000

/** Which rule set the end of the trial. Not decoration: the copy differs for each. */
export type TrialBasis = 'none' | 'signup' | 'first_read' | 'cap'

export interface TrialWindowInputs {
  /** `user_settings.trial_started_at` — stamped on first dashboard load, not at signup. */
  trialStartedAt?: string | Date | null
  /**
   * The runner's FIRST live run read (`run_analysis`, `superseded_at IS NULL` — see
   * `lib/ops/runRead.ts`, the single owner of that definition).
   *
   * ⚠️ Read ONLY when `TRIAL_STARTS_AT_FIRST_READ` is on. Callers must not pay for a query
   * that the current policy ignores, which is why `getUserTier` fetches it conditionally.
   */
  firstReadAt?: string | Date | null
}

export interface TrialWindow {
  /** When the 14 days began counting; null when they have not started. */
  clockStartedAt: Date | null
  /** When access ends; null when there is no trial at all. */
  endsAt: Date | null
  active: boolean
  basis: TrialBasis
}

/**
 * THE SINGLE OWNER of "when does this runner's trial end". `isTrialActive` and `resolveTier`
 * both read it, so the flag cannot be honoured in one place and missed in another — the
 * TIER-OWNER-01 shape, applied to the clock rather than the order.
 */
export function trialWindow(i: TrialWindowInputs, now: Date = new Date()): TrialWindow {
  const started = asDate(i.trialStartedAt)
  if (!started) return { clockStartedAt: null, endsAt: null, active: false, basis: 'none' }

  if (!TRIAL_STARTS_AT_FIRST_READ) {
    const endsAt = new Date(started.getTime() + TRIAL_DAYS * MS_PER_DAY)
    return { clockStartedAt: started, endsAt, active: now < endsAt, basis: 'signup' }
  }

  const cap = new Date(started.getTime() + TRIAL_MAX_DAYS_FROM_START * MS_PER_DAY)
  const read = asDate(i.firstReadAt)
  if (!read) {
    // The clock has not started. Access runs to the cap, and `clockStartedAt` is null so a
    // caller cannot compute a "day N of 14" that does not exist yet.
    return { clockStartedAt: null, endsAt: cap, active: now < cap, basis: 'cap' }
  }

  // ⚠️ A read can never precede the stamp in practice (a read needs a plan, which needs the
  // app), but clamping costs nothing and an unclamped `min` would hand out a trial that ended
  // before it began.
  const clockStartedAt = read < started ? started : read
  const fromRead = new Date(clockStartedAt.getTime() + TRIAL_DAYS * MS_PER_DAY)
  const endsAt = fromRead < cap ? fromRead : cap
  return {
    clockStartedAt,
    endsAt,
    active: now < endsAt,
    basis: fromRead < cap ? 'first_read' : 'cap',
  }
}

/**
 * Pure — safe to call on client or server. `now` is injectable so `resolveTier` can be tested
 * against a fixed clock.
 *
 * ⚠️ The note that used to sit here said it was defaulted "so the ~30 existing
 * `isTrialActive(x)` call sites are unchanged". **There are none**: `resolveTier` below is its
 * only production caller, plus two test files. Corrected rather than deleted, because a stale
 * count is what makes the next person think a change here is wide when it is narrow.
 */
export function isTrialActive(
  trialStartedAt: string | Date | null | undefined,
  now: Date = new Date(),
  firstReadAt?: string | Date | null,
): boolean {
  return trialWindow({ trialStartedAt, firstReadAt }, now).active
}

/** WHY access resolved the way it did. The tier alone cannot answer "what do we
 *  say to this person when it ends?" — a lapsed 14-day trial and a lapsed
 *  charity grant both resolve to `free`, and telling a comped charity runner
 *  "14 days done" is wrong about something they would notice. */
export type TierReason = 'admin' | 'subscription' | 'grant' | 'trial' | 'none'

export interface TierInputs {
  isAdmin?: boolean | null
  /** `subscriptions.status` */
  subStatus?: string | null
  /** `subscriptions.current_period_end` */
  subPeriodEnd?: string | Date | null
  /** `charity_codes.expires_at` for the row claimed by this user */
  grantExpiresAt?: string | Date | null
  /** `user_settings.trial_started_at` */
  trialStartedAt?: string | Date | null
  /**
   * ACT-TRIAL-AT-FIRST-READ-01 — the runner's first live run read. Ignored entirely while
   * `TRIAL_STARTS_AT_FIRST_READ` is off, which is why it is optional: requiring it would make
   * every caller fetch a row the current policy does not read.
   */
  firstReadAt?: string | Date | null
}

export interface TierResolution {
  tier: UserTier
  reason: TierReason
}

/**
 * THE SINGLE OWNER of the tier resolution order: admin → active subscription →
 * charity grant → trial → free. Pure, so the server, the client mirror and the
 * tests all run the same rule.
 *
 * WHY THIS EXISTS. The order used to be written out in three places: here in
 * `getUserTier`, again as an OR-chain in `DashboardClient` (which cannot call a
 * service-role function), and a THIRD time as a private `resolve()` inside
 * `tierResolution.test.ts`. The test therefore asserted its own copy was
 * correct and could not catch either producer drifting — the same flaw
 * CLAUDE.md documents for `deloadCadence.test.ts`, where a checker sharing the
 * producer's predicate cannot catch the producer being wrong. D-16 (no parallel
 * semantics) had a comment warning about it and no mechanism enforcing it, and
 * the split was nearly shipped once already: the server order was changed and
 * the client mirror sat two commits behind, which would have made a comped
 * runner `paid` on the server and `free` in the UI.
 *
 * ORDER IS DELIBERATE, not incidental:
 *  - `is_admin` first, so support accounts work without a billing artefact.
 *  - Subscription ABOVE grant: a runner who later pays is resolved by their
 *    payment, so their tier does not flip the day an expiring gift lapses.
 *  - Grant ABOVE trial: the whole point of the feature. Below it, a comped
 *    charity runner would hit the marathon paywall on day 15.
 */
export function resolveTier(input: TierInputs, now: Date = new Date()): TierResolution {
  if (input.isAdmin) return { tier: 'paid', reason: 'admin' }

  const periodEnd = asDate(input.subPeriodEnd)
  if (
    input.subStatus &&
    ['trialing', 'active'].includes(input.subStatus) &&
    periodEnd && periodEnd > now
  ) {
    return { tier: 'paid', reason: 'subscription' }
  }

  if (isGrantActive(asDate(input.grantExpiresAt), now)) {
    return { tier: 'paid', reason: 'grant' }
  }

  if (isTrialActive(input.trialStartedAt, now, input.firstReadAt)) return { tier: 'trial', reason: 'trial' }

  return { tier: 'free', reason: 'none' }
}

// Server-only — uses service role to bypass RLS.
// Resolution order: admin → active subscription → charity grant → trial → free.
// `is_admin` accounts (owner / developer / support) always resolve as paid so
// the full server feature set — push registration, AI routes, Strava — is
// available without a billing artefact. See ADR-003 § Admin entitlement.
//
// GTM-CHARITY-04 — a redeemed charity code resolves as `paid`, and is read from
// `charity_codes` rather than written into `subscriptions`. Three reasons:
// `subscriptions.provider` has CHECK (provider IN ('revenuecat','stripe')) so a
// grant row would fail on insert; that table is upserted `onConflict: user_id`
// by the RevenueCat webhook, so a later RC event would silently overwrite a
// grant; and a comp is not a subscription, so conflating an entitlement with
// billing state is the two-writer class this codebase keeps getting bitten by.
// It sits BELOW an active subscription deliberately: a runner who later pays
// should be resolved by their payment, not by an expiring gift.
export async function getUserTier(userId: string): Promise<UserTier> {
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const [{ data: sub }, { data: settings }, { data: grant }] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('status, current_period_end')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('user_settings')
      .select('trial_started_at, is_admin')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('charity_codes')
      .select('expires_at')
      .eq('claimed_by', userId)
      .maybeSingle(),
  ])

  // ACT-TRIAL-AT-FIRST-READ-01 — A FOURTH READ, AND ONLY WHEN THE POLICY USES IT.
  //
  // `getUserTier` runs on a lot of routes, so a query the current policy ignores would be a
  // cost paid by everyone for a flag that is off. The condition is the flag itself, so the OFF
  // path is byte-for-byte what it was.
  //
  // ⚠️ The definition of a "read" is `lib/ops/runRead.ts`'s and not re-derived here:
  // `run_analysis` with `superseded_at IS NULL`. A superseded row belongs to a replaced plan
  // week, and starting someone's paid clock on a read they can no longer open would be the
  // worst possible place to get that wrong.
  let firstReadAt: string | null = null
  if (TRIAL_STARTS_AT_FIRST_READ) {
    const { data: read } = await supabase
      .from('run_analysis')
      .select('created_at')
      .eq('user_id', userId)
      .is('superseded_at', null)
      .order('created_at', { ascending: true })
      .limit(1)
    firstReadAt = (read?.[0]?.created_at as string | undefined) ?? null
  }

  // The ORDER lives in `resolveTier`, not here. This function's only job is to
  // fetch the four rows; deciding what they mean is the pure owner's.
  return resolveTier({
    isAdmin: settings?.is_admin,
    subStatus: sub?.status,
    subPeriodEnd: sub?.current_period_end,
    grantExpiresAt: grant?.expires_at,
    trialStartedAt: settings?.trial_started_at,
    firstReadAt,
  }).tier
}

// Convenience wrapper — kept for existing callers (strava/callback, claude route).
export async function hasPaidAccess(userId: string): Promise<boolean> {
  return (await getUserTier(userId)) !== 'free'
}
