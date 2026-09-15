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

// ── Added 2026-09-15 by `npm run test:liveness` (TEST-LIVENESS-BATTERY-01).
//
// These three mutations left this file green, and they were invisible until the
// harness's span finder was fixed — it had been taking `computeReadiness`'s
// PARAMETER-object brace as the function body, so the battery reached this
// subject zero times and the file reported UNPROVEN rather than weak.
describe('§59 — the baseline gate needs BOTH metrics, and the HRV edge counts', () => {
  const fullWindow = (over: Partial<DailyHealthSample> = {}): DailyHealthSample[] =>
    Array.from({ length: READINESS.BASELINE_WINDOW_DAYS }, (_, i) => ({
      sampleDate: `2026-06-${String(i + 1).padStart(2, '0')}`,
      rhrBpm: 50, hrvMs: 60, sleepHours: 7.5, ...over,
    }))

  it('needs BOTH RHR and HRV windows full — one alone is not a baseline', () => {
    // `rhrSamples.length >= N && hrvSamples.length >= N` — flipping that `&&` to
    // `||` lets a runner with a full RHR window and NO HRV data establish a
    // baseline, and every HRV-derived comparison below then runs against a
    // baseline built from nothing.
    const rhrOnly = fullWindow().map(d => ({ ...d, hrvMs: null }))
    expect(computeReadiness(rhrOnly, { rhrBpm: 50, hrvMs: null, sleepHours: 7.5 }).hasBaseline)
      .toBe(false)
    const hrvOnly = fullWindow().map(d => ({ ...d, rhrBpm: null }))
    expect(computeReadiness(hrvOnly, { rhrBpm: null, hrvMs: 60, sleepHours: 7.5 }).hasBaseline)
      .toBe(false)
    expect(computeReadiness(fullWindow(), { rhrBpm: 50, hrvMs: 60, sleepHours: 7.5 }).hasBaseline)
      .toBe(true)
  })

  it('low HRV is decided against the SAMPLE SD, and the edge sits where that puts it', () => {
    // The window alternates 55/65 over 14 days: mean 60, SAMPLE SD (n-1) 5.19 —
    // not the population 5, which is what I assumed first and the test said no.
    // So the decline edge is 60 - 1 x 5.19 = 54.81, and the assertions bracket it.
    //
    // ⚠️ The `<=` in `today.hrvMs <= baseline - (DECLINE_SD * sd)` is NOT killable
    // through this API and is recorded as equivalent in the liveness baseline:
    // `detail` reports `hrvSd` ROUNDED to 2dp, so the edge a caller can
    // reconstruct (54.81) is not the edge the engine used (54.8113...). The two
    // differ only on a float no runner's HRV lands on.
    const spread = fullWindow().map((d, i) => ({ ...d, hrvMs: i % 2 === 0 ? 55 : 65 }))
    const at = (hrvMs: number) =>
      computeReadiness(spread, { rhrBpm: 50, hrvMs, sleepHours: 7.5 }).isLowHRV
    expect(at(54.8), 'just inside the decline edge').toBe(true)
    expect(at(54.9), 'just outside it').toBe(false)
    expect(at(48)).toBe(true)
    expect(at(60)).toBe(false)
  })

  it('reports the baseline and SD the decision was made from', () => {
    const spread = fullWindow().map((d, i) => ({ ...d, hrvMs: i % 2 === 0 ? 55 : 65 }))
    const d = computeReadiness(spread, { rhrBpm: 50, hrvMs: 60, sleepHours: 7.5 }).detail!
    expect(d.hrvBaseline).toBe(60)
    // 5.19, not 5: the SAMPLE standard deviation. Pinned because the decline
    // threshold is computed from it, and a caller assuming population SD would
    // place the edge 0.19 ms too high on this window.
    expect(d.hrvSd).toBe(5.19)
  })
})
