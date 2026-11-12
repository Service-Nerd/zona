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
/** The CONTACT SHEET. See the arm at the bottom for why it is a second population. */
const RENDERER = readFileSync('scripts/render-emails.ts', 'utf8')

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
    // ⚠️ `buildDay30Email` is absent BY SIGNATURE, not by omission: it takes no `RunSummary`,
    // because it asks one question and shows no data. An email with no data has no empty state,
    // and listing it here would be a check that can only ever be satisfied by a fake argument.
    for (const builder of ['buildDay11Email', 'buildDay14Email', 'buildDay17Email']) {
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

/**
 * 🔴 THE ROUTE IS NOT THE ONLY PREVIEW, AND THIS ARM EXISTS BECAUSE THE OTHER ONE WENT STALE.
 *
 * Every arm above reads `app/api/email/preview/route.ts`. `scripts/render-emails.ts` writes the
 * CONTACT SHEET — the artefact a human actually opens, and the one that gets sent to the founder
 * when he asks to see the words. Measured 2026-11-12: the route covered all six builders and the
 * sheet covered **four**, so day 17 and day 30 had been shipped, previewed in the route, and were
 * invisible on the page anyone looks at. Its own header still said *"eight states across five
 * emails"*.
 *
 * ⚠️ **This is the guard-narrower-than-its-claim class, in the check written to prevent it.**
 * The file's docstring claims the preview covers "EVERY email, in EVERY state"; its POPULATION was
 * one of the two previews. Same shape as `verify-cap-config`'s two-name population and the
 * em-dash guard that saw string literals but not JSX text.
 */
describe('the contact sheet covers the whole programme too', () => {
  it('every email builder is rendered to the sheet', () => {
    const missing = builders().filter(b => !RENDERER.includes(`${b}(`))
    expect(missing, `render-emails.ts never renders: ${missing.join(', ')}`).toEqual([])
  })

  it('and the EMPTY state is on the sheet for each email that has one', () => {
    // Bound to the call, not grepped file-wide — the hollow shape this file already records.
    for (const builder of ['buildDay11Email', 'buildDay14Email', 'buildDay17Email']) {
      const withNone = new RegExp(`${builder}\\([^)]*RUN_NONE`)
      expect(withNone.test(RENDERER), `${builder}'s EMPTY state is not on the contact sheet`).toBe(true)
    }
  })

  it('the sheet states how many cases it holds, and the number is true', () => {
    // 🔴 THE STALE NUMBER IS THE DEFECT, so the number itself is what the gate reads.
    // `cases` is a `const` array literal; count its top-level entries by their `['` openers.
    const block = RENDERER.slice(RENDERER.indexOf('const cases = ['))
    const list = block.slice(0, block.indexOf('] as const'))
    const count = (list.match(/^\s{2}\['/gm) ?? []).length
    expect(count, 'the cases list could not be parsed — unverified is not a pass').toBeGreaterThan(4)

    const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine',
      'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen',
      'eighteen', 'nineteen', 'twenty']
    const stated = words[count]
    expect(stated, `no word for ${count} cases — extend the list`).toBeTruthy()

    // ⚠️ BOUND TO THE HEADER, NEVER GREPPED FILE-WIDE. A file-wide match would be satisfied
    // by the word appearing in any comment — including a comment ABOUT the stale number, which is
    // `HOOK-RGBA-COMMENTS-01` exactly. The claim lives in the sheet's own <header>.
    const h0 = RENDERER.indexOf('<header>')
    const h1 = RENDERER.indexOf('</header>')
    expect(h0 >= 0 && h1 > h0, 'the sheet has no <header> to read the claim from').toBe(true)
    const header = RENDERER.slice(h0, h1)
    expect(
      new RegExp(`\\b${stated}\\b`, 'i').test(header),
      `the sheet renders ${count} cases but its header does not say "${stated}" — ` +
      `a number in prose drifts; a number a gate reads does not`,
    ).toBe(true)
  })
})
