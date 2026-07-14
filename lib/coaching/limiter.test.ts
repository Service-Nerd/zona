import { describe, it, expect } from 'vitest'
import { inferLimiter, type LimiterInputs } from './limiter'
import type { HrStreamSummary } from './streamAnalysis'
import type { PaceFadeSummary } from './paceAnalysis'

const baseInputs = (): LimiterInputs => ({
  sessionType:            'easy',
  actualAvgHr:            null,
  prescribedHrCeiling:    null,
  hrAboveCeilingPct:      null,
  hrBelowFloorPct:        null,
  streamSummary:          null,
  paceFadeSummary:        null,
  tempC:                  null,
  rpe:                    null,
  fatigueTag:             null,
  recentHighFatigueCount: 0,
  actualDistKm:           null,
  plannedDistKm:          null,
})

const paceFade = (overrides: Partial<PaceFadeSummary> = {}): PaceFadeSummary => ({
  firstHalfAvgPaceSecPerKm: 300,
  backHalfAvgPaceSecPerKm:  330,
  paceFadeSecPerKm:         30,
  paceFadePct:              0.1,
  splitsUsed:               10,
  sparse:                   false,
  ...overrides,
})

const stream = (overrides: Partial<HrStreamSummary> = {}): HrStreamSummary => ({
  firstThirdAvgHr: 140,
  lastThirdAvgHr:  155,
  hrDriftBpm:      15,
  hrDriftPct:      0.107,
  samplesCount:    600,
  coveragePerMin:  0.8,
  sparse:          false,
  ...overrides,
})

