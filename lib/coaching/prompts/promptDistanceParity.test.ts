import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { formatDistance } from '@/lib/format'
import { promptDistanceFormatters } from './promptFormat'
import { buildDailyCoachNotePrompt, type DailyCoachNoteInput } from './dailyCoachNote'
import { buildSessionFeedbackPrompt } from './sessionFeedback'
import type { Plan, Session } from '@/types/plan'

/**
 * BUG-KIT-DECIMALS-01 — "Kit says 5.7km, the plan says 6km, on the same screen."
 *
 * ADR-015 makes `formatDistance()` the sole owner of every distance string the
 * runner reads. Prompts were exempt on the argument that a prompt is not a
 * display surface. It is: the model repeats the number, and the runner reads it
 * beside the card it contradicts.
 *
 * Measured across the 648-input cohort grid (621 generated plans, 25,959 sessions
 * carrying a distance): **50.4% of prescribed session distances formatted
 * differently for the prompt than for the card.** Not an edge case — every
 * half-kilometre session, which is half of them.
 *
 * Two layers here, because either alone decays:
 *   1. Behavioural — real builders, real numbers, asserted against the string
 *      `formatDistance()` produces for that surface.
 *   2. Source — `fmtDist` (the precision-keeping formatter) may only be applied
 *      to values on an explicit measured/analytical allowlist. A new prompt that
 *      reaches for it on a prescribed field fails until someone classifies it.
 */

// ── 1. The formatters agree with the surfaces they mirror ───────────────────

describe('promptDistanceFormatters — the prompt quotes the card', () => {
  const { fmtDist, fmtPlanned, fmtRace } = promptDistanceFormatters('km')

  it('fmtPlanned IS formatDistance — not a second rounding rule', () => {
    // Singularity: if these ever diverge, ADR-015 has two owners again.
    for (const km of [5.5, 6.5, 4.3, 6.6, 8.5, 11.5, 0.5, 100]) {
      expect(fmtPlanned(km)).toBe(formatDistance(km, 'km'))
    }
  })

  it('a half-kilometre session reads the same in the prompt as on the card', () => {
    expect(fmtPlanned(5.5)).toBe('6km')   // was "5.5km" — the reported bug
    expect(fmtPlanned(6.5)).toBe('7km')
    expect(fmtPlanned(4.3)).toBe('4km')
  })

  it('a race keeps its iconic decimal and never its raw one', () => {
    expect(fmtRace(42.195)).toBe('42.2km')
    expect(fmtRace(21.0975)).toBe('21.1km')
    expect(fmtRace(10)).toBe('10km')
  })

  it('fmtDist still keeps precision — measured values are not rounded away', () => {
    // §66 / FMT-01: the engine's own arithmetic runs on these numbers.
    expect(fmtDist(5.72, 1)).toBe('5.7km')
    expect(fmtDist(5.7)).toBe('5.7km')
  })

  it('converts for a miles reader on every path', () => {
    const mi = promptDistanceFormatters('mi')
    expect(mi.fmtPlanned(10)).toBe(formatDistance(10, 'mi'))
    expect(mi.fmtRace(42.195)).toBe(formatDistance(42.195, 'mi', { exact: true }))
    expect(mi.fmtDist(10)).toBe('6.21mi')
  })

  it('returns the fallback rather than "nullkm" on a missing value', () => {
    expect(fmtPlanned(null)).toBe('—')
    expect(fmtRace(undefined)).toBe('—')
    expect(fmtDist(Number.NaN)).toBe('—')
  })
})

// ── 2. Through the real builders ────────────────────────────────────────────

const dailyBase: DailyCoachNoteInput = {
  todayDayName: 'Tuesday', todaySessionType: 'easy', todaySessionLabel: 'Easy run',
  todayZoneLabel: 'Zone 2', todayDistanceKm: 5.5,
  lastSession: null, weekPhase: 'base', weekN: 3, totalWeeks: 16, weeksToRace: 13,
  raceName: 'Spring Marathon', raceDistanceKm: 42.195,
  heavyFatigueTrend: false, consecutiveNailed: 0, firstName: 'Russ',
}

describe('daily coach note — the Today screen number', () => {
  it('quotes the session card, not the raw prescription', () => {
    const prompt = buildDailyCoachNotePrompt(dailyBase)
    expect(prompt).toContain('6km')
    expect(prompt).not.toContain('5.5km')
  })

  it('quotes the race at the race card\'s precision', () => {
    const prompt = buildDailyCoachNotePrompt(dailyBase)
    expect(prompt).toContain('42.2km')
    expect(prompt).not.toContain('42.195km')
  })
})

