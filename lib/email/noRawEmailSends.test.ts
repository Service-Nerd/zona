/**
 * EMAIL-WAVE-0 — `sendEmail` is reachable from exactly one place.
 *
 * 🔴 WHY. `sendEmail` is the transport: it posts an address and some HTML to
 * Resend. It knows nothing about consent and records nothing. It was called
 * directly from a route, and that is how **35 emails went out with no
 * unsubscribe path and no record that they existed** — the finding that made
 * this wave tranche 0 (SLT, 2026-09-24).
 *
 * `sendToUser` is the owner: it reads suppression, builds the `List-Unsubscribe`
 * header, sends, and records every outcome including the ones it declines.
 * **A second caller of `sendEmail` is a second email programme with none of that.**
 *
 * Same shape and the same reason as `noRawAnthropicCalls.test.ts`, which exists
 * because fourteen hand-written copies of one POST agreed only by accident.
 */
import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'

const OWNER = 'lib/email/sendToUser.ts'
const TRANSPORT = 'lib/email/resend.ts'

function callers(): string[] {
  // ⚠️ WORD BOUNDARY, NOT A SUBSTRING. The first cut grepped for `sendEmail` and
  // flagged `app/auth/reset/page.tsx`, which contains a React state variable
  // called `resendEmail`. That is substring bias — the class this repo has
  // recorded three times ("bound the region, never grep the file"), caught here
  // by running the check across the repo before trusting it.
  //
  // Matching a CALL or an IMPORT specifically, so a variable whose name merely
  // ends in the identifier cannot trip it, and a real caller cannot hide.
  const out = execSync(
    `grep -rlnE "(\\bsendEmail\\s*\\(|from '[^']*email/resend')" lib app components scripts 2>/dev/null || true`,
  ).toString().split('\n').filter(Boolean)
  return out.filter(f => f !== OWNER && f !== TRANSPORT && !f.endsWith('.test.ts'))
}

describe('nothing sends email except the owner', () => {
  it('sendEmail has exactly one caller, and it is sendToUser', () => {
    expect(callers(), 'files calling sendEmail outside lib/email/sendToUser.ts').toEqual([])
  })

  it('the owner really does call the transport — the check is not vacuous', () => {
    // ⚠️ Without this, deleting the send entirely would leave the test above
    // green: zero callers and zero sends both satisfy "no raw callers".
    const owner = execSync(`grep -c "sendEmail(" ${OWNER}`).toString().trim()
    expect(Number(owner)).toBeGreaterThan(0)
  })
})
