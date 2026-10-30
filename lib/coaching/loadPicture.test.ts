// LOAD-SOURCE-TOTAL-01 — the Coach load picture reads what the runner actually ran (Coaching Board 2026-10-30, §129).
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { computeLoadPicture, isPlannedLighterWeek, LOAD_PICTURE_LOOKBACK_DAYS, LOAD_HISTORY_WEEKS } from './loadPicture'
import { LOAD_RATIO, LOAD_PICTURE_MIN_PRIOR_WEEKS } from './constants'
import { loadRatioContext } from '@/lib/ui/loadRatioContext'
import type { ActivityLogRow } from './weeklyActualLoad'
import type { Plan } from '@/types/plan'

const NOW = new Date('2026-10-30T12:00:00Z')
const DAY = 86_400_000

let seq = 0
/** A run `daysAgo` before NOW, of `km`, from `source`. Each gets its own id so dedupe keeps it. */
function run(daysAgo: number, km: number, source: 'hk' | 'manual' | 'strava' = 'hk', type = 'Run'): ActivityLogRow {
  seq++
  return {
    start_date: new Date(NOW.getTime() - daysAgo * DAY).toISOString(),
    distance_m: km * 1000,
    activity_type: type, sport_type: type,
    strava_activity_id: source === 'strava' ? seq : null,
    apple_health_uuid: source === 'hk' ? `hk-${seq}` : null,
    manual_uuid: source === 'manual' ? `manual-w${seq}-mon` : null,
  }
}

/** One run of `km` in each 7-day window, window 0 = the last 7 days. */
function weeks(...km: number[]): ActivityLogRow[] {
  return km.flatMap((k, i) => (k > 0 ? [run(i * 7 + 2, k)] : []))
}

/** A plan whose week containing NOW is `current`, with weeks either side. */
function plan(current: Record<string, unknown>): Pick<Plan, 'weeks'> {
  const monday = (offsetWeeks: number) => new Date(Date.UTC(2026, 9, 26 + offsetWeeks * 7)).toISOString().slice(0, 10)
  return { weeks: [
    { n: 1, date: monday(-1), sessions: {} },
    { n: 2, date: monday(0), sessions: {}, ...current },
    { n: 3, date: monday(1), sessions: {} },
  ] } as unknown as Pick<Plan, 'weeks'>
}

