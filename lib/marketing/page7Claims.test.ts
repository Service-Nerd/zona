// Coaching Board 2026-10-29 (GTM-SEO-COMPARE-01 page 7, CORRECT WITH AMENDMENT) + CHARITY-PLAN-PREREQ-01. What these
// pages say about a published plan is read from the plan; the three sentences the board replaced cannot come back.
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { getArticle } from './articles'
import { getPlan, planAnchor } from './plans'
import { planShape, planStartPoint } from './planFacts'
import { generateRulePlan } from '../plan/ruleEngine'
import { isHardEffort, isLongRun } from '../plan/sessionRole'
import { sessionKmSelfPaced } from '../plan/sessionDistance'
import type { Session } from '@/types/plan'

const article = getArticle('marathon-training-plan-full-time-job')!
const text = JSON.stringify(article.body)
const mp = getPlan('marathon-16-week')!
const { planStart, raceDate } = planAnchor(mp.dayOffset)
const plan = generateRulePlan(mp.input(raceDate), 'free', planStart)
const runs = (w: (typeof plan.weeks)[number]) => (Object.values(w.sessions).flat() as Array<Session | null | undefined>)
  .filter((s): s is Session => !!s && !['rest', 'strength', 'cross-train'].includes(s.type))
const km = (w: (typeof plan.weeks)[number]) => runs(w).reduce((a, s) => a + (sessionKmSelfPaced(s) ?? 0), 0)

describe('page 7: the plan it describes is the plan it links', () => {
  it('🔴 the start point is the plan\'s own: week 1 and the level it is written for, not "30 minutes"', () => {
    const start = planStartPoint('marathon-16-week')
    expect(start).toEqual({ weeklyKm: (mp.input(raceDate) as { current_weekly_km: number }).current_weekly_km, longRunKm: (mp.input(raceDate) as { longest_recent_run_km: number }).longest_recent_run_km })
    expect(text).toContain(`starts at about ${Math.round(km(plan.weeks[0]))}km in week one`)
    expect(text).toContain(`already running about ${start.weeklyKm}km a week with a ${start.longRunKm}km long run`)
    expect(text).not.toMatch(/30 minutes without stopping/)
    // Willy's finding, held as a number: the plan opens far above what 30 minutes of running is.
    expect(km(plan.weeks[0])).toBeGreaterThan(20)
  })
  it('the peak, the length and the days a week are the generated plan\'s', () => {
    const shape = planShape('marathon-16-week')
    expect(shape.peakKm).toBe(Math.round(Math.max(...plan.weeks.map(km))))
    expect(shape.weeks).toBe(plan.weeks.length)
    expect(text).toContain(`peaks at ${shape.peakKm}km`)
    expect(text).toContain(`In the ${shape.weeks}-week plan`)
  })
  it('🔴 the first five weeks hold no hard session but one 5K time trial, as the page says', () => {
    const hard = plan.weeks.slice(0, 5).flatMap(w => runs(w).filter(s => isHardEffort(s)).map(s => s.label))
    expect(hard.length).toBeLessThanOrEqual(1)
    for (const l of hard) expect(l).toMatch(/time trial/i)
    expect(text).toContain('the first five weeks have no hard sessions beyond strides and one 5K time trial')
  })
  it('🔴 the day rule is §7\'s, and heavy legs go after Thursday\'s run (S2)', () => {
    expect(text).toContain('keep the harder session at least two days away from the long run')
    expect(text).not.toContain('keep the two easy runs apart from the long run')
    expect(text).toContain('If you lift, do the heavy leg work on Thursday after the harder run')
    expect(text).not.toMatch(/off, or strength work/)
    // The page's own week holds §7: Thursday's harder session is three days before Sunday's long run.
    const days = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
    expect(days.indexOf('sun') - days.indexOf('thu')).toBeGreaterThanOrEqual(2)
  })
  it('the plan numbers are interpolated in the source, never typed', () => {
    const src = fs.readFileSync(path.join(__dirname, 'articles.ts'), 'utf8')
    const body = src.slice(src.indexOf("slug: 'marathon-training-plan-full-time-job'"), src.indexOf('// ── GUIDE 1'))
    expect(body).toContain('${MARATHON.week1Km}km')
    expect(body).toContain('${MARATHON.peakKm}km')
    expect(body).toContain('${MARATHON_START.weeklyKm}km')
    expect(body).not.toMatch(/\b(50|65|45)km\b/)
  })
})

describe('CHARITY-PLAN-PREREQ-01: the charity page states each plan\'s real start point', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../app/charity-runners/page.tsx'), 'utf8')
  it('🔴 no "30 minutes" promise; every start point read from the plan', () => {
    expect(src).not.toMatch(/assume you can already run about 30 minutes/)
    for (const s of ['5k-12-week', '10k-12-week', 'half-marathon-12-week', 'marathon-16-week']) expect(src).toContain(`planStartPoint('${s}')`)
    expect(src).toContain('marathon plan about ${START.full.weeklyKm}km with a ${START.full.longRunKm}km long run')
  })
  it('the long run the marathon plan is written for is the input\'s, and its first long run is no jump from it', () => {
    const lr = Math.max(0, ...runs(plan.weeks[0]).filter(s => isLongRun(s)).map(s => s.distance_km ?? 0))
    expect(lr).toBeLessThanOrEqual(planStartPoint('marathon-16-week').longRunKm)
  })
})
