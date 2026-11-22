import { describe, it, expect } from 'vitest'
import { decideHrRetryReports, type HrRetryOutcome } from './hrRetryReport'

const o = (uuid: string, result: HrRetryOutcome['result'], extra: Partial<HrRetryOutcome> = {}): HrRetryOutcome => ({ uuid, result, ageHours: 5.4, ...extra })

describe('HR-RETRY-SILENT-01 — decideHrRetryReports', () => {
  it('🔴 an empty read and a failed read are reported as different things', () => {
    const { send } = decideHrRetryReports([o('a', 'empty'), o('b', 'error', { message: 'Protected health data is inaccessible' })], new Set())
    expect(send.map(s => s.result)).toEqual(['empty', 'error'])
    expect(send[1].message).toContain('Protected')
    expect(send[0].message).toBeNull()
  })
  it('🔴 the same outcome for the same run is reported once, across calls', () => {
    const first = decideHrRetryReports([o('a', 'empty')], new Set())
    expect(first.send).toHaveLength(1)
    const again = decideHrRetryReports([o('a', 'empty')], new Set(first.remember))
    expect(again.send).toHaveLength(0)
  })
  it('a found read is never reported (the activity row already carries hr_arrived_late_at)', () => {
    expect(decideHrRetryReports([o('a', 'found')], new Set()).send).toHaveLength(0)
  })
  it('a different error on the same run is a new report; the same error is not', () => {
    const seen = new Set(decideHrRetryReports([o('a', 'error', { message: 'locked' })], new Set()).remember)
    expect(decideHrRetryReports([o('a', 'error', { message: 'timeout' })], seen).send).toHaveLength(1)
    expect(decideHrRetryReports([o('a', 'error', { message: 'locked' })], seen).send).toHaveLength(0)
  })
  it('duplicates inside one batch collapse, and the report carries no run id', () => {
    const { send } = decideHrRetryReports([o('a', 'empty'), o('a', 'empty')], new Set())
    expect(send).toHaveLength(1)
    expect(JSON.stringify(send)).not.toContain('"a"')
  })
  it('age is rounded and never negative', () => {
    expect(decideHrRetryReports([o('a', 'empty', { ageHours: -3 })], new Set()).send[0].age_hours).toBe(0)
  })
})
