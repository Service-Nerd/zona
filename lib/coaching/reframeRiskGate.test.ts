import { describe, it, expect } from 'vitest'
import { assessReframeRiskGate, messageForReframeRiskReason } from './reframeRiskGate'

/**
 * Regression suite for the reframe risk gate.
 *
 * Doctrine: when these inputs fire, the reframe MUST be silenced.
 * brand.md § Reframe Voice — "Risk flags trump reframe."
 */

const CLEAN_INPUT = {
  currentSessionFlag: 'ok' as const,
  recentCompletionFlags: ['ok', 'ok', 'ok', 'ok', 'ok'] as const,
  recentFatigueTags: ['Fine', 'Fresh', 'Fine'] as const,
  hrDriftBpm: null,
  hrDriftPct: null,
}

describe('assessReframeRiskGate', () => {
  it('does not silence when no signals fire', () => {
    const r = assessReframeRiskGate(CLEAN_INPUT)
    expect(r.silenced).toBe(false)
    expect(r.reason).toBeNull()
    expect(r.message).toBeNull()
  })

  describe('session_flagged', () => {
    it('silences when this session is flagged', () => {
      const r = assessReframeRiskGate({ ...CLEAN_INPUT, currentSessionFlag: 'flag' })
      expect(r.silenced).toBe(true)
      expect(r.reason).toBe('session_flagged')
      expect(r.message).toBe(messageForReframeRiskReason('session_flagged'))
    })

    it('does not silence on watch flag alone', () => {
      const r = assessReframeRiskGate({ ...CLEAN_INPUT, currentSessionFlag: 'watch' })
      expect(r.silenced).toBe(false)
    })
  })

  describe('repeated_overload', () => {
    it('silences with two flagged sessions in last five', () => {
      const r = assessReframeRiskGate({
        ...CLEAN_INPUT,
        recentCompletionFlags: ['ok', 'flag', 'ok', 'flag', 'ok'],
      })
      expect(r.silenced).toBe(true)
      expect(r.reason).toBe('repeated_overload')
    })

    it('does not silence with one flagged session', () => {
      const r = assessReframeRiskGate({
        ...CLEAN_INPUT,
        recentCompletionFlags: ['ok', 'flag', 'ok', 'ok', 'ok'],
      })
      expect(r.silenced).toBe(false)
    })

    it('ignores flags outside the window', () => {
      const r = assessReframeRiskGate({
        ...CLEAN_INPUT,
        recentCompletionFlags: ['ok', 'ok', 'ok', 'ok', 'ok', 'flag', 'flag'],
      })
      // Only the first 5 are within the window; 2+ inside the window would silence
      expect(r.silenced).toBe(false)
    })
  })

  describe('fatigue_accumulation', () => {
    it('silences on three consecutive Heavy tags', () => {
      const r = assessReframeRiskGate({
        ...CLEAN_INPUT,
        recentFatigueTags: ['Heavy', 'Heavy', 'Heavy', 'Fine'],
      })
      expect(r.silenced).toBe(true)
      expect(r.reason).toBe('fatigue_accumulation')
    })

    it('silences on Wrecked + Heavy + Wrecked consecutive', () => {
      const r = assessReframeRiskGate({
        ...CLEAN_INPUT,
        recentFatigueTags: ['Wrecked', 'Heavy', 'Wrecked'],
      })
      expect(r.silenced).toBe(true)
      expect(r.reason).toBe('fatigue_accumulation')
    })

    it('does not silence when fatigue is broken by a Fine tag', () => {
      const r = assessReframeRiskGate({
        ...CLEAN_INPUT,
        recentFatigueTags: ['Heavy', 'Fine', 'Heavy', 'Heavy'],
      })
      expect(r.silenced).toBe(false)
    })

    it('does not silence on two consecutive Heavy', () => {
      const r = assessReframeRiskGate({
        ...CLEAN_INPUT,
        recentFatigueTags: ['Heavy', 'Heavy', 'Fine'],
      })
      expect(r.silenced).toBe(false)
    })
  })

  describe('severe_hr_drift', () => {
    it('silences when drift is >=15 bpm', () => {
      const r = assessReframeRiskGate({ ...CLEAN_INPUT, hrDriftBpm: 16 })
      expect(r.silenced).toBe(true)
      expect(r.reason).toBe('severe_hr_drift')
    })

    it('silences when drift is >=10%', () => {
      const r = assessReframeRiskGate({ ...CLEAN_INPUT, hrDriftPct: 0.11 })
      expect(r.silenced).toBe(true)
      expect(r.reason).toBe('severe_hr_drift')
    })

    it('does not silence when drift is 10 bpm', () => {
      const r = assessReframeRiskGate({ ...CLEAN_INPUT, hrDriftBpm: 10 })
      expect(r.silenced).toBe(false)
    })

    it('does not silence when drift is 7%', () => {
      const r = assessReframeRiskGate({ ...CLEAN_INPUT, hrDriftPct: 0.07 })
      expect(r.silenced).toBe(false)
    })
  })

  describe('priority order', () => {
    it('reports session_flagged before repeated_overload when both apply', () => {
      const r = assessReframeRiskGate({
        ...CLEAN_INPUT,
        currentSessionFlag: 'flag',
        recentCompletionFlags: ['flag', 'flag', 'ok', 'ok', 'ok'],
      })
      expect(r.reason).toBe('session_flagged')
    })

    it('reports repeated_overload before fatigue_accumulation when both apply', () => {
      const r = assessReframeRiskGate({
        ...CLEAN_INPUT,
        recentCompletionFlags: ['ok', 'flag', 'ok', 'flag', 'ok'],
        recentFatigueTags: ['Heavy', 'Heavy', 'Heavy'],
      })
      expect(r.reason).toBe('repeated_overload')
    })
  })
})
