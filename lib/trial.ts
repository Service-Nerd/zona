import { isGrantActive } from '@/lib/charity/grantWindow'

const asDate = (v: string | Date | null | undefined): Date | null =>
  v == null ? null : v instanceof Date ? v : new Date(v)

export const TRIAL_DAYS = 14

/**
 * ACT-TRIAL-AT-FIRST-READ-01 — the ceiling on a trial whose clock has not started.
 * **Twenty-one days** from the trial stamp, whatever happens, so a runner who never gets a read
 * does not hold full access forever.
 *
 * 👤 **FOUNDER DECISION, 2026-11-12: 30 → 21.** *"make it 21 days"*, asked after the trade was
 * put to him: with the flag ON, a runner who connects nothing and logs nothing gets the cap
 * instead of `TRIAL_DAYS`, and **33 of 37 trialists have never had a single run read.**
 *
 * ⚠️ **THE CAP IS NOT ONLY A CEILING ON THE NEVER-READ — IT TRUNCATES A LATE STARTER'S 14 DAYS,
 * AND THAT IS THE HALF THAT IS EASY TO MISS.** `endsAt = min(firstRead + TRIAL_DAYS, cap)`, so at
 * 21 anyone whose first read lands after **day 7** gets fewer than 14 days. 📐 Measured
 * 2026-11-12 on the only 4 trialists who have ever had a read: first reads land on days **6.1,
 * and three later, out to 40.2** — so **3 of those 4 would be truncated at 21, against 2 of 4 at
 * 30.** ⚠️ n = 4. That is a direction, not a rate, and it is stated rather than smoothed.
 *
 * ⚠️ **INERT UNTIL THE FLAG FLIPS.** `resolveTrialWindow` returns on the signup path before this
 * constant is read, so changing it moves nothing for anyone today. It is the value that will
 * apply on the day `TRIAL_STARTS_AT_FIRST_READ` becomes true.
 */
export const TRIAL_MAX_DAYS_FROM_START = 21

/**
 * ACT-EMAIL-DAY14-01 — the extra days offered at day 14 to a runner we never managed to read a
 * run for. One-time, and granted only when they click it.
 *
 * 📐 13 of 16 day-14 emails said "Fourteen days, no runs read." A trial in which the product
 * never did its one trick is not a trial they can decide on, and the measured reason is usually
 * ours: of 37 trialists, 24 had no trainable plan week inside the window at all.
 *
 * ⚠️ This DOES apply with `TRIAL_STARTS_AT_FIRST_READ` off, which is deliberate and is the
 * whole point of item 4 — but it changes nothing for anyone until they accept it, because the
 * stamp is null until `/api/email/extend-trial` writes it.
 */