describe('inferLimiter', () => {
  it('returns null when no signal crosses any threshold', () => {
    expect(inferLimiter(baseInputs())).toBeNull()
  })

  // §71.3 — a confident wrong diagnosis is worse than silence. The limiter stays
  // silent on a race, an ultra-distance effort, or an athlete-reported injury —
  // even when a signal that would otherwise fire is present.
  describe('silence guards (§71)', () => {
    // A strong muscular signal that WOULD fire without a guard — the control.
    const wouldFireMuscular = (): LimiterInputs => ({
      ...baseInputs(),
      paceFadeSummary: paceFade({ paceFadeSecPerKm: 40 }),
      streamSummary:   stream({ hrDriftBpm: 2 }),
    })

    it('control: the muscular signal fires without any guard', () => {
      expect(inferLimiter(wouldFireMuscular())?.category).toBe('muscular')
    })

    it('returns null for a race regardless of signal', () => {
      expect(inferLimiter({ ...wouldFireMuscular(), sessionType: 'race' })).toBeNull()
    })

    it('returns null for an ultra-distance effort (≥ 50km)', () => {
      expect(inferLimiter({ ...wouldFireMuscular(), actualDistKm: 100 })).toBeNull()
    })

    it('returns null when an acute injury is flagged', () => {
      expect(inferLimiter({ ...wouldFireMuscular(), injuryFlagged: true })).toBeNull()
    })

    it('still fires just under the ultra threshold', () => {
      expect(inferLimiter({ ...wouldFireMuscular(), actualDistKm: 42 })?.category).toBe('muscular')
    })
  })

  describe('heat', () => {
    it('fires high-confidence when warm + HR over ceiling', () => {
      const r = inferLimiter({
        ...baseInputs(),
        tempC:               26,
        actualAvgHr:         162,
        prescribedHrCeiling: 148,
      })
      expect(r?.category).toBe('heat')
      expect(r?.confidence).toBe('high')
      expect(r?.reasoning).toMatch(/26°C/)
      expect(r?.reasoning).toMatch(/14bpm above/)
    })

    it('does not fire when temp is below the heat threshold', () => {
      const r = inferLimiter({
        ...baseInputs(),
        tempC:               18,
        actualAvgHr:         162,
        prescribedHrCeiling: 148,
        hrAboveCeilingPct:   55,
      })
      // Heat doesn't fire — should fall through to pacing
      expect(r?.category).toBe('pacing')
    })

    it('does not fire when HR is only marginally over ceiling', () => {
      const r = inferLimiter({
        ...baseInputs(),
        tempC:               24,
        actualAvgHr:         151,  // only 3bpm over, below 5bpm bar
        prescribedHrCeiling: 148,
      })
      expect(r).toBeNull()
    })
  })

  describe('recovery', () => {
    it('fires high-confidence when accumulation pattern + high RPE on easy', () => {
      const r = inferLimiter({
        ...baseInputs(),
        sessionType:            'easy',
        rpe:                    8,
        recentHighFatigueCount: 2,
      })
      expect(r?.category).toBe('recovery')
      expect(r?.confidence).toBe('high')
    })

    it('does not fire on a hard session — high RPE on tempo is expected', () => {
      const r = inferLimiter({
        ...baseInputs(),
        sessionType:            'tempo',
        rpe:                    8,
        recentHighFatigueCount: 2,
      })
      expect(r?.category).not.toBe('recovery')
    })
  })

  describe('aerobic', () => {
    it('fires high-confidence on dense stream with significant drift', () => {
      const r = inferLimiter({
        ...baseInputs(),
        streamSummary: stream({ hrDriftBpm: 14 }),
      })
      expect(r?.category).toBe('aerobic')
      expect(r?.confidence).toBe('high')
      expect(r?.reasoning).toMatch(/back third/)
    })

    it('drops to medium confidence when the stream is sparse', () => {
      const r = inferLimiter({
        ...baseInputs(),
        streamSummary: stream({ hrDriftBpm: 14, sparse: true }),
      })
      expect(r?.category).toBe('aerobic')
      expect(r?.confidence).toBe('medium')
    })

    it('does not fire below the drift threshold', () => {
      const r = inferLimiter({
        ...baseInputs(),
        streamSummary: stream({ hrDriftBpm: 8 }),
      })
      expect(r).toBeNull()
    })
  })

  describe('muscular', () => {
    it('fires when pace fades with HR holding flat', () => {
      const r = inferLimiter({
        ...baseInputs(),
        paceFadeSummary: paceFade({ paceFadeSecPerKm: 25 }),
        streamSummary:   stream({ hrDriftBpm: 4 }),  // HR effectively flat
      })
      expect(r?.category).toBe('muscular')
      expect(r?.confidence).toBe('high')
      expect(r?.reasoning).toMatch(/pace faded/)
    })

    it('does NOT fire when HR also drifted significantly', () => {
      const r = inferLimiter({
        ...baseInputs(),
        paceFadeSummary: paceFade({ paceFadeSecPerKm: 25 }),
        streamSummary:   stream({ hrDriftBpm: 14 }),
      })
      // Both fire → aerobic wins (engine led the breakdown)
      expect(r?.category).toBe('aerobic')
    })

    it('fires with no HR stream available', () => {
      const r = inferLimiter({
        ...baseInputs(),
        paceFadeSummary: paceFade({ paceFadeSecPerKm: 25 }),
        streamSummary:   null,
      })
      expect(r?.category).toBe('muscular')
    })

    it('drops to medium confidence on sparse splits', () => {
      const r = inferLimiter({
        ...baseInputs(),
        paceFadeSummary: paceFade({ paceFadeSecPerKm: 25, sparse: true }),
      })
      expect(r?.confidence).toBe('medium')
    })
  })

  describe('pacing', () => {
    it('fires on sustained HR above ceiling on easy day', () => {
      const r = inferLimiter({
        ...baseInputs(),
        sessionType:       'easy',
        hrAboveCeilingPct: 65,
      })
      expect(r?.category).toBe('pacing')
      expect(r?.confidence).toBe('medium')
    })

    it('does not fire on hard sessions — being above ceiling is the point', () => {
      const r = inferLimiter({
        ...baseInputs(),
        sessionType:       'intervals',
        hrAboveCeilingPct: 65,
      })
      expect(r?.category).not.toBe('pacing')
    })
  })

  describe('execution', () => {
    it('fires when a hard session drifts below the band', () => {
      const r = inferLimiter({
        ...baseInputs(),
        sessionType:      'tempo',
        hrBelowFloorPct:  60,
      })
      expect(r?.category).toBe('execution')
    })

    it('does not fire on easy sessions — below floor is fine there', () => {
      const r = inferLimiter({
        ...baseInputs(),
        sessionType:      'easy',
        hrBelowFloorPct:  60,
      })
      expect(r?.category).not.toBe('execution')
    })
  })

  describe('fueling', () => {
    it('fires on a long run cut short with high RPE', () => {
      const r = inferLimiter({
        ...baseInputs(),
        sessionType:    'long',
        rpe:            8,
        plannedDistKm:  22,
        actualDistKm:   18,
      })
      expect(r?.category).toBe('fueling')
      expect(r?.confidence).toBe('low')
      expect(r?.reasoning).toMatch(/4.0km short/)
    })

    it('does not fire when the long run was completed', () => {
      const r = inferLimiter({
        ...baseInputs(),
        sessionType:    'long',
        rpe:            8,
        plannedDistKm:  22,
        actualDistKm:   21.5,
      })
      expect(r?.category).not.toBe('fueling')
    })
  })

  describe('fatigue_tag fallback', () => {
    it('catches manual-only loggers who report Heavy', () => {
      const r = inferLimiter({
        ...baseInputs(),
        fatigueTag: 'Heavy',
      })
      expect(r?.category).toBe('fatigue_tag')
      expect(r?.confidence).toBe('low')
    })

    it('returns null for Fine/Fresh', () => {
      const r = inferLimiter({
        ...baseInputs(),
        fatigueTag: 'Fine',
      })
      expect(r).toBeNull()
    })
  })

  describe('priority', () => {
    it('prefers heat over pacing when both fire', () => {
      const r = inferLimiter({
        ...baseInputs(),
        tempC:               28,
        actualAvgHr:         162,
        prescribedHrCeiling: 148,
        hrAboveCeilingPct:   80,
      })
      expect(r?.category).toBe('heat')
    })

    it('prefers recovery over aerobic when both fire on an easy run', () => {
      const r = inferLimiter({
        ...baseInputs(),
        sessionType:            'easy',
        rpe:                    8,
        recentHighFatigueCount: 3,
        streamSummary:          stream({ hrDriftBpm: 14 }),
      })
      expect(r?.category).toBe('recovery')
    })
  })
})
