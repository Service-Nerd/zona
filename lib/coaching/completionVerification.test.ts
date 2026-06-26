import { describe, it, expect } from 'vitest'
import {
  isVerifiedCompletion,
  isBareStubCompletion,
} from './completionVerification'

describe('isVerifiedCompletion', () => {
  it('returns true when an activity link is present (Strava)', () => {
    expect(isVerifiedCompletion({ status: 'complete', strava_activity_id: 12345 })).toBe(true)
  })

  it('returns true when an activity link is present (HealthKit)', () => {
    expect(isVerifiedCompletion({
      status: 'complete',
      apple_health_uuid: '959F9902-EE8F-4AD2-B2B2-06CBFC94B569',
    })).toBe(true)
  })

  it('returns true when an RPE is present (no activity)', () => {
    expect(isVerifiedCompletion({ status: 'complete', rpe: 5 })).toBe(true)
  })

  it('returns true when a fatigue tag is present (no activity, no RPE)', () => {
    expect(isVerifiedCompletion({ status: 'complete', fatigue_tag: 'Fine' })).toBe(true)
  })

  it('returns true for skipped completions (skip-with-reason carries fatigue_tag)', () => {
    expect(isVerifiedCompletion({ status: 'skipped' })).toBe(true)
  })

  it('returns FALSE for the 2026-06-26 phantom completion shape', () => {
    // The exact row from the incident: id 5d13a19b. status complete,
    // session_day sun, every other field null. No activity, no RPE,
    // no fatigue, no HR. This is the shape Wave 2B must reject.
    expect(isVerifiedCompletion({
      status:                'complete',
      rpe:                   null,
      fatigue_tag:           null,
      avg_hr:                null,
      strava_activity_id:    null,
      apple_health_uuid:     null,
      strava_activity_name:  null,
      strava_activity_km:    null,
    })).toBe(false)
  })

  it('returns false for null/undefined input', () => {
    expect(isVerifiedCompletion(null)).toBe(false)
    expect(isVerifiedCompletion(undefined)).toBe(false)
  })

  it('treats empty-string activity name as no signal', () => {
    expect(isVerifiedCompletion({
      status: 'complete',
      strava_activity_name: '',
    })).toBe(false)
  })
})

describe('isBareStubCompletion', () => {
  it('matches the exact 2026-06-26 phantom shape', () => {
    expect(isBareStubCompletion({
      status: 'complete', rpe: null, fatigue_tag: null,
      avg_hr: null, strava_activity_id: null,
      apple_health_uuid: null, strava_activity_name: null,
      strava_activity_km: null,
    })).toBe(true)
  })

  it('does NOT match a skipped row (skipped is not a bare stub)', () => {
    expect(isBareStubCompletion({ status: 'skipped' })).toBe(false)
  })

  it('does NOT match a verified completion', () => {
    expect(isBareStubCompletion({ status: 'complete', rpe: 7 })).toBe(false)
  })
})
