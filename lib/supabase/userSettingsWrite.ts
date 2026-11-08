import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * USER-SETTINGS-UNREAD-WRITE-01 (2026-11-08) — THE ONE OWNER OF "WRITE SOMETHING TO
 * `user_settings` FROM THE CLIENT, AND SAY SO WHEN IT FAILS".
 *
 * 🔴 WHY AN OWNER AND NOT ELEVEN FIXES. `DashboardClient.tsx` wrote to this table
 * **eighteen** times, each one a hand-written `supabase.from('user_settings').upsert(...)`,
 * and they agreed only by accident: seven read `{ error }`, eleven dropped it — some as
 * `void …`, some inside a bare `try {} catch {}`. That is the shape this repo has paid for
 * four times already (`TIER-OWNER-01` wrote the tier order three ways; `OPS-AI-OWNER-01`
 * found fourteen copies of one POST; `DELOAD-OWNER-01` five copies of one expression;
 * `SESSION-KM-01` six copies of one sum **and fourteen of an incompatible answer**).
 * Fixing eleven call sites leaves the nineteenth free to drop its error again.
 *
 * ⚠️ AND IT IS WHAT MAKES THE BEHAVIOUR TESTABLE AT ALL. `vitest.config.ts` is
 * `environment: 'node'` with no jsdom, so nothing inside `DashboardClient` is reachable by a
 * test — which is why eleven swallowed errors shipped green. A pure async function in `lib/`
 * is reachable, so the error policy gets real arms instead of a source assertion.
 * `SHEET-RAF-FALLBACK-01` is the recorded precedent: *a source assertion passes on a comment*.
 *
 * ── THE SEVERITY IS THE PER-SITE DECISION, AND IT IS THE WHOLE POINT ───────────────────
 * The item was deliberately held as debt because *"each needs its own answer to **what
 * should the runner see when this fails?**"*. That answer is now an ARGUMENT rather than
 * eleven copies of a try/catch, so it is visible at the call site and reviewable in a diff.
 *
 *   `tell_the_runner` — the runner ASKED for this and a SERVER surface will now disagree
 *                       with their screen. A lost write here is a wrong number later: push
 *                       notifications, trial emails and coach prompts can only read the
 *                       table, while the app reads React state. `PROFILE-NAME-WRITE-01` is
 *                       the measured case — 44 of 46 rows empty, the greeting correct on
 *                       screen the whole time.
 *   `log`             — optimistic state the runner did not ask to persist, or a dismissal
 *                       whose loss costs a re-prompt and not a wrong value.
 *
 * 🔻 WHAT THIS DOES NOT DO, stated because `/ship`'s silent-fallback gate asks for it: a
 * `log` failure is visible in the browser console and NOWHERE ELSE. `recordOpsEvent` is
 * server-only (service-role key) so it cannot be called from here — the wizard's onboarding
 * write proves the shape, posting to a bearer-authed `/api/ops/onboarding-event` instead.
 * A sustained-failure signal for settings writes needs that route generalised, which is
 * `USER-SETTINGS-WRITE-OBS-01`, not this item.
 */
/**
 * 🔴 THE USER LOOKUP IS `lib/analytics.ts → currentUserId`, AND I ALMOST SHIPPED A SECOND ONE.
 *
 * Removing the call sites' `try {} catch {}` un-guarded a network call, which is the worst
 * finding of this round because I caused it. Fourteen sites read
 * `const { data: { user } } = await supabase.auth.getUser()` immediately before the write, most
 * inside a bare catch, and I removed those blocks on the grounds that the owner handles the
 * write's failure — **the catch was guarding the LOOKUP as much as the write.**
 * `supabase.auth.getUser()` does a network call and can reject, and two callers have no catch:
 *   · `IdentityCard.commit()` awaits `onSaveName` with no catch, so a rejection leaves
 *     `committing.current = true` and `mode: 'saving'` **forever** — the field spins and never
 *     recovers.
 *   · `PushOnboardingScreen.skip()` is `try … finally` with NO catch, so `onSkip()` never runs
 *     and the runner is stranded on the onboarding screen.
 *
 * 🔴 THEN I WROTE A `currentUserId` HERE TO FIX IT, AND ONE ALREADY EXISTED — byte-for-byte,
 * in `lib/analytics.ts:243`, **already imported by `DashboardClient.tsx` on line 102.** `tsc`
 * caught it as a duplicate identifier; nothing else would have. ⚠️ **One import line away from
 * being the fifth instance of the defect this module was written to fix.** Reused, not
 * re-declared.
 *
 * ⚠️ ITS HOME IS WRONG AND IS DELIBERATELY NOT MOVED. A general "who is signed in, safely"
 * helper does not belong in `lib/analytics`; moving it touches every import for zero
 * behavioural gain, and `RATELIMIT-MODULE-PATH-01` is the recorded precedent for not bundling
 * a rename into a fix. Noted there, moved when something else touches that area.
 */