describe('session feedback — a comparison keeps BOTH sides at one precision', () => {
  const plan = {
    meta: { race_name: 'Spring Marathon', race_distance_km: 42.195, race_date: null },
    weeks: [{ n: 1, sessions: {} }],
  } as unknown as Plan

  const build = (plannedKm: number, actualKm: number) => buildSessionFeedbackPrompt({
    session: { type: 'easy', label: 'Easy run', distance_km: plannedKm, duration_mins: 35 } as unknown as Session,
    weekN: 1, plan, verdict: 'nailed' as never,
    actualDistKm: actualKm, actualAvgHr: 140, actualPaceSecPerKm: 360,
    hrInZonePct: 92, hrAboveCeilingPct: 3, efTrendPct: null, rpe: 4, fatigueTag: null,
  })

  it('does NOT round the planned side up to meet a whole-km card', () => {
    // Rounding here would invent a shortfall: "6km planned, 5.5km actual" against
    // a session the runner completed exactly. The model's own few-shot is
    // "Cut it 2km short" — it will say that.
    const prompt = build(5.5, 5.5)
    expect(prompt).toContain('Planned distance: 5.5km')
    expect(prompt).toContain('Actual distance: 5.5km')
    expect(prompt).not.toContain('Planned distance: 6km')
  })

  it('still quotes the race distance at the card\'s precision', () => {
    expect(build(5.5, 5.5)).not.toContain('42.195km')
  })
})

// ── 3. Source guard — fmtDist is for measured values only ───────────────────

/**
 * Every expression allowed through `fmtDist`, with why it is measured rather
 * than prescribed. A debt-register allowlist in the style of SWEEP-BASELINE-01:
 * adding a new one is a deliberate act, not an omission.
 */
const MEASURED_EXPRESSIONS: Record<string, string> = {
  'actualDistKm':                     'what the runner actually ran',
  'data.totalKmActual':               'actual weekly volume logged',
  'plannedKmToDate':                  'planned side of a volume COMPARISON — same precision as the actual beside it',
  'data.totalKmPlanned':              'planned side of a volume COMPARISON — same precision as the actual beside it',
  'session.distance_km':              'planned side of the planned-vs-actual line — same precision as the actual beside it',
  'cohortContext.medianDistanceKm':   'a cohort median, not this runner\'s plan',
  'trendSeries.distanceKm':           'the anchor band of a multi-month trend',
  'ctx.anchorDistanceKm':             'the anchor band of the aerobic trend',
  'totalLoadKm':                      'total load logged across a phase',
}

const PROMPT_DIR = join(process.cwd(), 'lib/coaching/prompts')
const promptFiles = readdirSync(PROMPT_DIR)
  .filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts') && f !== 'promptFormat.ts')

describe('source guard — a prescribed distance cannot reach fmtDist', () => {
  it('every fmtDist call names a value on the measured allowlist', () => {
    const offenders: string[] = []
    for (const file of promptFiles) {
      const src = readFileSync(join(PROMPT_DIR, file), 'utf8')
      for (const m of Array.from(src.matchAll(/fmtDist\(\s*([^,)]+)/g))) {
        const expr = m[1]!.trim()
        if (!(expr in MEASURED_EXPRESSIONS)) offenders.push(`${file}: fmtDist(${expr})`)
      }
    }
    expect(offenders, [
      'A prompt is quoting a distance through the precision-keeping formatter.',
      'If it is a distance the engine PRESCRIBED, use fmtPlanned (or fmtRace for a',
      'race) so Kit repeats the string on the card. If it is genuinely measured or',
      'analytical, add it to MEASURED_EXPRESSIONS with the reason.',
    ].join('\n')).toEqual([])
  })

  it('promptFormat is the only importer of formatDistanceForPrompt in the prompts layer', () => {
    // The raw-precision helper has exactly one legitimate caller now. A builder
    // importing it directly re-opens the hole this item closed.
    const direct = promptFiles.filter(f =>
      readFileSync(join(PROMPT_DIR, f), 'utf8').includes('formatDistanceForPrompt'))
    expect(direct).toEqual([])
  })

  it('every builder that formats a distance goes through the shared factory', () => {
    // Nine builders each declared an identical `const fmtDist = …` closure, so
    // the planned/measured split could be right in one and wrong in the next.
    const missing = promptFiles.filter(f => {
      const src = readFileSync(join(PROMPT_DIR, f), 'utf8')
      const formatsDistance = /fmtDist\(|fmtPlanned\(|fmtRace\(/.test(src)
      return formatsDistance && !src.includes('promptDistanceFormatters(')
    })
    expect(missing).toEqual([])
  })
})
