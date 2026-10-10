// BASEBUILD-WEEK-COPY-01 — a base build is up to fifteen weeks and had three themes.
//
// 🔴 MEASURED on a generated 15-week base build (2026-10-10): **3 distinct week themes
// and 1 distinct session note across 51 sessions.** A runner got "Building the base."
// for roughly twelve consecutive weeks, so week 4 was indistinguishable from week 11.
//
// ⚠️ THIS IS WHY THE PAID VOICE GATE WAS SENT BACK TO THE SLT. They weighed "should the
// AI voice be PAID" against an implied alternative of SILENCE. The real alternative was
// REPETITION, and fixing repetition is free infrastructure — gating it would have been
// gating access to knowing what the week is for.
import { describe, it, expect } from 'vitest'
import { generateGetRunningPlan } from './getRunningPlan'
import { generateFoundationBlock } from './foundationBlock'
import type { GeneratorInput } from '@/types/plan'

const PINNED = '2026-10-12'

const input = (over: Record<string, unknown> = {}): GeneratorInput => ({
  race_distance_km: 42.2, race_date: '2027-04-24', current_weekly_km: 5,
  longest_recent_run_km: 4, days_available: 3, training_age: '<6mo', goal: 'finish',
  user_declared_level: 'beginner', age: 40, resting_hr: 55, ...over,
} as unknown as GeneratorInput)

const themesOf = (p: { weeks: Array<{ theme?: string | null }> }) =>
  p.weeks.map(w => String(w.theme ?? ''))

describe('BASEBUILD-WEEK-COPY-01', () => {
  it('1. 🔴 a 15-week base build no longer repeats itself', () => {
    const { plan } = generateGetRunningPlan(input(), PINNED, 29)
    expect(plan.weeks.length).toBeGreaterThanOrEqual(12)
    const distinct = new Set(themesOf(plan))
    // Was 3 for fifteen weeks. The number is not the point; being able to TELL
    // two mid-block weeks apart is.
    expect(distinct.size).toBeGreaterThan(8)
    const mid = plan.weeks.filter(w => (w.n as number) > 1 && (w.n as number) < plan.weeks.length)
    const w4 = mid.find(w => w.n === 4)?.theme
    const w11 = mid.find(w => w.n === 11)?.theme
    expect(w4, 'week 4 must exist in this fixture').toBeTruthy()
    expect(w11, 'week 11 must exist in this fixture').toBeTruthy()
    expect(w4, 'week 4 and week 11 said the same sentence before this').not.toBe(w11)
  })

  it('2. a STEP-BACK week says so, and only on weeks the engine marks deload', () => {
    const { plan } = generateGetRunningPlan(input(), PINNED, 29)
    const deloads = plan.weeks.filter(w => w.type === 'deload')
    expect(deloads.length, 'the fixture must contain a deload').toBeGreaterThan(0)
    for (const w of deloads) expect(String(w.theme)).toMatch(/Step back/)
    for (const w of plan.weeks.filter(x => x.type !== 'deload'))
      expect(String(w.theme), `week ${w.n} is not a deload`).not.toMatch(/Step back/)
  })

  it('3. 🔴 NO DISTANCE IN PROSE — ADR-015, and the measured units debt', () => {
    // `hardcodedUnitsDebt` measured 16 of 19 stored plans carrying prose km, which a
    // miles runner reads in the wrong unit. 15 more per plan would grow it.
    for (const theme of themesOf(generateGetRunningPlan(input(), PINNED, 29).plan)) {
      expect(theme, `prose distance in: "${theme}"`).not.toMatch(/\d\s*(km|mi|miles)\b/i)
    }
  })

  it('4. ⚠️ NO TOKEN — week copy must be complete as written', () => {
    // ENRICH-META-TOKEN-01, ruled today: a token in week copy relies on one safe
    // render site, which is COACH-INTRO-TOKEN-01's exact defect.
    for (const theme of themesOf(generateGetRunningPlan(input(), PINNED, 29).plan))
      expect(theme).not.toContain('{{')
  })

  it('5. ⚠️ it promises NO race plan — a base build has no destination', () => {
    // `generateGetRunningPlan` deletes `base_build_onramp` precisely so no reader
    // infers a handover (BASEBUILD-HANDOVER-01). The copy must not reinstate it.
    const { plan } = generateGetRunningPlan(input(), PINNED, 29)
    const last = String(plan.weeks[plan.weeks.length - 1].theme)
    expect(last).toMatch(/Last week of the base/)
    for (const theme of themesOf(plan))
      expect(theme, `a destination claim in: "${theme}"`).not.toMatch(/plan proper|race plan|your plan starts/i)
  })

  it('6. 🔴 SCOPE HELD — a race-plan FOUNDATION block is untouched', () => {
    // `themeForPosition` is shared, and race-plan foundation blocks are short (1-3
    // weeks) where three themes are right. Widening it would have changed every race
    // plan's foundation copy — the shared-producer trap.
    const { weeks } = generateFoundationBlock({ input: input(), planStartDate: PINNED, today: '2026-09-28' })
    expect(weeks.length, 'the fixture must produce foundation weeks').toBeGreaterThan(0)
    for (const w of weeks) {
      expect(String(w.theme), 'foundation copy must keep its original wording')
        .toMatch(/Shake the rust off|Building the base|Last week before the plan proper/)
      expect(String(w.theme)).not.toMatch(/weeks of base left|Step back this week/)
    }
  })

  it('7. the voice holds — one sentence each, no em dash, no emoji, no cheerleading', () => {
    for (const theme of themesOf(generateGetRunningPlan(input(), PINNED, 29).plan)) {
      expect(theme, 'em dash is banned in runner-facing sentences').not.toContain('—')
      // ⚠️ A CODE-POINT SCAN, NOT A `/u` REGEX. `/[\u{...}]/u` passes under vitest and
      // fails `tsc` with TS1501 under this tsconfig target — hit twice in one day.
      const emoji = Array.from(theme).some(ch => {
        const cp = ch.codePointAt(0) ?? 0
        return cp >= 0x1F300 && cp <= 0x1FAFF
      })
      expect(emoji, `emoji in functional copy: "${theme}"`).toBe(false)
      expect(theme, 'never motivational').not.toMatch(/crushing|beast|amazing|you got this|smash/i)
      expect(theme.length, `too long for a week theme: "${theme}"`).toBeLessThan(90)
    }
  })
})
