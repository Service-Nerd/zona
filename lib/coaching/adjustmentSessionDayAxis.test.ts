import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildAdjustmentSignals } from './adjustmentEngine'
import type { Session } from '@/types/plan'

/**
 * §12 Amendment 2 — `ADJUST-SESSIONDAY-PREFIX-01` (Coaching Board 2026-10-15).
 *
 * 🔴 THE DEFECT. `buildAdjustmentSignals` selected this week's analyses with
 * `(a.session_day ?? '').startsWith(`week_${weekN}_`)`. **Production has no such
 * value and never has:** 154 `run_analysis` rows, ZERO prefixed, every one a bare
 * day key, the oldest surviving row (2026-04-28) already bare, and 120 carrying
 * `hr_in_zone_pct`. So `hrInZoneData` was always empty and `efTrendPct` always
 * null, and §12's drift detector ran on nothing for every real runner.
 *
 * ⚠️ NOTHING FAILED, which is why it lasted. The writer's format changed, the
 * reader's filter did not, `.startsWith()` returned false, and a trigger quietly
 * stopped having inputs. `app/api/analyse-run/route.ts` still strips a
 * `week_${n}_` prefix on write, which is a silent no-op — the strip is harmless
 * and deliberately left alone, since removing it would reject any historical row
 * that still carries one.
 *
 * 🔑 THE CONTRADICTION LIVED THREE LINES APART IN ONE FILE, and that is the class
 * this file guards, not merely the instance. Two readers treated `session_day` as
 * a bare day; one expected a prefix. The last arm fails if any reader in
 * `adjustmentEngine.ts` ever disagrees with another about that field's shape
 * again.
 */

const easy = (day: string, hrTarget?: string): Session => ({
  day, type: 'easy', distance_km: 8, zone: 'Zone 2',
  ...(hrTarget ? { hr_target: hrTarget } : {}),
  label: 'Easy run', coach_notes: [],
} as unknown as Session)

/** A plan week in the shape `buildAdjustmentSignals` indexes: plan.weeks[weekN - 1]. */
const w = (n: number) => ({ n, weekly_km: 32, sessions: {} })

/** mon -> sun, as `checkAdjustmentTriggers` requires (7 entries). */
const fullWeek = (hrTarget?: string) => [
  easy('mon', hrTarget), easy('tue', hrTarget), easy('wed', hrTarget),
  easy('thu', hrTarget), easy('fri', hrTarget), easy('sat', hrTarget),
  easy('sun', hrTarget),
]

/** Production shape: a BARE day key, and `week_n` carrying the week. */
const analysis = (weekN: number, day: string, aboveCeilingPct: number) => ({
  week_n: weekN,
  session_day: day,
  hr_in_zone_pct: 60,
  hr_above_ceiling_pct: aboveCeilingPct,
  ef_trend_pct: null,
  actual_load_km: 8,
  planned_load_km: 8,
  actual_load_mins: 48,
  planned_load_mins: 48,
})

