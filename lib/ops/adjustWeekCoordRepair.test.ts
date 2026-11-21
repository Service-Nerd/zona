import { describe, it, expect } from 'vitest'
import { repairState } from './adjustWeekCoordRepair'

/** ADJUST-WEEK-COORD-01 — the hand-over predicate gives a different answer in each state. */
const REST = { type: 'rest' }
const foundationEasy = { type: 'easy', distance_km: 5, coach_notes: ['HR went high. Worth checking.'] }
const raceWeekEasy = { type: 'easy', distance_km: 8, coach_notes: [] }
const after = [foundationEasy, REST, foundationEasy, REST, foundationEasy, REST, REST]
const misplaced = { mon: foundationEasy, tue: REST, wed: foundationEasy, thu: REST, fri: foundationEasy, sat: REST, sun: REST }
const restored = { ...misplaced, mon: raceWeekEasy, wed: raceWeekEasy, fri: raceWeekEasy, tue: { type: 'rest', label: 'Rest' }, thu: { type: 'rest', label: 'Rest' }, sat: { type: 'rest', label: 'Rest' }, sun: { type: 'long', distance_km: 14 } }

describe('ADJUST-WEEK-COORD-01 — repairState', () => {
  it('the live state today: write present on every day, key wrong → NOT repaired', () => {
    const s = repairState({ writtenWeekSessions: misplaced, sessionsAfter: after, storedWeekN: 1, runnersWeekN: -3 })
    expect(s).toEqual({ writeStillPresentDays: 7, writtenDays: 7, keyCorrected: false, repaired: false })
  })

  it('week restored but key not corrected → still NOT repaired', () => {
    expect(repairState({ writtenWeekSessions: restored, sessionsAfter: after, storedWeekN: 1, runnersWeekN: -3 }).repaired).toBe(false)
  })

  it('key corrected but week not restored → still NOT repaired', () => {
    expect(repairState({ writtenWeekSessions: misplaced, sessionsAfter: after, storedWeekN: -3, runnersWeekN: -3 }).repaired).toBe(false)
  })

  it('both cleared → repaired', () => {
    expect(repairState({ writtenWeekSessions: restored, sessionsAfter: after, storedWeekN: -3, runnersWeekN: -3 }).repaired).toBe(true)
  })

  it('a missing written week is not "repaired by absence" unless the key is right', () => {
    expect(repairState({ writtenWeekSessions: undefined, sessionsAfter: after, storedWeekN: 1, runnersWeekN: -3 }).repaired).toBe(false)
  })
})
