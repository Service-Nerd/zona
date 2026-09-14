import { describe, it, expect } from 'vitest'
import { checkAdjustmentTriggers } from './planAdjustment'
import {
  LONG_RUN_SHORTFALL_REDUCE_PCT,
  TAPER_PROTECTION_WEEKS,
} from './constants'
import type { Session } from '@/types/plan'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ENGINE-02 — long-run shortfall trigger.
// We exercise it through the public checkAdjustmentTriggers() entry point so the
// test also proves trigger priority + guards don't swallow it. The input below is
// deliberately "quiet" on every higher-priority signal (no fatigue, flat load
// ratio, no HR/EF data) so long_run_shortfall is the only thing that can fire.

const longSession = (km: number): Session => ({
  type: 'long',
  label: 'Long run',
  detail: null,
  distance_km: km,
})

const restSession = (): Session => ({
  type: 'rest',
  label: 'Rest',
  detail: null,
})

// 7-session week (mon→sun) with rest days everywhere except sun = long.
// RESHAPE-FIX-WAVE1: checkAdjustmentTriggers enforces a 7-element array of
// valid sessions at entry; tests must match the contract the engine sees in
// production. Rest sentinels here are the same shape the rule engine emits
// for empty days.
const longRunWeek = (longKm: number): Session[] => [
  restSession(), restSession(), restSession(),
  restSession(), restSession(), restSession(),
  longSession(longKm),
]

// §66 Amendment 1 — the duration-anchored sibling. A beginner's long run carries
// `duration_mins` with `distance_km` ABSENT (SESSION-KM-01: 95.8% of their
// sessions), which is the shape the trigger could not see at all until now.
const longSessionMins = (mins: number): Session => ({
  type: 'long',
  label: 'Long run',
  detail: null,
  duration_mins: mins,
} as unknown as Session)

const longRunWeekMins = (mins: number): Session[] => [
  restSession(), restSession(), restSession(),
  restSession(), restSession(), restSession(),
  longSessionMins(mins),
]

// A baseline input with all higher-priority triggers neutralised and guards open.
// Override per-test as needed.
const baseInput = () => ({
  currentWeekN: 6,
  totalWeeks: 12, // 6 weeks remaining > TAPER_PROTECTION_WEEKS → guards open
  currentWeekSessions: longRunWeek(20),
  actualKm: 40,
  plannedKm: 40, // shadow load ~0
  priorWeeksKm: [40, 40, 40, 40], // acute:chronic ~1.0
  hrInZoneData: [], // zone discipline → null, zone_drift skipped
  efTrendPct: null, // ef_decline skipped
  adjustmentsThisWeek: 0,
  currentPhase: 'build' as const,
})

describe('ENGINE-02 — long_run_shortfall', () => {
  it('fires when 2 consecutive long runs finish under 82% of plan', () => {
    const result = checkAdjustmentTriggers({
      ...baseInput(),
      recentLongRunAnalyses: [
        { actualKm: 14, plannedKm: 20, weekN: 5 }, // 70%
        { actualKm: 13, plannedKm: 18, weekN: 4 }, // 72%
      ],
    })

    expect(result).not.toBeNull()
    expect(result!.trigger.type).toBe('long_run_shortfall')
    expect(result!.adjustmentType).toBe('reduce_volume')
    expect(result!.requiresConfirmation).toBe(true)

    // The long run is trimmed by the configured reduce pct (20 → 17).
    const longAfter = result!.sessionsAfter.find(s => s.type === 'long')
    expect(longAfter?.distance_km).toBe(
      Math.round(20 * LONG_RUN_SHORTFALL_REDUCE_PCT * 10) / 10,
    )
    // avgCompletionPct is reported in trigger detail (71% here).
    expect(result!.trigger.detail.avgCompletionPct).toBe(71)
  })

  it('does NOT fire on a single short long run', () => {
    const result = checkAdjustmentTriggers({
      ...baseInput(),
      recentLongRunAnalyses: [{ actualKm: 14, plannedKm: 20, weekN: 5 }],
    })
    expect(result).toBeNull()
  })

  it('does NOT fire when long runs are at/above 82% completion', () => {
    const result = checkAdjustmentTriggers({
      ...baseInput(),
      recentLongRunAnalyses: [
        { actualKm: 18, plannedKm: 20, weekN: 5 }, // 90%
        { actualKm: 17, plannedKm: 18, weekN: 4 }, // 94%
      ],
    })
    expect(result).toBeNull()
  })

  it('does NOT fire when the two shortfalls are not in consecutive weeks', () => {
    const result = checkAdjustmentTriggers({
      ...baseInput(),
      recentLongRunAnalyses: [
        { actualKm: 14, plannedKm: 20, weekN: 8 },
        { actualKm: 13, plannedKm: 18, weekN: 2 }, // 6-week gap → not a pattern
      ],
    })
    expect(result).toBeNull()
  })

  it('is suppressed inside the taper-protection window (protects the peak long run)', () => {
    const result = checkAdjustmentTriggers({
      ...baseInput(),
      currentWeekN: 12 - TAPER_PROTECTION_WEEKS + 1, // inside protection window
      recentLongRunAnalyses: [
        { actualKm: 14, plannedKm: 20, weekN: 9 },
        { actualKm: 13, plannedKm: 18, weekN: 8 },
      ],
    })
    expect(result).toBeNull()
  })
})

