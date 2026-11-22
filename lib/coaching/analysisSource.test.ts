import { describe, it, expect } from 'vitest'
import { analysisSourceFor } from './analysisSource'

describe('RUN-ANALYSIS-SOURCE-LABEL-01 — analysisSourceFor', () => {
  it('🔴 an Apple Health activity is labelled apple_health, not the column default', () => expect(analysisSourceFor('apple_health')).toBe('apple_health'))
  it('a Strava activity is strava', () => expect(analysisSourceFor('strava')).toBe('strava'))
  it('absent or unknown provenance falls back to the column default', () => { expect(analysisSourceFor(null)).toBe('strava'); expect(analysisSourceFor(undefined)).toBe('strava'); expect(analysisSourceFor('manual')).toBe('strava') })
})
