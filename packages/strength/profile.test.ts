import { describe, it, expect } from 'vitest'
import { parseStrengthProfile } from './profile'

/** 🔒 STRENGTH-ENGINE-01 — the only door from request JSON to a profile. */
const OK = { focus: 'running', session_minutes: 45, sessions_per_week: 2, equipment: ['dumbbells'], experience: 'some' }

describe('parseStrengthProfile', () => {
  it('accepts a valid profile and defaults to bodyweight when no kit is ticked', () => {
    const r = parseStrengthProfile({ ...OK, equipment: [] })
    expect(r).toMatchObject({ ok: true, profile: { equipment: ['bodyweight'], bone_health_flag: false } })
  })
  it('de-duplicates lists', () => {
    const r = parseStrengthProfile({ ...OK, equipment: ['bands', 'bands'] })
    expect(r.ok && r.profile.equipment).toEqual(['bands'])
  })
  const bad: Array<[string, unknown]> = [
    ['not an object', 'x'], ['an array', [OK]], ['null', null],
    ['unknown key', { ...OK, is_admin: true }],
    ['prototype key', JSON.parse('{"focus":"running","session_minutes":45,"sessions_per_week":2,"experience":"some","__proto__":{"x":1}}')],
    ['focus', { ...OK, focus: 'yoga' }], ['minutes', { ...OK, session_minutes: 90 }],
    ['per week', { ...OK, sessions_per_week: 7 }], ['per week as a string', { ...OK, sessions_per_week: '2' }],
    ['experience', { ...OK, experience: 'elite' }], ['equipment', { ...OK, equipment: ['spaceship'] }],
    ['equipment not a list', { ...OK, equipment: 'dumbbells' }],
    ['oversized list', { ...OK, equipment: Array(50).fill('bands') }],
    ['injury', { ...OK, injury_tags: ['<script>'] }], ['days', { ...OK, unavailable_days: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] }],
    ['bone flag', { ...OK, bone_health_flag: 'yes' }],
  ]
  for (const [name, input] of bad) it(`🔴 refuses: ${name}`, () => { expect(parseStrengthProfile(input).ok).toBe(false) })
})
