// GTM-CHARITY-04 — code format and normalisation.
//
// A runner types this off a charity's email, possibly on a phone, possibly
// having written it on their hand. Every avoidable rejection here is a person
// who was promised free access and did not get it, so the parser is forgiving
// about presentation and strict about identity.

/** Characters the code is minted from.
 *
 *  Crockford-style: no I, L, O, U, 0 or 1. Removes the classic misreads (O/0,
 *  I/1/l) before they happen rather than trying to be clever about them at
 *  parse time, and drops U so the generator cannot emit an unfortunate word. */
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ'

/** Code shape: PREFIX-XXXX-XXXX. The prefix makes it obvious what the string is
 *  when it turns up in a support email or a screenshot. */
export const CODE_PREFIX = 'ZONNA'
const GROUP_LEN = 4
const GROUPS = 2

/** 30^8 ≈ 6.6e11. With batches in the hundreds, guessing a live code is not a
 *  realistic attack; the redeem route is authenticated AND rate-limited
 *  (`CHARITY_REDEEM_LIMIT`, wired 2026-09-24).
 *
 *  🔴 THIS SENTENCE CLAIMED A CONTROL THAT DID NOT EXIST (CHARITY-REDEEM-RATELIMIT-01).
 *  Until 2026-09-24 it read "the redeem route is also rate-limited and
 *  authenticated" — authenticated was true, rate-limited was FALSE: nothing in
 *  the route, nothing in `middleware.ts`, and `AI_ROUTE_LIMITS` covers AI
 *  surfaces only and never named charity. Found while writing the route's
 *  contract. The sentence was the stated reason the codespace is considered
 *  sufficient, so it was load-bearing. **A claim in a comment is not a
 *  mechanism** — the fix was to build the mechanism, not soften the claim. */
export function mintCode(random: () => number = Math.random): string {
  let body = ''
  for (let g = 0; g < GROUPS; g++) {
    if (g > 0) body += '-'
    for (let i = 0; i < GROUP_LEN; i++) {
      body += ALPHABET[Math.floor(random() * ALPHABET.length)]
    }
  }
  return `${CODE_PREFIX}-${body}`
}

/**
 * Normalise user input to the stored form.
 *
 * Stored codes are uppercase with no separators, so a lookup is a single exact
 * match rather than a LIKE or a scan. Accepts the code however the runner types
 * it: lowercase, spaced, hyphenated, with or without the prefix, with stray
 * whitespace from a copy-paste.
 *
 * Returns null when nothing usable remains, so the caller can reject empty
 * input without a second check.
 */
export function normaliseCode(input: string | null | undefined): string | null {
  if (!input) return null
  const stripped = input.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (!stripped) return null
  // A runner may or may not include the prefix. Store and compare WITHOUT it so
  // both forms resolve to the same row.
  const body = stripped.startsWith(CODE_PREFIX) ? stripped.slice(CODE_PREFIX.length) : stripped
  return body.length ? body : null
}

/**
 * Format what the runner is typing, live, as they type it.
 *
 * UX-REDEEM-01 (2026-09-11). The input's placeholder read `ZONNA-XXXX-XXXX`, so
 * a runner typed the prefix and counted out the hyphens — work `normaliseCode`
 * has never required. The founder did exactly that on a real device and reported
 * it as bad UI, which it was: a box that IMPLIES a strict format the parser does
 * not want makes people feel they got a gift wrong.
 *
 * This is the same normalisation rules, run forwards: strip everything that is
 * not a code character, drop a prefix the runner typed themselves, and group
 * what is left. Paste `zonna x7k2 9mqf`, hold a phone keyboard down, or type it
 * bare — it lands the same way.
 *
 * Shares `normaliseCode` deliberately rather than re-deriving the rules, so the
 * box can never disagree with the parser about what a code is.
 */
export function formatCodeInput(raw: string): string {
  const body = normaliseCode(raw)
  if (!body) return ''
  const trimmed = body.slice(0, GROUP_LEN * GROUPS)
  return (trimmed.match(/.{1,4}/g) ?? []).join('-')
}

/** How many code characters a complete code carries, prefix excluded. Exported
 *  so the input can size itself and enable its button from one source. */
export const CODE_BODY_LENGTH = GROUP_LEN * GROUPS

/** The display form, for showing a code back to an admin after minting. */
export function formatCode(normalised: string): string {
  const groups = normalised.match(/.{1,4}/g) ?? [normalised]
  return `${CODE_PREFIX}-${groups.join('-')}`
}

/** CHARITY-REDEEM-RATELIMIT-01 — per-user cap on redemption attempts.
 *
 *  Redeeming is a ONCE-PER-ACCOUNT action, so ten attempts an hour is far more
 *  than a runner mistyping a code off a charity's email needs, and far less than
 *  anything useful against a 30^8 codespace.
 *
 *  ⚠️ DEFENCE IN DEPTH, NOT THE PRIMARY CONTROL. The primary controls are auth
 *  and the codespace; this exists so the justification above is true. It FAILS
 *  OPEN for the same reason the AI limiter does, and the trade is sharper here:
 *  a false denial blocks a runner redeeming a gift they were promised, which is
 *  worse than the thing being prevented. */
export const CHARITY_REDEEM_LIMIT = 10
export const CHARITY_REDEEM_WINDOW_SECONDS = 3600
