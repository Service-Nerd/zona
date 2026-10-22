import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { getCompletionCopy } from './completionCopy'
import { ZONE_HELD_MAX_ABOVE_CEILING_PCT as HELD } from './constants'

/**
 * 🔴 COMPLETION-COPY-CLAIM-01 (§12 Amendment 4). "Kept it easy." is praise: it needs evidence, every source present
 * must agree, and with none the headline makes no effort claim. A long run takes the long copy by role.
 */
const easy = { type: 'easy', rpe_target: 4 }
const PRAISE = 'Kept it easy.'

describe('the completion headline claims an easy effort only on evidence', () => {
  it('🔴 no heart rate and no RPE: no effort claim', () => {
    expect(getCompletionCopy(easy).headline).not.toBe(PRAISE)
    expect(getCompletionCopy('easy').headline).not.toBe(PRAISE)
  })
  it('🔴 heart rate held at exactly the praise threshold: praise, and the body may name the zone', () => {
    const c = getCompletionCopy(easy, { abovePct: HELD })
    expect(c.headline).toBe(PRAISE)
    expect(c.body).toMatch(/Zone 2/)
  })
  it('🔴 heart rate just over the threshold: no praise, even with an easy RPE', () => {
    expect(getCompletionCopy(easy, { abovePct: HELD + 0.1, rpe: 2 }).headline).not.toBe(PRAISE)
  })
  it('🔴 RPE at the session target with no HR: praise, but no zone named', () => {
    const c = getCompletionCopy(easy, { rpe: 4 })
    expect(c.headline).toBe(PRAISE)
    expect(c.body).not.toMatch(/Zone/)
  })
  it('🔴 RPE over the session target: no praise, even with held HR', () => {
    expect(getCompletionCopy(easy, { rpe: 5, abovePct: 3 }).headline).not.toBe(PRAISE)
  })
  it('an RPE with no session target is not evidence', () => {
    expect(getCompletionCopy({ type: 'easy' }, { rpe: 2 }).headline).not.toBe(PRAISE)
  })
  it('no neutral line names a cause or a verdict (P-04)', () => {
    const c = getCompletionCopy(easy)
    expect(`${c.headline} ${c.body}`).not.toMatch(/too hard|too fast|keen|easy\.|zone/i)
  })
  it('🔴 a long run reads as a long run, whatever its type', () => {
    expect(getCompletionCopy({ type: 'easy', role: 'long_run' } as never, { abovePct: 3 }).headline).toBe(getCompletionCopy('long').headline)
  })
  it('every other type is unchanged and claims no effort', () => {
    for (const t of ['quality', 'tempo', 'intervals', 'hard', 'race', 'recovery', 'strength', 'xyz'])
      expect(getCompletionCopy(t).headline).not.toBe(PRAISE)
  })
  it('🔴 every caller passes the session and its evidence, never the bare type', () => {
    const files = ['app/dashboard/DashboardClient.tsx', 'components/dashboard/SessionPopupInner.tsx', 'app/api/og/session-complete-card/route.tsx']
    let n = 0
    for (const f of files) {
      const src = readFileSync(f, 'utf8')
      for (const m of Array.from(src.matchAll(/getCompletionCopy\(/g))) {
        // The call's own argument list, bounded by the line it sits on (each call is one line).
        const line = src.slice(m.index!, src.indexOf('\n', m.index!))
        expect(line, f).toMatch(/abovePct/); n++
      }
    }
    expect(n).toBe(4)
  })
})