// RESHAPE-FIX-WAVE1 — defects 1 and 2 regression tests. These prove the
// engine's structural contracts hold: a malformed week is loud (Defect 1),
// and a make-up session is written into the freeDay slot (Defect 2).
describe('RESHAPE-FIX-WAVE1 — structural invariants', () => {
  it('throws when currentWeekSessions has fewer than 7 entries (Defect 1 contract)', () => {
    expect(() =>
      checkAdjustmentTriggers({
        ...baseInput(),
        currentWeekSessions: [longSession(20)], // legacy 1-entry shape
      }),
    ).toThrow(/7 entries/)
  })

  it('throws when a day slot is null (Defect 1 contract)', () => {
    const week = longRunWeek(20)
    ;(week as Array<Session | null>)[3] = null // thu vacant
    expect(() =>
      checkAdjustmentTriggers({
        ...baseInput(),
        currentWeekSessions: week as Session[],
      }),
    ).toThrow(/thu.*not a valid session/)
  })

  it('writes the make-up session INTO the freeDay slot, not appended (Defect 2)', () => {
    // Week: mon easy, tue rest, wed strength (skipped), thu rest (free slot),
    // fri easy, sat easy, sun long. User skipped wed strength with "Life got
    // busy" — engine should propose make-up at thu (the first free remaining
    // slot), landing in array index 3.
    const easy = (km: number): Session => ({
      type: 'easy', label: 'Easy run', detail: null, distance_km: km,
    })
    const strength = (): Session => ({
      type: 'strength', label: 'Mobility only', detail: null,
    })
    const week: Session[] = [
      easy(8),         // 0 mon
      restSession(),   // 1 tue
      strength(),      // 2 wed — this is what was skipped
      restSession(),   // 3 thu — this is the freeDay
      easy(6),         // 4 fri
      easy(5),         // 5 sat
      longSession(18), // 6 sun
    ]

    const result = checkAdjustmentTriggers({
      ...baseInput(),
      currentWeekSessions: week,
      skipSignal: {
        reason: 'Life got busy',
        sessionType: 'strength',
        sessionDay: 'wed',
        weekSessionsByDay: {
          mon: week[0], tue: week[1], wed: week[2], thu: week[3],
          fri: week[4], sat: week[5], sun: week[6],
        },
      },
    })

    expect(result).not.toBeNull()
    expect(result!.trigger.type).toBe('skip_with_reason')
    // Critical: the array stays length-7; the make-up replaces thu's rest.
    expect(result!.sessionsAfter).toHaveLength(7)
    expect(result!.sessionsAfter[3].type).toBe('strength')
    expect(result!.sessionsAfter[3].label).toMatch(/Make-up/)
    // Pre-fix bug would have appended at index 7 and left thu as rest.
    expect((result!.sessionsAfter as any)[7]).toBeUndefined()
    expect(result!.trigger.detail.freeDay).toBe('thu')
  })
})

