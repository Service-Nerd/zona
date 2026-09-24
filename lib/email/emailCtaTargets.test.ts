/**
 * Every email CTA lands on a target the app actually accepts.
 *
 * 🔴 THE DEFECT THIS GUARDS, AND IT ALMOST SHIPPED TWICE. Every CTA pointed at
 * the marketing homepage: **four steps and two guesses** from an inbox to the one
 * action we ask for (Wroblewski, Design Board 2026-09-24).
 *
 * ⚠️ AND THE FIX WOULD HAVE BEEN INERT. `DashboardClient` accepted `post-run` and
 * `session` and nothing else. An email linking `?screen=upgrade` would have
 * looked fixed and done nothing — the decorative class this repo keeps recording
 * (`--s-long` unreachable for every plan; `run_walk_strategy` stamped with no
 * reader; two §97 gates that could never fire).
 *
 * So this test reads **BOTH SIDES**: the vocabulary the emails build hrefs from,
 * and the handler in the app. A target only one of them knows fails the build.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { EMAIL_CTA_SCREENS, ctaHref } from './ctaTargets'

const CLIENT = readFileSync('app/dashboard/DashboardClient.tsx', 'utf8')
const TEMPLATES = readFileSync('lib/email/trialEmailTemplates.ts', 'utf8')

describe('email CTA targets are accepted by the app', () => {
  it('the handler accepts every screen the emails can link to', () => {
    // ⚠️ `post-run` IS handled, by the POST-RUN-01 push block rather than the
    // email block — it needs weekN + sessionDay and that parser already exists.
    // Handling it twice would be two answers to one question. So the assertion
    // is "the app resolves this param", not "the email block names it", and the
    // two accepted shapes are listed rather than assumed.
    const unhandled = EMAIL_CTA_SCREENS.filter(s =>
      !new RegExp(`emailScreen === '${s}'`).test(CLIENT)
      && !new RegExp(`screenParam === '${s}'`).test(CLIENT))
    expect(unhandled, `DashboardClient resolves none of: ${unhandled.join(', ')}`).toEqual([])
  })

  it('a deep link that needs a session CARRIES one', () => {
    // `post-run` without weekN/sessionDay resolves to nothing and the runner
    // lands on Today wondering what we meant — the inert-CTA class again.
    expect(ctaHref('post-run', { weekN: 4, sessionDay: 'tue' }))
      .toBe(`${ctaHref('post-run').split('?')[0]}?screen=post-run&weekN=4&sessionDay=tue`)
    expect(ctaHref('post-run')).not.toContain('weekN')
  })

  it('every href is a dashboard deep link, never the marketing homepage', () => {
    for (const s of EMAIL_CTA_SCREENS) {
      const href = ctaHref(s)
      expect(href).toContain(`/dashboard?screen=${s}`)
      // The exact shape of the old defect: a bare origin with no path.
      expect(href).not.toMatch(/^https:\/\/[^/]+\/?$/)
    }
  })

  it('no template builds a CTA without naming a target', () => {
    // A `ctaButton('...')` with one argument is the old signature, which defaulted
    // to the homepage. It must not come back.
    const oneArg = TEMPLATES.match(/ctaButton\('[^']*'\s*\)/g) ?? []
    expect(oneArg, 'ctaButton called without a target screen').toEqual([])
  })

  it('every ctaButton call names a screen from the shared vocabulary', () => {
    // ⚠️ exec loop, not matchAll: spreading a RegExpStringIterator needs
    // `downlevelIteration`, which this tsconfig does not set (TS2802). SECOND
    // TIME I HAVE WRITTEN THIS TODAY — `hollowTestShapes.test.ts` carries the
    // same note, and the function above the first one explained the same error.
    const calls: string[] = []
    const re = /ctaButton\('[^']*',\s*'([a-z-]+)'\)/g
    let m: RegExpExecArray | null
    while ((m = re.exec(TEMPLATES)) !== null) calls.push(m[1]!)
    expect(calls.length, 'the templates must contain CTA calls at all').toBeGreaterThan(0)
    for (const c of calls) expect(EMAIL_CTA_SCREENS).toContain(c as never)
  })
})
