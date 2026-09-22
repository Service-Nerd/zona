// App review wave 4 — S1, A5, A6, A8 (Design Board sitting three, §§ 6g/6i).
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { LOAD_RATIO } from '@/lib/coaching/constants'

const read = (f: string) => readFileSync(join(process.cwd(), f), 'utf8')
const strip = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^\s*\/\/.*$/gm, '')

const SHELL = strip(read('app/dashboard/DashboardClient.tsx'))
const LOADSHAPE = strip(read('components/shared/LoadShape.tsx'))

describe('A5 — Coach speaks in shape, never score', () => {
  it('🔴 the load tile leads with the VERDICT, not the ratio', () => {
    // It rendered `${loadRatio.toFixed(2)}x` at 28px/800 as the hero, with the
    // meaning demoted to an 11px sub-line and the explanation behind a tap.
    const i = SHELL.indexOf("label: 'This week\\u2019s load'")
    expect(i, 'the load tile').toBeGreaterThan(-1)
    const tile = SHELL.slice(i, i + 900)
    expect(tile).toContain('lrc.label')
    // The number survives as EVIDENCE under the shape — it is not deleted, it
    // is demoted. `sub`, never `value`.
    expect(tile).toMatch(/sub:[\s\S]*toFixed\(2\)/)
    expect(tile).not.toMatch(/value:[^\n]*toFixed\(2\)/)
  })

  it('and it draws the shape', () => {
    expect(SHELL).toContain('<LoadShape ratio={loadRatio}')
  })

  it('the Sessions tile deliberately KEEPS its number', () => {
    // "3/5" means something without a tap, which is exactly Sierra's test. One
    // tile changing and one not is a distinction, not a drift — assert it so
    // nobody "makes them consistent" later.
    const i = SHELL.indexOf("label: 'Sessions'")
    const tile = SHELL.slice(i, i + 400)
    expect(tile).toMatch(/value:[\s\S]*sessionsCompleted/)
    expect(tile).toContain('shape: null')
  })

  it('the shape reads the SAME constants the coaching layer flags on', () => {
    // A band drawn at numbers the engine does not use would be a picture of
    // nothing. It must be the runner's real normal.
    expect(LOADSHAPE).toContain('LOAD_RATIO.under')
    expect(LOADSHAPE).toContain('LOAD_RATIO.watch')
    expect(LOADSHAPE).not.toMatch(/pct\(0\.8\)|pct\(1\.3\)/)
    expect(LOAD_RATIO.under).toBeLessThan(LOAD_RATIO.watch)
  })

  it('the lower edge is a NAMED constant, not a literal in a display function', () => {
    // It was a bare 0.8 inside `loadRatioContext`, invisible to every config
    // check this repo owns, while governing what the runner is told.
    const i = SHELL.indexOf('function loadRatioContext')
    const fn = SHELL.slice(i, i + 600)
    expect(fn).toContain('LOAD_RATIO.watch')
    expect(fn).toContain('LOAD_RATIO.under')
    expect(fn).not.toMatch(/ratio\s*<\s*0\.8/)
  })

  it('no marker when there is no ratio — absent beats a guess at 1.0', () => {
    // A marker parked at 1.0 would read as "you are exactly normal", which is
    // a claim we cannot make from no data.
    expect(LOADSHAPE).toMatch(/ratio !== null && \(/)
  })

  it('it is a shape, not a dashboard — the reversal has a limit', () => {
    // "No dashboards" is reversed for this, on Zhuo's distinction. The limit is
    // that a shape answers the question; axes, gridlines and legends pose it.
    for (const chrome of ['gridline', 'legend', 'axis', 'tick']) {
      expect(LOADSHAPE.toLowerCase(), `chrome crept in: ${chrome}`).not.toContain(chrome)
    }
  })
})

describe('A8 — Session Detail leads with what you need mid-run', () => {
  it('🔴 the SET comes before the REASON for it', () => {
    // The structure was the sixth block down, below the rationale, whose own
    // comment said "brand-defining content reads first". Nothing is cut: the
    // rationale still reads, one scroll later, when the runner is deciding
    // rather than executing.
    const struct = SHELL.indexOf('composeSession({ session, catalogueRow, goalPace })')
    const why    = SHELL.indexOf('label="WHY THIS SESSION"')
    expect(struct).toBeGreaterThan(-1)
    expect(why).toBeGreaterThan(-1)
    expect(struct, 'the structured set must precede WHY THIS SESSION').toBeLessThan(why)
  })

  it('nothing was cut — the rationale still renders', () => {
    expect(SHELL).toContain('label="WHY THIS SESSION"')
    expect(SHELL).toContain('variant="why"')
  })
})

describe('A6 — Me is a settings screen whose sections describe themselves', () => {
  it('the display toggles have their own section', () => {
    // They sat unlabelled inside "Your training", justified by "they affect
    // session cards" — by which argument almost everything here is training.
    const i = SHELL.indexOf('<SectionLabel>Display</SectionLabel>')
    expect(i).toBeGreaterThan(-1)
    const after = SHELL.slice(i, i + 2000)
    expect(after).toContain('ariaLabel="Distance units"')
    expect(after).toContain('ariaLabel="Session display metric"')
  })

  it('🔴 "Plan" no longer labels the SUBSCRIPTION card', () => {
    // "Plan" is the noun on the nav bar, the wizard, the arc and the marketing
    // site, and it means the TRAINING plan. A word used for two things is not
    // a word (Collins).
    expect(SHELL).not.toContain('<SectionLabel>Plan</SectionLabel>')
    const i = SHELL.indexOf('<SectionLabel>Subscription</SectionLabel>')
    expect(i).toBeGreaterThan(-1)
    expect(SHELL.slice(i, i + 400)).toContain('<MePlanCard')
  })

  it('the SLT’s kill stands — Me does not merchandise', () => {
    // A settings screen that merchandises is a permanent kill (SLT, unanimous).
    // The subscription card stays because a paid runner seeing what they cover
    // is the honest half; a feature list would not be.
    const i = SHELL.indexOf('<SectionLabel>Subscription</SectionLabel>')
    const block = SHELL.slice(i, i + 400)
    expect(block).not.toMatch(/Unlock|Upgrade now|Everything you get/i)
  })
})