// ─── §12 Amendment 1 / TRIGGER-AUDIT-01 — the zone_drift trigger ──────────────
//
// ⚠️ This trigger had NO coverage. Every existing test passed `hrInZoneData: []`,
// which makes the score null and skips the gate entirely, so the suite was green
// while the trigger fired on the wrong quantity in production.
//
// The defect: it gated on `zoneDisciplineScore < 50` — the km-weighted mean of
// `hr_in_zone_pct`, a BAND. §12 prescribes a CAP ("Easy runs are capped at the
// top of Z2"), so running BELOW Z2 breaks no principle. Measured 2026-09-13:
// 3 of 17 runs under that threshold were predominantly too EASY, and the trigger
// then silently rewrote every easy/long coach note to "Easy sessions trending
// hard". Same class as R30, but this one changes the PLAN, not a card.
describe('§12 Amendment 1 — zone_drift is directional', () => {
  const gentleWeek = [
    // A runner doing genuinely easy running: well BELOW the cap, nothing above it.
    { hrInZonePct: 17, aboveCeilingPct: 0,  actualLoadKm: 10 },
    { hrInZonePct: 47, aboveCeilingPct: 2,  actualLoadKm: 8 },
    { hrInZonePct: 52, aboveCeilingPct: 1,  actualLoadKm: 12 },
  ]
  const hotWeek = [
    // A runner turning easy runs into medium ones: over the cap for much of it.
    { hrInZonePct: 40, aboveCeilingPct: 47, actualLoadKm: 10 },
    { hrInZonePct: 30, aboveCeilingPct: 65, actualLoadKm: 8 },
    { hrInZonePct: 55, aboveCeilingPct: 23, actualLoadKm: 12 },
  ]

  it('does NOT fire on a runner who ran too EASY (the defect)', () => {
    // Every one of these sits under the old `< 50 in zone` gate, so the previous
    // implementation flagged them and told them they were "trending hard".
    const result = checkAdjustmentTriggers({ ...baseInput(), hrInZoneData: gentleWeek })
    expect(result?.trigger.type).not.toBe('zone_drift')
  })

  it('a week with ZERO time above the cap can never be drift', () => {
    const result = checkAdjustmentTriggers({
      ...baseInput(),
      hrInZoneData: [{ hrInZonePct: 17, aboveCeilingPct: 0, actualLoadKm: 10 }],
    })
    expect(result?.trigger.type).not.toBe('zone_drift')
  })

  it('DOES fire when the easy running actually sat above its ceiling', () => {
    const result = checkAdjustmentTriggers({ ...baseInput(), hrInZoneData: hotWeek })
    expect(result?.trigger.type).toBe('zone_drift')
  })

  it('the summary states what was measured, and it is now true', () => {
    const result = checkAdjustmentTriggers({ ...baseInput(), hrInZoneData: hotWeek })
    expect(result?.summary).toMatch(/above its zone ceiling/)
    // The old copy asserted "Easy sessions trending hard" even for the gentle
    // week. Whatever it says now must be derived from the measured direction.
    expect(result?.summary).toMatch(/\d+%/)
  })

  it('APPENDS its note instead of destroying the prescription', () => {
    // It assigned a fresh single-element array, deleting whatever the engine had
    // already put there — §24e's ultra fuelling cue, §96's overdo cue, §80's
    // time-on-feet note. A silent auto-applied adjustment was erasing coaching
    // the board had ruled on.
    const withNote = longRunWeek(20).map(s =>
      s.type === 'rest' ? s : { ...s, coach_notes: ['Fuel every 25–30 minutes.'] as [string] })
    const result = checkAdjustmentTriggers({
      ...baseInput(),
      currentWeekSessions: withNote,
      hrInZoneData: hotWeek,
    })
    expect(result?.trigger.type).toBe('zone_drift')
    const long = result!.sessionsAfter.find(s => s.type !== 'rest')!
    const notes = (long.coach_notes ?? []).filter(Boolean) as string[]
    expect(notes, 'the original prescription survives').toContain('Fuel every 25–30 minutes.')
    expect(notes.some(n => /HR ceiling enforced/.test(n)), 'and the cue is added').toBe(true)
  })

  it('does not stack its own note on repeat firings', () => {
    const alreadyFlagged = longRunWeek(20).map(s =>
      s.type === 'rest' ? s : { ...s, coach_notes: ['Zone 2 only. HR ceiling enforced: if HR climbs, slow down.'] as [string] })
    const result = checkAdjustmentTriggers({
      ...baseInput(),
      currentWeekSessions: alreadyFlagged,
      hrInZoneData: hotWeek,
    })
    const long = result!.sessionsAfter.find(s => s.type !== 'rest')!
    const notes = (long.coach_notes ?? []).filter(Boolean) as string[]
    expect(notes.filter(n => /HR ceiling enforced/.test(n)).length).toBe(1)
  })
})

