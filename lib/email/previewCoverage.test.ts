/**
 * The preview sends EVERY email, in EVERY state.
 *
 * 🔴 WHY THIS IS A TEST AND NOT A CONVENTION. The preview route is how a human
 * decides the emails are right. **If it silently stops covering an email, the
 * approval is of a smaller programme than the one that ships** — and nothing else
 * would notice, because the route returns a success either way.
 *
 * ⚠️ The empty variants are the point. **22 of 30 real recipients hit one.** A
 * preview showing only the happy path is precisely how the empty day-11 shipped
 * and went unnoticed until it was measured.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const ROUTE = readFileSync('app/api/email/preview/route.ts', 'utf8')
const TEMPLATES = readFileSync('lib/email/trialEmailTemplates.ts', 'utf8')

/** Every exported email builder. Read from the source so a NEW email cannot be
 *  added without this test noticing it is unpreviewed. */
function builders(): string[] {
  const out: string[] = []
  const re = /export function (build\w*Email)\(/g
  let m: RegExpExecArray | null
  while ((m = re.exec(TEMPLATES)) !== null) out.push(m[1]!)
  return out
}

describe('the preview route covers the whole programme', () => {
  it('there are builders to cover — the check is not vacuous', () => {
    expect(builders().length).toBeGreaterThanOrEqual(4)
  })

  it('every email builder is invoked by the preview route', () => {
    const missing = builders().filter(b => !ROUTE.includes(`${b}(`))
    expect(missing, `the preview never sends: ${missing.join(', ')}`).toEqual([])
  })

  it('the EMPTY state is previewed FOR EACH email that has one', () => {
    // 🔴 THE FIRST VERSION OF THIS WAS HOLLOW. It asserted `ROUTE.toContain('RUN_NONE')`,
    // which stays true while the fixture appears ANYWHERE — so removing it from
    // the day-14 preview left this green. Substring bias: "bound the region,
    // never grep the file", recorded in this repo three times before today.
    //
    // Bound to the CALL: each trial email must be invoked with the empty fixture.
    for (const builder of ['buildDay11Email', 'buildDay14Email']) {
      const withNone = new RegExp(`${builder}\\([^)]*RUN_NONE`)
      expect(withNone.test(ROUTE), `${builder} is never previewed in its EMPTY state`).toBe(true)
    }
    // The case §12 Am.2 exists for, bound the same way.
    expect(/buildDay11Email\([^)]*RUN_HOT/.test(ROUTE), 'the above-ceiling case is not previewed').toBe(true)
    // The runner with no heart rate at all (ADR-011 §5).
    expect(/buildFirstReadEmail\([^)]*RUN_NO_HR/.test(ROUTE), 'the no-HR case is not previewed').toBe(true)
  })

  it('it sends through the OWNER, never the transport', () => {
    // A preview that bypassed suppression could mail an admin who unsubscribed,
    // and would leave no record. A preview is a real email.
    expect(ROUTE).toMatch(/\bsendToUser\b/)
    expect(ROUTE).not.toMatch(/\bsendEmail\s*\(/)
  })

  it('there is NO arbitrary recipient — the address comes from the account', () => {
    // A route taking `to` plus a shared secret is an open relay with our
    // return-path on it.
    expect(ROUTE).not.toMatch(/searchParams\.get\(['"]to['"]\)/)
    expect(ROUTE).toMatch(/\buser\.email\b/)
  })

  it('it is admin-gated, not merely authenticated', () => {
    expect(ROUTE).toMatch(/\bis_admin\b/)
    expect(ROUTE).toMatch(/status:\s*403/)
  })
})