describe('LOAD-SOURCE-TOTAL-01 computeLoadPicture', () => {
  it('the last 7 days against the four windows before', () => {
    expect(computeLoadPicture(weeks(26, 20, 20, 20, 20), null, NOW).ratio).toBeCloseTo(1.3, 5)
  })

  it(`no verdict below ${LOAD_PICTURE_MIN_PRIOR_WEEKS} of 4 prior weeks with running; a real rest week still counts as 0`, () => {
    expect(computeLoadPicture(weeks(20, 20, 20, 0, 0), null, NOW).ratio).toBeNull()       // 2 of 4
    expect(computeLoadPicture(weeks(20, 20, 20, 20, 0), null, NOW).ratio).toBeCloseTo(20 / 15, 5)  // 3 of 4, rest week averaged in
    expect(computeLoadPicture([], null, NOW).ratio).toBeNull()
  })

  it('every source counts: manual logs and Strava as well as Apple Health (ADR-011)', () => {
    const rows = [run(2, 10, 'manual'), run(3, 10, 'strava'), ...weeks(0, 20, 20, 20, 20)]
    expect(computeLoadPicture(rows, null, NOW).ratio).toBeCloseTo(1, 5)
  })

  it('a walk or a ride is not running', () => {
    const rows = [run(2, 50, 'hk', 'Walk'), run(3, 80, 'hk', 'Ride'), ...weeks(20, 20, 20, 20, 20)]
    expect(computeLoadPicture(rows, null, NOW).ratio).toBeCloseTo(1, 5)
  })

  it('running before the plan started is still the runner\'s normal', () => {
    // The plan starts this week; the prior windows are all before it.
    const p = { weeks: [{ n: 1, date: '2026-10-26', sessions: {} }] } as unknown as Pick<Plan, 'weeks'>
    expect(computeLoadPicture(weeks(20, 20, 20, 20, 20), p, NOW).ratio).toBeCloseTo(1, 5)
  })

  it('a run dated after now does not count', () => {
    const future = { ...run(0, 99), start_date: new Date(NOW.getTime() + DAY).toISOString() }
    expect(computeLoadPicture([future, ...weeks(20, 20, 20, 20, 20)], null, NOW).ratio).toBeCloseTo(1, 5)
  })

  it('plannedEasy reads the plan week containing today', () => {
    expect(computeLoadPicture([], plan({ badge: 'deload' }), NOW).plannedEasy).toBe(true)
    expect(computeLoadPicture([], plan({ phase: 'taper' }), NOW).plannedEasy).toBe(true)
    expect(computeLoadPicture([], plan({ phase: 'build' }), NOW).plannedEasy).toBe(false)
    expect(computeLoadPicture([], null, NOW).plannedEasy).toBe(false)
  })

  it('isPlannedLighterWeek: deload, holiday, taper and post-race restoration', () => {
    for (const w of [{ type: 'deload' }, { badge: 'deload' }, { badge: 'holiday' }, { phase: 'taper' }, { phase: 'maintenance_restoration' }]) {
      expect(isPlannedLighterWeek(w as any), JSON.stringify(w)).toBe(true)
    }
    expect(isPlannedLighterWeek({ phase: 'peak' } as any)).toBe(false)
    expect(isPlannedLighterWeek(undefined)).toBe(false)
  })

  it('lowWeeksRunning counts consecutive unplanned windows under normal, ending now', () => {
    // Window 0: 5 vs prior 10,20,20,20 → 0.29. Window 1: 10 vs 20,20,20,20 → 0.5. Both under.
    expect(computeLoadPicture(weeks(5, 10, 20, 20, 20, 20), plan({}), NOW).lowWeeksRunning).toBe(2)
    // Only this week is under.
    expect(computeLoadPicture(weeks(5, 20, 20, 20, 20, 20), plan({}), NOW).lowWeeksRunning).toBe(1)
    // A planned lighter week is not counted at all.
    expect(computeLoadPicture(weeks(5, 10, 20, 20, 20, 20), plan({ badge: 'deload' }), NOW).lowWeeksRunning).toBe(0)
  })

  it('the lookback reaches every window the streak and the history read', () => {
    expect(LOAD_PICTURE_LOOKBACK_DAYS).toBe(7 * Math.max(6, LOAD_HISTORY_WEEKS))
  })
})

describe('LOAD-SOURCE-TOTAL-01 composed: rows → picture → verdict', () => {
  const verdict = (rows: ActivityLogRow[], p: Pick<Plan, 'weeks'> | null) => {
    const pic = computeLoadPicture(rows, p, NOW)
    return loadRatioContext(pic.ratio, pic)
  }
  it('a planned deload under normal reads as planned, in moss', () => {
    const v = verdict(weeks(8, 20, 20, 20, 20), plan({ badge: 'deload' }))
    expect(v.label).toMatch(/planned/)
    expect(v.color).toBe('var(--moss-strong)')
  })
  it('one unplanned light week is neutral; a second in a row is amber', () => {
    expect(verdict(weeks(8, 20, 20, 20, 20, 20), plan({})).color).toBe('var(--ink-2)')
    expect(verdict(weeks(5, 10, 20, 20, 20, 20), plan({})).color).toBe('var(--warn)')
  })
  it('the edges: exactly LOAD_RATIO.watch is above normal; exactly LOAD_RATIO.under is not under', () => {
    // 26 / 20 = watch (1.3); 16 / 20 = under (0.8). Killed `>=` → `>` survivors in the mutation harness.
    expect(verdict(weeks(20 * LOAD_RATIO.watch, 20, 20, 20, 20), plan({})).label).toBe('above your recent normal')
    expect(verdict(weeks(20 * LOAD_RATIO.under, 20, 20, 20, 20), plan({})).label).toBe('right on your normal')
    // A window exactly at `under` does not extend a low streak.
    expect(computeLoadPicture(weeks(5, 20 * LOAD_RATIO.under, 20, 20, 20, 20), plan({}), NOW).lowWeeksRunning).toBe(1)
  })
  it('a big week is amber', () => {
    expect(verdict(weeks(40, 20, 20, 20, 20), plan({})).label).toBe('above your recent normal')
    expect(LOAD_RATIO.watch).toBeLessThan(2)
  })
  it('a new runner gets no verdict at all', () => {
    expect(verdict(weeks(20), plan({})).label).toBe('—')
  })
})

