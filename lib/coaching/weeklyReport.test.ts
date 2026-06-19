import { describe, it, expect } from 'vitest'
import { pickSpotlightSession, type RunAnalysisRow, type WeeklyReportData } from './weeklyReport'
import { buildWeeklyReportPrompt } from './prompts/weeklyReport'
import type { Plan } from '@/types/plan'

/**
 * The week shape `pickSpotlightSession` consumes — a permissive subset of
 * Plan.Week.sessions. Session keys are full day names ('monday'..'sunday').
 */
type TestWeek = {
  sessions: Record<string, { type: string; distance_km?: number | null } | null | undefined>
}

const week3: TestWeek = {
  sessions: {
    monday:    { type: 'rest' },
    tuesday:   { type: 'easy',    distance_km: 8 },
    wednesday: { type: 'easy',    distance_km: 10 },
    thursday:  { type: 'quality', distance_km: 8 },
    friday:    { type: 'rest' },
    saturday:  { type: 'long',    distance_km: 18 },
    sunday:    { type: 'recovery', distance_km: 5 },
  },
}

const row = (
  day: string,
  score: number | null,
  verdict: string | null,
  hr: number | null = null,
  ef: number | null = null,
): RunAnalysisRow => ({
  session_day:    `week_3_${day}`,
  total_score:    score,
  verdict,
  hr_in_zone_pct: hr,
  ef_trend_pct:   ef,
})

describe('pickSpotlightSession', () => {
  describe('null cases', () => {
    it('returns null on empty analyses', () => {
      expect(pickSpotlightSession([], week3, 3)).toBeNull()
    })

    it('returns null when no row has a total_score', () => {
      const analyses = [row('tuesday', null, 'nailed'), row('wednesday', null, 'off_target')]
      expect(pickSpotlightSession(analyses, week3, 3)).toBeNull()
    })

    it('returns null when every session is close or below threshold but not in target verdicts', () => {
      // 'close' is the middle band — neither concerning enough nor nailed enough.
      const analyses = [row('tuesday', 65, 'close'), row('wednesday', 70, 'close')]
      expect(pickSpotlightSession(analyses, week3, 3)).toBeNull()
    })

    it('returns null when matching session is missing from the plan', () => {
      // Analysis row references a day with no session in the plan (gap in plan).
      const orphanWeek: TestWeek = { sessions: {} }
      const analyses = [row('tuesday', 35, 'concerning')]
      expect(pickSpotlightSession(analyses, orphanWeek, 3)).toBeNull()
    })
  })

  describe('concerning polarity', () => {
    it('picks the lowest-score off_target session', () => {
      const analyses = [
        row('tuesday',  72, 'close'),
        row('wednesday', 38, 'off_target', 42, -8),
        row('thursday', 80, 'nailed'),
      ]
      const result = pickSpotlightSession(analyses, week3, 3)
      expect(result).not.toBeNull()
      expect(result!.polarity).toBe('concerning')
      expect(result!.dayLabel).toBe('Wednesday')
      expect(result!.type).toBe('easy')
      expect(result!.distanceKm).toBe(10)
      expect(result!.totalScore).toBe(38)
      expect(result!.verdict).toBe('off_target')
      expect(result!.hrInZonePct).toBe(42)
      expect(result!.efTrendPct).toBe(-8)
    })

    it('picks the worst when multiple off_target / concerning exist', () => {
      const analyses = [
        row('tuesday',  45, 'off_target'),
        row('wednesday', 28, 'concerning'),
        row('thursday', 50, 'off_target'),
      ]
      const result = pickSpotlightSession(analyses, week3, 3)
      expect(result).not.toBeNull()
      expect(result!.dayLabel).toBe('Wednesday')
      expect(result!.polarity).toBe('concerning')
    })

    it('prefers concerning over a higher-scoring nailed session in the same week', () => {
      // Even though Thursday nailed scored higher than Wednesday concerning,
      // the concerning polarity takes priority — it's the more actionable signal.
      const analyses = [
        row('wednesday', 35, 'concerning'),
        row('saturday',  92, 'nailed'),
      ]
      const result = pickSpotlightSession(analyses, week3, 3)
      expect(result).not.toBeNull()
      expect(result!.polarity).toBe('concerning')
      expect(result!.dayLabel).toBe('Wednesday')
    })
  })

  describe('standout polarity', () => {
    it('falls back to the highest-scoring nailed session when nothing is concerning', () => {
      const analyses = [
        row('tuesday',  74, 'close'),
        row('saturday', 91, 'nailed', 88, 2),
        row('sunday',   85, 'nailed'),
      ]
      const result = pickSpotlightSession(analyses, week3, 3)
      expect(result).not.toBeNull()
      expect(result!.polarity).toBe('standout')
      expect(result!.dayLabel).toBe('Saturday')
      expect(result!.type).toBe('long')
      expect(result!.totalScore).toBe(91)
    })

    it('does not pick standout when only close sessions exist', () => {
      // 'close' is not in either target verdict list — no spotlight.
      const analyses = [row('tuesday', 70, 'close'), row('wednesday', 68, 'close')]
      expect(pickSpotlightSession(analyses, week3, 3)).toBeNull()
    })

    it('picks the best nailed when multiple nailed exist', () => {
      const analyses = [
        row('tuesday',  82, 'nailed'),
        row('saturday', 95, 'nailed'),
        row('sunday',   88, 'nailed'),
      ]
      const result = pickSpotlightSession(analyses, week3, 3)
      expect(result).not.toBeNull()
      expect(result!.dayLabel).toBe('Saturday')
      expect(result!.totalScore).toBe(95)
    })
  })

  describe('numeric coercion', () => {
    it('coerces hr_in_zone_pct and ef_trend_pct strings to numbers', () => {
      // Supabase numeric columns can come back as strings depending on driver config.
      const analyses: RunAnalysisRow[] = [
        {
          session_day:    'week_3_wednesday',
          total_score:    38,
          verdict:        'off_target',
          hr_in_zone_pct: '42.5' as unknown as number,
          ef_trend_pct:   '-8.2' as unknown as number,
        },
      ]
      const result = pickSpotlightSession(analyses, week3, 3)
      expect(result).not.toBeNull()
      expect(result!.hrInZonePct).toBeCloseTo(42.5)
      expect(result!.efTrendPct).toBeCloseTo(-8.2)
    })
  })
})