export type SettingsWriteSeverity = 'tell_the_runner' | 'log'

export interface SettingsWriteOptions {
  /** What this write is, for the log line. A noun phrase: 'heart rate', 'unit preference'. */
  what: string
  severity: SettingsWriteSeverity
  /**
   * Called with a runner-facing sentence when `severity` is `tell_the_runner` and the write
   * failed.
   *
   * 🔴 THIS DOCBLOCK CLAIMED IT WAS "REQUIRED BY THE TYPE (see the overloads below)" AND
   * THERE ARE NO OVERLOADS — code review, 2026-11-08. A `tell_the_runner` call that forgets it
   * compiles and degrades silently to `log`, which is exactly the hazard the sentence claimed to
   * have closed. **A docblock asserting a compiler guarantee that does not exist is worse than
   * no sentence**: it is the `A PLAUSIBLE NAME IS NOT A RUNNING CHECK` class, in prose.
   *
   * ⚠️ IT IS STILL OPTIONAL AND THE GATE IS A TEST, NOT THE TYPE. A discriminated union would
   * make it required and is the right shape — it is not done here because the one
   * `tell_the_runner` site in the tree is being re-sited in the same round and a union written
   * around a single moving caller is a guess. `userSettingsWrite.test.ts` asserts the degrade.
   */
  onError?: (message: string) => void
}

/** The sentence a runner sees. One string, so the voice is decided once (`brand.md`: honest,
 *  one sentence, never motivational) rather than eleven times. */
export function settingsWriteFailureMessage(what: string): string {
  return `Couldn't save your ${what}. It's still set on this device, not on your account.`
}

/**
 * Upsert a patch onto the runner's `user_settings` row, reading the error unconditionally.
 *
 * Returns `true` when the write landed. ⚠️ The boolean is the point for an optimistic
 * caller: it set React state before awaiting, and `false` is its cue to revert — which is
 * impossible to do when the error was never read.
 */
export async function writeUserSettings(
  supabase: SupabaseClient,
  userId: string,
  patch: Record<string, unknown>,
  opts: SettingsWriteOptions,
): Promise<boolean> {
  return run(
    () => supabase.from('user_settings').upsert({ id: userId, ...patch }),
    opts,
  )
}

/**
 * `update … .eq('id', userId)`, for the two sites that used it.
 *
 * ⚠️ IT IS NOT AN UPSERT AND THAT IS DELIBERATE. `update` no-ops when the row is absent;
 * `upsert` CREATES it. Collapsing the two verbs would have been tidier and would have
 * changed behaviour for a runner with no settings row — `timezone` and `birth_year` are
 * written from paths that assume the row exists, and "assume" is not "verified". The owner
 * owns the ERROR POLICY, not the columns and not the verb.
 */
export async function updateUserSettings(
  supabase: SupabaseClient,
  userId: string,
  patch: Record<string, unknown>,
  opts: SettingsWriteOptions,
): Promise<boolean> {
  return run(
    () => supabase.from('user_settings').update(patch).eq('id', userId),
    opts,
  )
}

async function run(
  write: () => PromiseLike<{ error: { message: string } | null }>,
  { what, severity, onError }: SettingsWriteOptions,
): Promise<boolean> {
  let message: string | null = null
  try {
    const { error } = await write()
    if (error) message = error.message
  } catch (e) {
    // A thrown transport error and a returned `{ error }` are the SAME failure to the
    // runner, and supabase-js does both. The eleven swallowed sites split roughly evenly
    // between the two spellings, which is exactly why the register that found them had to be
    // scoped to the EFFECT rather than to `void` — one spelling of "nobody reads the result".
    message = e instanceof Error ? e.message : String(e)
  }
  if (message === null) return true
  console.error(`[user_settings] ${what} write failed:`, message)
  if (severity === 'tell_the_runner') onError?.(settingsWriteFailureMessage(what))
  return false
}