describe('§12 Am.2 — this week\'s analyses are selected on week_n', () => {
  it('🔴 feeds hrInZoneData from PRODUCTION-SHAPED rows (bare session_day)', () => {
    // The arm that would have caught the defect. Before the fix this returns an
    // empty array for these rows, because none of them is prefixed.
    const signals = buildAdjustmentSignals({
      weekN: 3,
      plan: { weeks: [w(1), w(2), w(3), w(4)] } as never,
      analyses: [
        analysis(3, 'tue', 30),
        analysis(3, 'thu', 10),
        analysis(2, 'tue', 90),   // a DIFFERENT week — must not leak in
      ] as never,
      completions: [] as never,
      weeklyLoad: new Map([[3, { linkedKm: 16, offPlanKm: 0, actualMins: 96 }]]) as never,
      isManual: false, adjustmentsThisWeek: 0,
    } as never)

    expect(
      signals.hrInZoneData.length,
      'hrInZoneData is empty on production-shaped rows — the week filter is matching nothing',
    ).toBe(2)
    expect(signals.hrInZoneData.map(d => d.aboveCeilingPct)).toEqual([30, 10])
  })

  it('does not leak an adjacent week in, which is what a loose filter would do', () => {
    const signals = buildAdjustmentSignals({
      weekN: 3,
      plan: { weeks: [w(1), w(2), w(3), w(4)] } as never,
      analyses: [analysis(2, 'tue', 90), analysis(4, 'wed', 95)] as never,
      completions: [] as never,
      weeklyLoad: new Map([[3, { linkedKm: 16, offPlanKm: 0, actualMins: 96 }]]) as never,
      isManual: false, adjustmentsThisWeek: 0,
    } as never)
    expect(signals.hrInZoneData.length, 'weeks 2 and 4 reached week 3\'s signal').toBe(0)
  })

  it('a prefixed legacy row is NOT required, and not rejected either', () => {
    // `week_n` is the axis, so a historical row that still carries a prefixed
    // `session_day` is selected on its week like any other. Asserted because the
    // write-side strip was left in place on exactly this reasoning.
    const legacy = { ...analysis(3, 'week_3_tue', 25) }
    const signals = buildAdjustmentSignals({
      weekN: 3,
      plan: { weeks: [w(1), w(2), w(3), w(4)] } as never,
      analyses: [legacy] as never,
      completions: [] as never,
      weeklyLoad: new Map([[3, { linkedKm: 16, offPlanKm: 0, actualMins: 96 }]]) as never,
      isManual: false, adjustmentsThisWeek: 0,
    } as never)
    expect(signals.hrInZoneData.length).toBe(1)
  })
})

/** An input that trips §12's drift rule: 4 rows, 30% above ceiling each. */
const drifting = (sessions: Session[]) => ({
  currentWeekN: 3, totalWeeks: 12, currentWeekSessions: sessions,
  linkedKm: 16, offPlanKm: 0, plannedKm: 16, priorWeeksKm: [16, 16, 16],
  hrInZoneData: Array.from({ length: 4 }, () => (
    { hrInZonePct: 60, aboveCeilingPct: 30, actualLoadKm: 8 })),
  efTrendPct: null, adjustmentsThisWeek: 0,
})