export const TRIAL_EXTENSION_DAYS = 7

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
 * 🔴 IT CANNOT BE TURNED ON ALONE, AND THE INTERLOCK IS DERIVED, NOT LISTED. `lib/trialWindow.test.ts`
 * greps `app/` and `lib/` for every consumer that still computes the trial from
 * `trial_started_at` — the day-11/14 emails, the trial-insight push, the in-app countdown — and
 * for every `resolveTier` caller that does not pass `firstReadAt`, and it fails the build while
 * this is `true` and ANY of them remain. ⚠️ The first version of that interlock watched ONE FILE
 * and the commit message called it mechanical; code review found **three more signup-relative
 * consumers and two unwired callers**. A guard over a hand-written list is a guard over the part
 * you remembered. Items 4 and 5 of the activation brief are the email half of that wiring.
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
   * The runner's EARLIEST run read, superseded rows INCLUDED.
   *
   * 🔴 DELIBERATELY NOT `lib/ops/runRead.ts`'s live-rows-only definition, and the first cut got
   * this wrong in the most dangerous direction available. A race change supersedes every
   * `run_analysis` row the runner has, so a clock keyed to live rows **moves later** — and
   * between day 15 and day 30 an already-expired trial would come back. The question here is
   * not "how many reads can they open today" (which is what the emails count) but **"has this
   * runner ever been shown what the product does"**, and that cannot un-happen.
   *
   * ⚠️ Read ONLY when `TRIAL_STARTS_AT_FIRST_READ` is on. Callers must not pay for a query that
   * the current policy ignores, which is why `getUserTier` fetches it conditionally.
   */
  firstReadAt?: string | Date | null
  /**
   * ACT-EMAIL-DAY14-01 — `user_settings.trial_extended_at`, set once when the runner accepts
   * the seven extra days offered at day 14. Null for everyone until they click, so this changes
   * nothing retroactively.
   */
  trialExtendedAt?: string | Date | null
  /**
   * True when the first-read query FAILED, as distinct from returning nothing.
   *
   * 🔴 ON A FAILURE THE WINDOW IS THE CAP, AND THE FIRST TWO ATTEMPTS AT THIS WERE BOTH WRONG.
   * Swallowing the error as "no read" was wrong because the caller could not tell the two
   * apart. Falling back to the SIGNUP window was wrong in the more dangerous direction: a
   * runner who read on day 2 has a window to day 16, so a failed query on day 15 would have
   * resolved them `free` and **revoked access they were entitled to**, mid-trial, because of
   * our outage.
   *
   * The cap is the answer: it is the maximum this policy ever grants, it is bounded at 30 days,
   * and it cannot revoke anyone. The cost of being wrong is at most a fortnight of access to
   * someone who had not earned it; the cost the other way is taking the product off a runner
   * who had. `/api/health/ingest`'s free-tier ruling settles that trade in this repo already:
   * when one side is undoable and the other is cheap, you do not need a conversion model.
   */
  firstReadUnavailable?: boolean
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
export function resolveTrialWindow(
  i: TrialWindowInputs,
  now: Date = new Date(),
  /**
   * ⚠️ INJECTED, with the constant as its default, so the ON path is testable against THIS
   * function. The first version asserted the ON arithmetic against a copy written inside the
   * test, and inverting the cap comparison here left the suite green — a checker sharing the
   * producer's predicate cannot catch the producer being wrong (the `deloadCadence` lesson).
   * Production never passes it.
   */
  startsAtFirstRead: boolean = TRIAL_STARTS_AT_FIRST_READ,
): TrialWindow {
  const started = asDate(i.trialStartedAt)
  if (!started) return { clockStartedAt: null, endsAt: null, active: false, basis: 'none' }

  /**
   * The accepted extension, applied to whatever window the policy produces.
   *
   * ⚠️ ADDED AT THE END, NOT FOLDED INTO EACH BRANCH. Every branch below returns a window, and
   * a seven-day grant that only some of them honoured would be the kind of difference nobody
   * notices until a runner is cut off three branches down. It also means the extension stacks
   * on the CAP rather than being swallowed by it: a runner who took the offer and then had a
   * read on day 25 gets day 37, not day 30, which is what "another seven days" said.
   */
  const extended = asDate(i.trialExtendedAt)
  const grant = (w: TrialWindow): TrialWindow => {
    if (!extended || !w.endsAt) return w
    // 🔴 SEVEN DAYS FROM THE CLICK, NOT FROM THE ORIGINAL END. The first cut added the days to
    // `w.endsAt`, so accepting on day 15 gave 7, day 18 gave 4, day 21 gave 1 and day 23 gave
    // **nothing** — while the landing page said "7 more days." and the ops event recorded
    // `granted`. The day-17 email carries the same link right through day 29, so on the first
    // deploy every lapsed trialist in that range could have clicked it and had nothing unlock.
    // ⚠️ `max`, not a plain `extendedAt + 7`: a runner who accepts on day 10 keeps the longer of
    // the two windows rather than having their trial shortened by taking an offer.
    const from = w.endsAt > extended ? w.endsAt : extended
    const endsAt = new Date(from.getTime() + TRIAL_EXTENSION_DAYS * MS_PER_DAY)
    return { ...w, endsAt, active: now < endsAt }
  }

  if (!startsAtFirstRead) {
    const endsAt = new Date(started.getTime() + TRIAL_DAYS * MS_PER_DAY)
    return grant({ clockStartedAt: started, endsAt, active: now < endsAt, basis: 'signup' })
  }

  const cap = new Date(started.getTime() + TRIAL_MAX_DAYS_FROM_START * MS_PER_DAY)
  // See `firstReadUnavailable` above: the cap never revokes, and it is bounded.
  if (i.firstReadUnavailable) {
    return grant({ clockStartedAt: null, endsAt: cap, active: now < cap, basis: 'cap' })
  }
  const read = asDate(i.firstReadAt)
  if (!read) {
    // The clock has not started. Access runs to the cap, and `clockStartedAt` is null so a
    // caller cannot compute a "day N of 14" that does not exist yet.
    return grant({ clockStartedAt: null, endsAt: cap, active: now < cap, basis: 'cap' })
  }

  // ⚠️ A read can never precede the stamp in practice (a read needs a plan, which needs the
  // app), but clamping costs nothing and an unclamped `min` would hand out a trial that ended
  // before it began.
  const clockStartedAt = read < started ? started : read
  const fromRead = new Date(clockStartedAt.getTime() + TRIAL_DAYS * MS_PER_DAY)
  const endsAt = fromRead < cap ? fromRead : cap
  return grant({
    clockStartedAt,
    endsAt,
    active: now < endsAt,
    basis: fromRead < cap ? 'first_read' : 'cap',
  })
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
  firstReadUnavailable?: boolean,
  trialExtendedAt?: string | Date | null,
): boolean {
  return resolveTrialWindow(
    { trialStartedAt, firstReadAt, firstReadUnavailable, trialExtendedAt }, now).active
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
   * ACT-TRIAL-AT-FIRST-READ-01 — the runner's EARLIEST run read, superseded rows included.
   * Ignored entirely while `TRIAL_STARTS_AT_FIRST_READ` is off, which is why it is optional:
   * requiring it would make every caller fetch a row the current policy does not read.
   * ⚠️ `lib/trialWindow.test.ts` fails the build if the flag is on and any `resolveTier` caller
   * is still not passing it.
   */
  firstReadAt?: string | Date | null
  /** True when that query FAILED. Resolves to the cap; never revokes. */
  firstReadUnavailable?: boolean
  /** `user_settings.trial_extended_at` — set once, when the runner accepts the day-14 offer. */
  trialExtendedAt?: string | Date | null
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

  if (isTrialActive(input.trialStartedAt, now, input.firstReadAt, input.firstReadUnavailable,
                    input.trialExtendedAt))
    return { tier: 'trial', reason: 'trial' }

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
  // The ORDER lives in `resolveTier`, not here. This function's only job is to
  // fetch the rows; deciding what they mean is the pure owner's.
  const base = {
    isAdmin: settings?.is_admin,
    subStatus: sub?.status,
    subPeriodEnd: sub?.current_period_end,
    grantExpiresAt: grant?.expires_at,
    trialStartedAt: settings?.trial_started_at,
  }
  const first = resolveTier(base)

  // ACT-TRIAL-AT-FIRST-READ-01 — A FOURTH QUERY, AND ONLY FOR THE ONE RUNNER IT CAN CHANGE.
  //
  // ⚠️ The first cut ran it alongside the other three for EVERYONE, including every admin,
  // subscriber and charity-grant holder — all of whom `resolveTier` answers before it ever
  // looks at the trial. `getUserTier` runs on a lot of routes, so that was a serialised round
  // trip bought for nothing. Resolving first and asking only when the answer could still move
  // keeps the cost on the cohort the policy is about.
  // 🔴 THE TRIAL-ONLY READS ARE A SEPARATE, FAILURE-TOLERANT QUERY, AND THAT IS NOT TIDINESS.
  // `trial_extended_at` is created by `20261111e`, which production DDL rules say is applied by
  // hand. Naming it in the select above would mean that on any deploy before the apply, the
  // whole `user_settings` read fails — so `settings` is null, **every trialist resolves `free`
  // and every admin loses admin on every route that calls this.** An outage, bought for a
  // column that matters to one cohort. Split out, a missing column costs exactly what it should:
  // nobody's accepted extension is honoured until the migration lands, and nothing else moves.
  //
  // ⚠️ Only for the cohort it can change. An admin, subscriber or grant holder is answered
  // before the trial is ever considered, so they never pay for this round trip.
  if (first.reason !== 'trial' && first.reason !== 'none') return first.tier

  const { data: ext, error: extErr } = await supabase
    .from('user_settings')
    .select('trial_extended_at')
    .eq('id', userId)
    .maybeSingle()
  if (extErr) console.error('[lib/trial.ts] trial_extended_at read failed:', extErr.message)
  const withExtension = { ...base, trialExtendedAt: extErr ? null : ext?.trial_extended_at }

  if (!TRIAL_STARTS_AT_FIRST_READ) return resolveTier(withExtension).tier

  // 🔴 SUPERSEDED ROWS INCLUDED, THE OPPOSITE OF `lib/ops/runRead.ts`'S RULE, ON PURPOSE. A race
  // change supersedes every `run_analysis` row, so a clock keyed to live rows moves LATER and an
  // expired trial would come back between day 15 and day 30. The emails count what a runner can
  // open; this answers whether they have ever been shown what the product does.
  //
  // ⚠️ THE ERROR IS CARRIED, NOT SWALLOWED — see `firstReadUnavailable`, which resolves to the
  // cap rather than revoking an entitled runner on our own outage.
  const { data: read, error: readErr } = await supabase
    .from('run_analysis')
    .select('created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
  if (readErr) console.error('[lib/trial.ts] first-read query failed:', readErr.message)

  return resolveTier({
    ...withExtension,
    firstReadAt: readErr ? null : ((read?.[0]?.created_at as string | undefined) ?? null),
    firstReadUnavailable: !!readErr,
  }).tier
}

// Convenience wrapper — kept for existing callers (strava/callback, claude route).
export async function hasPaidAccess(userId: string): Promise<boolean> {
  return (await getUserTier(userId)) !== 'free'
}