// §66 AMENDMENT 1 — the shortfall is measured on the axis the session is
// anchored on (Coaching Board 2026-09-14, LR-SHORTFALL-DURATION-01).
//
// §66 as originally written said duration-primary long runs were "out of scope
// (no distance to fall short of)". True, and incomplete: §80 — written later —
// holds that a duration-anchored session's prescription IS its time on feet, so
// there IS something to fall short of. Measured on the 621-plan cohort grid
// before this change: 2,547 of 7,965 long runs (32.0%) were dropped, and the
// trigger was completely dead on 153 of 621 plans (24.6%).
describe('§66 Amendment 1 — duration-anchored long runs', () => {
  it('fires when 2 consecutive long runs finish under 82% of prescribed TIME', () => {
    const result = checkAdjustmentTriggers({
      ...baseInput(),
      currentWeekSessions: longRunWeekMins(90),
      recentLongRunAnalyses: [
        { actualKm: 9, plannedKm: null, actualMins: 62, plannedMins: 90, weekN: 5 }, // 69%
        { actualKm: 8, plannedKm: null, actualMins: 58, plannedMins: 80, weekN: 4 }, // 73%
      ],
    })
    expect(result, 'the trigger was dead for this cohort before §66 Amendment 1').not.toBeNull()
    expect(result!.trigger.type).toBe('long_run_shortfall')
    expect(result!.requiresConfirmation, '§66: a structural change is the runner\'s call').toBe(true)
  })

  it('trims in MINUTES and never writes a kilometre figure', () => {
    // THE SECOND GATE. The trim read `if (isLongRun(s) && s.distance_km)`, so a
    // firing trigger would have shown a confirmation tile promising a change
    // that did nothing. Writing km onto a duration-anchored session would also
    // convert the runner's plan to an axis it has never spoken in (§80).
    const result = checkAdjustmentTriggers({
      ...baseInput(),
      currentWeekSessions: longRunWeekMins(90),
      recentLongRunAnalyses: [
        { actualKm: null, plannedKm: null, actualMins: 62, plannedMins: 90, weekN: 5 },
        { actualKm: null, plannedKm: null, actualMins: 58, plannedMins: 80, weekN: 4 },
      ],
    })
    const longAfter = result!.sessionsAfter.find(s => s.type === 'long')
    expect(longAfter?.duration_mins).toBe(Math.round(90 * LONG_RUN_SHORTFALL_REDUCE_PCT))
    expect(longAfter?.distance_km, 'must stay absent — the plan does not speak in km').toBeUndefined()
    expect(String(longAfter?.coach_notes?.[0])).toContain('min')
    expect(String(longAfter?.coach_notes?.[0])).not.toContain('km')
  })

  it('a runner who completes the FULL time but slowly is NOT short', () => {
    // ⚠️ THE CASE THAT DECIDED THE AXIS. Deriving km from the pace band would
    // recover 100% of these sessions — and would report this runner short,
    // because §80 expects walk breaks and time on feet accumulates whether or
    // not every step is running. They did the session exactly as prescribed.
    const result = checkAdjustmentTriggers({
      ...baseInput(),
      currentWeekSessions: longRunWeekMins(90),
      recentLongRunAnalyses: [
        { actualKm: 9.5, plannedKm: null, actualMins: 90, plannedMins: 90, weekN: 5 },
        { actualKm: 8.9, plannedKm: null, actualMins: 80, plannedMins: 80, weekN: 4 },
      ],
    })
    expect(result, 'full time completed — reducing this runner would be punishing them for walking').toBeNull()
  })

  it('the same 82% governs both axes — parity, recorded as a default not a finding', () => {
    const justInside = checkAdjustmentTriggers({
      ...baseInput(),
      currentWeekSessions: longRunWeekMins(100),
      recentLongRunAnalyses: [
        { actualKm: null, plannedKm: null, actualMins: 83, plannedMins: 100, weekN: 5 },
        { actualKm: null, plannedKm: null, actualMins: 83, plannedMins: 100, weekN: 4 },
      ],
    })
    expect(justInside, '83% is above the 82% floor').toBeNull()

    const justOutside = checkAdjustmentTriggers({
      ...baseInput(),
      currentWeekSessions: longRunWeekMins(100),
      recentLongRunAnalyses: [
        { actualKm: null, plannedKm: null, actualMins: 81, plannedMins: 100, weekN: 5 },
        { actualKm: null, plannedKm: null, actualMins: 81, plannedMins: 100, weekN: 4 },
      ],
    })
    expect(justOutside).not.toBeNull()
  })

  it('DISTANCE still wins when the session carried one — no axis flip-flopping', () => {
    // A row carrying both must be judged on distance, because that is what the
    // session prescribed. Guards against the time axis quietly taking over.
    const result = checkAdjustmentTriggers({
      ...baseInput(),
      recentLongRunAnalyses: [
        // 95% of distance (fine) but only 60% of time — a fast run, not a short one.
        { actualKm: 19, plannedKm: 20, actualMins: 72, plannedMins: 120, weekN: 5 },
        { actualKm: 17, plannedKm: 18, actualMins: 68, plannedMins: 115, weekN: 4 },
      ],
    })
    expect(result, 'distance-anchored sessions are judged on distance').toBeNull()
  })

  it('a row comparable on NEITHER axis is still dropped', () => {
    const result = checkAdjustmentTriggers({
      ...baseInput(),
      currentWeekSessions: longRunWeekMins(90),
      recentLongRunAnalyses: [
        { actualKm: null, plannedKm: null, actualMins: null, plannedMins: null, weekN: 5 },
        { actualKm: null, plannedKm: null, actualMins: null, plannedMins: null, weekN: 4 },
      ],
    })
    expect(result).toBeNull()
  })
})

