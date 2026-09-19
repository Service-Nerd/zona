import { describe, it, expect } from 'vitest'
import { renderGuidance, guidanceContextFromSession } from './renderGuidance'

// Untested with a production caller (`DashboardClient`). The whole point of the
// module is that a raw `{{token}}` never reaches a runner, and the AI enricher
// is an untrusted producer of that text — so the cases that matter are the
// MALFORMED ones, not the happy path.

describe('renderGuidance', () => {
  it('1. substitutes tokens, with or without inner whitespace', () => {
    const ctx = { session_zone: 'Zone 2', session_distance: 12 }
    expect(renderGuidance('Run {{session_distance}} km at {{ session_zone }}.', ctx))
      .toBe('Run 12 km at Zone 2.')
  })

  it('2. uses the |fallback when the value is missing, null or empty', () => {
    expect(renderGuidance('Hold {{goal_pace|your easy pace}}.', {})).toBe('Hold your easy pace.')
    expect(renderGuidance('Hold {{goal_pace|your easy pace}}.', { goal_pace: null })).toBe('Hold your easy pace.')
    expect(renderGuidance('Hold {{goal_pace|your easy pace}}.', { goal_pace: '' })).toBe('Hold your easy pace.')
  })

  it('3. NO RAW BRACE EVER REACHES THE RUNNER — malformed syntax included', () => {
    const outs = [
      renderGuidance('Run for {{session_duration}} minutes.', {}),
      renderGuidance('Target {{ unknown_token }} today.', {}),
      renderGuidance('Broken {{oops and more', {}),
      renderGuidance('Half {{closed} brace', {}),
    ]
    for (const o of outs) expect(o).not.toMatch(/\{\{/)
  })

  it('4. tidies the gaps an empty substitution leaves behind', () => {
    expect(renderGuidance('Run for {{session_duration}} minutes.', {})).toBe('Run for minutes.')
    expect(renderGuidance('Easy {{x}} , then home .', {})).toBe('Easy, then home.')
  })

  it('5. zero is a VALUE, not a missing field', () => {
    // `if (!value)` here would have silently dropped a legitimate 0 and fallen
    // through to the fallback. The implementation tests for null/undefined/''.
    expect(renderGuidance('{{session_distance}} km', { session_distance: 0 })).toBe('0 km')
    expect(renderGuidance('RPE {{session_rpe|unset}}', { session_rpe: 0 })).toBe('RPE 0')
  })

  it('6. empty, null and undefined text render as an empty string, never a crash', () => {
    expect(renderGuidance('', {})).toBe('')
    expect(renderGuidance(null, {})).toBe('')
    expect(renderGuidance(undefined, {})).toBe('')
  })
})

describe('guidanceContextFromSession', () => {
  it('7. maps a session onto the token names and survives a null session', () => {
    const ctx = guidanceContextFromSession({
      session: { pace_target: '5:30 /km', zone: 'Zone 3', distance_km: 8, rpe_target: 5, label: 'Tempo' },
      zone2Ceiling: 150, maxHR: 186, restingHR: 55, goalPace: '5:00 /km',
    })
    expect(ctx.session_pace).toBe('5:30 /km')
    expect(ctx.session_zone).toBe('Zone 3')
    expect(ctx.zone2_ceiling).toBe(150)
    expect(() => guidanceContextFromSession({ session: null })).not.toThrow()
    expect(guidanceContextFromSession({ session: undefined }).session_pace).toBeUndefined()
  })
})