describe('§12 Am.2 — the drift note carries the ceiling it is asking for', () => {
  /**
   * ✋ Sims's amendment. A directive with no number is `listen to your body`
   * wearing a prescription's clothes.
   */
  it('cites the session\'s OWN hr_target, never a re-derived one', async () => {
    const { checkAdjustmentTriggers } = await import('./planAdjustment')
    const sessions = fullWeek('< 143 bpm')
    const proposed = checkAdjustmentTriggers({
      currentWeekN: 3, totalWeeks: 12, currentWeekSessions: sessions,
      linkedKm: 16, offPlanKm: 0, plannedKm: 16, priorWeeksKm: [16, 16, 16],
      hrInZoneData: [
        { hrInZonePct: 60, aboveCeilingPct: 30, actualLoadKm: 8 },
        { hrInZonePct: 60, aboveCeilingPct: 30, actualLoadKm: 8 },
        { hrInZonePct: 60, aboveCeilingPct: 30, actualLoadKm: 8 },
        { hrInZonePct: 60, aboveCeilingPct: 30, actualLoadKm: 8 },
      ],
      efTrendPct: null, adjustmentsThisWeek: 0,
    } as never)

    expect(proposed, 'no adjustment proposed — this input must trip §12\'s drift rule').not.toBeNull()
    expect(proposed!.trigger.type).toBe('zone_drift')
    const note = (proposed!.sessionsAfter[0].coach_notes ?? []).filter(Boolean).at(-1) as string
    expect(note, 'the note must quote the ceiling the engine already resolved').toContain('< 143 bpm')
    // ADR-015 / brand.md — a runner-facing sentence, so no em dash.
    expect(note).not.toContain('—')
  })

  it('falls back to the generic line when the plan has no HR targets at all', async () => {
    // ADR-011 §5 — an iPhone-only runner with no watch gets no HR targets. Telling
    // them to hold a number they cannot see is worse than the generic instruction.
    //
    // ⚠️ ASSERTED BEHAVIOURALLY. The first version of this arm was
    // `expect(src).toContain('ZONE_DRIFT_NOTE_GENERIC')` — a bare identifier matched
    // against source text, which `lib/hollowTestShapes.test.ts` (GATE-FALSIFY-01)
    // correctly failed as a hollow shape. It would have passed on a comment.
    const { checkAdjustmentTriggers } = await import('./planAdjustment')
    const proposed = checkAdjustmentTriggers(drifting(fullWeek()) as never)   // no hr_target
    expect(proposed!.trigger.type).toBe('zone_drift')
    const note = (proposed!.sessionsAfter[0].coach_notes ?? []).filter(Boolean).at(-1) as string
    expect(note, 'an HR-less plan must still get the generic instruction').toBe(
      'Zone 2 only. HR ceiling enforced: if HR climbs, slow down.')
  })

  /**
   * 🔴 THE WORD "ceiling" IS A CONTRACT WITH THE HOMEPAGE, and I learned that by
   * breaking it. `components/marketing/WhenItNotices.tsx:98` locates this session with
   * `(s.coach_notes?.[0] ?? '').includes('ceiling')` and renders the note on
   * `app/page.tsx`. My first cut of Sims's amendment read *"Zone 2 only. Keep HR
   * < 143 bpm"* — no "ceiling" — which would have silently emptied a live marketing
   * section. My own consumer check had recorded the website as "none".
   *
   * This arm makes the coupling VISIBLE so the next person cannot remove the word by
   * accident. The matcher itself is fragile (label-based classification on a marketing
   * surface, a recorded class) and is filed as `MARKETING-NOTE-COPY-MATCH-01`.
   */
  it('🔴 keeps the word "ceiling" — the HOMEPAGE finds this note by it', async () => {
    const { checkAdjustmentTriggers } = await import('./planAdjustment')
    for (const sessions of [fullWeek('< 143 bpm'), fullWeek()]) {
      const proposed = checkAdjustmentTriggers(drifting(sessions) as never)
      const note = (proposed!.sessionsAfter[0].coach_notes ?? []).filter(Boolean).at(-1) as string
      expect(
        note.includes('ceiling'),
        `"${note}" has no "ceiling" — WhenItNotices.tsx:98 will not find this session ` +
        'and the homepage section renders nothing.',
      ).toBe(true)
    }
  })
})

describe('🔴 §12 Am.2 — the CLASS: no two readers may disagree about session_day', () => {
  /**
   * The instance was a prefix filter. The class is **one file holding two
   * incompatible beliefs about a field's shape**, which is what let it survive:
   * `chronological()` and the session lookup read a bare day, and the week filter
   * read a prefix, three lines apart.
   *
   * ⚠️ Comments are prose and are stripped — the notes in that file quote the old
   * prefixed form deliberately, and a guard that cannot tell prose from code is
   * not a guard (this repo has shipped that mistake three times).
   */
  it('no reader in adjustmentEngine.ts treats session_day as prefixed', () => {
    const code = readFileSync('lib/coaching/adjustmentEngine.ts', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n')

    const prefixReaders = Array.from(
      code.matchAll(/session_day[^\n]*?(startsWith|\.replace\(|match\(|slice\()/g),
    ).map(m => m[0].trim())

    expect(
      prefixReaders,
      `a reader in adjustmentEngine.ts is parsing session_day as a composite value: ` +
      `${prefixReaders.join(' | ')}. It is a BARE DAY KEY in production (154 of 154 rows). ` +
      `Select on week_n instead — that is §12 Am.2, and the disagreement between two ` +
      `readers in this file is the defect it exists to prevent.`,
    ).toEqual([])
  })

  it('and the week filter selects on week_n, asserted on the shipped source', () => {
    const code = readFileSync('lib/coaching/adjustmentEngine.ts', 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n')
    expect(code).toMatch(/analyses\.filter\(\s*a\s*=>\s*a\.week_n\s*===\s*weekN\s*\)/)
  })
})