describe('LOAD-SOURCE-TOTAL-01 wiring', () => {
  const shell = readFileSync('app/dashboard/DashboardClient.tsx', 'utf8')
  it('🔴 the Coach tile reads the load picture, not the weekly report\'s trim ratio', () => {
    expect(shell).toMatch(/const loadRatio: number \| null\s*=\s*loadPicture\?\.ratio \?\? null/)
    expect(shell).not.toMatch(/const loadRatio[^\n]*acute_chronic_ratio/)
  })
  it('the marker takes the marker colour, so a neutral week does not paint the shape in ink', () => {
    expect(shell).toContain('<LoadShape ratio={loadRatio} color={isRaceWeek ? \'var(--ink-2)\' : lrc.markerColor} />')
  })
  it('the read is source-agnostic: no source filter on the load picture query', () => {
    const i = shell.indexOf('[coach] load picture read failed')
    const block = shell.slice(shell.lastIndexOf('useState<LoadPicture | null>', i), i)
    expect(block).toContain(".from('strava_activities')")
    expect(block).not.toMatch(/\.eq\('source'/)
    expect(block).toContain('manual_uuid')
  })
  it('🔴 the sheet makes no injury or "safe zone" claim (describe, never predict)', () => {
    // Bounded to the sheet's copy array, and comment lines dropped: the change's own comment quotes the old claims.
    const i = shell.indexOf('Compares the distance you ran')
    expect(i).toBeGreaterThan(0)
    const sheet = shell.slice(shell.lastIndexOf('{[', i), shell.indexOf('].map', i))
      .split('\n').filter(l => !l.trim().startsWith('//')).join('\n')
    expect(sheet).not.toMatch(/safe build zone|where injuries happen|how fitness actually builds/i)
    expect(sheet).toMatch(/does not predict injury/)
  })
})

describe('RUNKED-LOAD-VIEW-01 history — the same windows the verdict reads', () => {
  it('oldest first, this window last, up to 8; the ratio is this bar over the normal', () => {
    const p = computeLoadPicture(weeks(40, 20, 30, 30, 20, 10, 25, 22, 99), null, NOW)
    expect(p.history.map(w => w.km)).toEqual([22, 25, 10, 20, 30, 30, 20, 40])
    expect(p.normalKm).toBe(25)
    expect(p.ratio).toBeCloseTo(40 / 25, 5)
  })
  it('🔴 leading weeks before the first run are dropped, not drawn as zeros; a gap after it stays a zero', () => {
    const p = computeLoadPicture(weeks(30, 20, 0, 25, 30), null, NOW)
    expect(p.history.map(w => w.km)).toEqual([30, 25, 0, 20, 30])
  })
  it('no verdict, no normal', () => {
    const p = computeLoadPicture(weeks(30, 20), null, NOW)
    expect(p.ratio).toBeNull()
    expect(p.normalKm).toBeNull()
  })
  it('a planned lighter week is flagged on its own window', () => {
    const p = computeLoadPicture(weeks(10, 30, 30, 30, 30), plan({ phase: 'taper' }), NOW)
    expect(p.history[p.history.length - 1].plannedEasy).toBe(true)
    expect(p.history[0].plannedEasy).toBe(false)
  })
})