describe('the guard is against the REAL route, not a mirror of it', () => {
  // planAdjustment is pure and testable; the ROUTE is where the axes are
  // assembled, and the original defect lived there (`plannedKm:
  // session.distance_km ?? null`). A regression there is invisible to every
  // test above, which is why this reads the shipped source.
  const routeSrc = readFileSync(join(process.cwd(), 'app/api/adjust-plan/route.ts'), 'utf8')

  it('the route selects both axes from run_analysis', () => {
    expect(routeSrc).toContain('actual_load_mins, planned_load_mins')
  })

  it('the route no longer re-derives plannedKm from raw distance_km alone', () => {
    expect(
      /plannedKm:\s*\(s as any\)\?\.distance_km as number \| null \?\? null,/.test(routeSrc),
      'the raw-field derivation has come back — duration-anchored plans go blind again',
    ).toBe(false)
    expect(routeSrc).toContain('plannedMins:')
    expect(routeSrc).toContain('actualMins:')
  })

  it('analyse-run writes both axes', () => {
    const analyseSrc = readFileSync(join(process.cwd(), 'app/api/analyse-run/route.ts'), 'utf8')
    expect(analyseSrc).toContain('planned_load_mins:')
    expect(analyseSrc).toContain('actual_load_mins:')
    // Moving time, not elapsed — walking registers as movement (§80/Willy).
    expect(analyseSrc).toContain('activity.moving_time_s')
  })
})
