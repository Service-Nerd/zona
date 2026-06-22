import { describe, it, expect } from 'vitest'
import { computeReadiness, type DailyHealthSample } from './readinessBaseline'
import { READINESS } from './constants'

// A 14-day baseline window with stable, healthy RHR + HRV so the baseline is
// established and neither RHR nor HRV fires — isolating the DS-05 sleep-quality
// signal. RHR baseline 50, HRV baseline 60.
const baselineWindow: DailyHealthSample[] = Array.from(
  { length: READINESS.BASELINE_WINDOW_DAYS },
  (_, i) => ({
    sampleDate: `2026-06-${String(i + 1).padStart(2, '0')}`,
    rhrBpm:     50,
    hrvMs:      60,
    sleepHours: 7.5,
  }),
)

// Today's RHR/HRV sit comfortably inside baseline → only sleep can fire.
const calmToday = { rhrBpm: 48, hrvMs: 70 }

describe('DS-05 — sleep quality (isPoorSleepQuality)', () => {
  it('fires when total sleep is adequate but deep-sleep share is below the floor', () => {
    // 7h sleep, deep = 10 / (10+90+300) = 2.5% — well under the 10% floor.
    const r = computeReadiness(baselineWindow, {
      ...calmToday,
      sleepHours:  7,
      sleepStages: { deep: 10, rem: 90, light: 300, awake: 20 },
    })
    expect(r.hasBaseline).toBe(true)
    expect(r.isShortSleep).toBe(false)
    expect(r.isPoorSleepQuality).toBe(true)
    expect(r.detail.deepSleepPct).toBeLessThan(READINESS.DEEP_SLEEP_PCT_FLOOR)
  })

  it('does NOT fire when deep-sleep share is healthy', () => {
    // deep = 80 / (80+100+300) = 16.7% — normal.
    const r = computeReadiness(baselineWindow, {
      ...calmToday,
      sleepHours:  7.5,
      sleepStages: { deep: 80, rem: 100, light: 300, awake: 15 },
    })
    expect(r.isPoorSleepQuality).toBe(false)
  })

  it('does NOT fire when no stage breakdown is present (undifferentiated sleep)', () => {
    const r = computeReadiness(baselineWindow, {
      ...calmToday,
      sleepHours:  7,
      sleepStages: null,
    })
    expect(r.isPoorSleepQuality).toBe(false)
    expect(r.detail.deepSleepPct).toBeUndefined()
  })

  it('does NOT fire on short total sleep — that is the duration signal, not quality', () => {
    // 4h sleep with low deep%: isShortSleep owns this; quality stays silent so
    // the two signals do not double-count the same bad night.
    const r = computeReadiness(baselineWindow, {
      ...calmToday,
      sleepHours:  4,
      sleepStages: { deep: 5, rem: 40, light: 150, awake: 10 },
    })
    expect(r.isShortSleep).toBe(true)
    expect(r.isPoorSleepQuality).toBe(false)
  })

  it('stays dormant before the 14-day baseline is established', () => {
    const r = computeReadiness(baselineWindow.slice(0, 5), {
      ...calmToday,
      sleepHours:  7,
      sleepStages: { deep: 10, rem: 90, light: 300, awake: 20 },
    })
    expect(r.hasBaseline).toBe(false)
    expect(r.isPoorSleepQuality).toBe(false)
  })
})

// ENGINE-03-pre — RHR noise-hardening. `softeningWarranted` is the firing
// decision; a one-day RHR spike must no longer soften a session on its own.
// Baseline RHR ~50 (threshold ~57); the LAST-dated window sample is the "most
// recent prior day" the persistence check reads.
function rhrWindow(latestPriorRhr: number): DailyHealthSample[] {
  return Array.from({ length: READINESS.BASELINE_WINDOW_DAYS }, (_, i) => ({
    sampleDate: `2026-06-${String(i + 1).padStart(2, '0')}`,
    rhrBpm:     i === READINESS.BASELINE_WINDOW_DAYS - 1 ? latestPriorRhr : 50,
    hrvMs:      60,
    sleepHours: 7.5,
  }))
}

describe('ENGINE-03-pre — RHR noise-hardening (softeningWarranted)', () => {
  it('does NOT soften on a single elevated RHR reading (the bug)', () => {
    const r = computeReadiness(rhrWindow(50), { rhrBpm: 60, hrvMs: 70, sleepHours: 7.5 })
    expect(r.isElevatedRHR).toBe(true)        // signal still detected…
    expect(r.detail.rhrPersistent).toBe(false)
    expect(r.softeningWarranted).toBe(false)  // …but it must not fire alone
  })

  it('softens when RHR is elevated two days running (persistent)', () => {
    const r = computeReadiness(rhrWindow(60), { rhrBpm: 60, hrvMs: 70, sleepHours: 7.5 })
    expect(r.detail.rhrPersistent).toBe(true)
    expect(r.softeningWarranted).toBe(true)
  })

  it('softens when an elevated RHR is corroborated by low HRV (same day)', () => {
    const r = computeReadiness(rhrWindow(50), { rhrBpm: 60, hrvMs: 55, sleepHours: 7.5 })
    expect(r.detail.rhrPersistent).toBe(false)
    expect(r.isLowHRV).toBe(true)
    expect(r.softeningWarranted).toBe(true)
  })

  it('HRV and short sleep still fire on their own (behaviour unchanged)', () => {
    const lowHrv = computeReadiness(rhrWindow(50), { rhrBpm: 48, hrvMs: 55, sleepHours: 7.5 })
    expect(lowHrv.isElevatedRHR).toBe(false)
    expect(lowHrv.softeningWarranted).toBe(true)

    const shortSleep = computeReadiness(rhrWindow(50), { rhrBpm: 48, hrvMs: 70, sleepHours: 4 })
    expect(shortSleep.isShortSleep).toBe(true)
    expect(shortSleep.softeningWarranted).toBe(true)
  })
})