// ─── In-flight framing (today is not "missed" at noon) ─────────────────────
// Locks the brand-corrosive bug where a noon weekly report counted today's
// not-yet-run session as missed. Today is in flight until midnight; the prompt
// must frame today's still-to-do sessions as present-tense intent.

const baseReportData: WeeklyReportData = {
  sessionsCompleted:   2,
  sessionsPlanned:     4,
  totalKmActual:       18,
  totalKmPlanned:      36,
  acuteChronicRatio:   1.0,
  zoneDisciplineScore: 82,
  avgRpe:              5.2,
  dominantFlag:        'ok',
  primaryInsight:      'solid_week',
}

const minimalPlan: Plan = {
  meta: { race_name: 'Test Race', race_distance_km: 10, race_date: '2026-12-31' } as any,
  weeks: [{}, {}, {}, {}] as any,
} as Plan

describe('buildWeeklyReportPrompt — today-in-flight framing', () => {
  it('compares against end of yesterday, not today, on a mid-day Tuesday', () => {
    const prompt = buildWeeklyReportPrompt(
      baseReportData,
      minimalPlan,
      3,
      'Sam',
      'Tuesday',
      /* sessionsPlannedToDate (Mon only) */ 1,
      /* plannedKmToDate (Mon only) */ 8,
      [`Tuesday: easy (8km) (today, still to do)`, 'Saturday: long (18km)'],
      /* missedSessionTypes */ [],
    )
    expect(prompt).toMatch(/due by end of yesterday/)
    expect(prompt).not.toMatch(/due by Tuesday/)
    expect(prompt).toMatch(/Today is in flight/)
    expect(prompt).toMatch(/today, still to do/)
  })

  it('renders the in-flight few-shot when today still has work and the week is solid', () => {
    const prompt = buildWeeklyReportPrompt(
      baseReportData,
      minimalPlan,
      3,
      undefined,
      'Tuesday',
      1,
      8,
      [`Tuesday: easy (8km) (today, still to do)`],
      [],
    )
    // The in-flight example's headline should be the example surfaced to the model
    expect(prompt).toMatch(/Two down, one to go today/)
  })

  it('falls back to standard solid_week framing when today has no remaining work', () => {
    const prompt = buildWeeklyReportPrompt(
      baseReportData,
      minimalPlan,
      3,
      undefined,
      'Tuesday',
      1,
      8,
      ['Saturday: long (18km)'],   // no "(today, still to do)"
      [],
    )
    expect(prompt).not.toMatch(/Two down, one to go today/)
    // Still in-flight (today not over), so the solid-week midweek variant fires
    expect(prompt).toMatch(/Good start — stay the course|Solid week/)
  })

  it('does not apply in-flight framing when dayOfWeek is undefined (pre-week preview)', () => {
    const prompt = buildWeeklyReportPrompt(baseReportData, minimalPlan, 3)
    expect(prompt).not.toMatch(/in flight/)
    expect(prompt).not.toMatch(/due by end of yesterday/)
  })
})
