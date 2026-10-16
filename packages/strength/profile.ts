// STRENGTH-ENGINE-01 — the ONLY way untrusted input becomes a StrengthProfile.
//
// 🔒 Security: the API route hands request JSON straight here. Every field is
// whitelisted, unknown keys are refused (not ignored, so a typo is loud), arrays
// are de-duplicated and length-bounded, and nothing is echoed back verbatim.

import type { Day, EquipmentTag, Experience, Focus, InjuryTag, SessionMinutes, SessionsPerWeek, StrengthProfile } from './types'

const FOCUS: readonly Focus[] = ['running', 'general']
const MINUTES: readonly SessionMinutes[] = [30, 45, 60]
const PER_WEEK: readonly SessionsPerWeek[] = [1, 2, 3, 4]
const EXPERIENCE: readonly Experience[] = ['new', 'some', 'regular']
export const EQUIPMENT_TAGS: readonly EquipmentTag[] = ['bodyweight', 'bands', 'dumbbells', 'kettlebell', 'bench', 'box', 'pullup_bar', 'barbell', 'rack', 'cable', 'machines']
export const INJURY_TAGS: readonly InjuryTag[] = ['knee', 'itb', 'achilles', 'shin', 'calf', 'plantar', 'hip', 'hamstring', 'back', 'shoulder']
const DAYS: readonly Day[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const KEYS = new Set(['focus', 'session_minutes', 'sessions_per_week', 'equipment', 'experience', 'injury_tags', 'bone_health_flag', 'unavailable_days'])

export type ProfileParseResult = { ok: true; profile: StrengthProfile } | { ok: false; field: string }

function enumList<T extends string>(v: unknown, allowed: readonly T[], max: number): T[] | null {
  if (v === undefined) return []
  if (!Array.isArray(v) || v.length > max) return null
  if (!v.every(x => typeof x === 'string' && (allowed as readonly string[]).includes(x))) return null
  return Array.from(new Set(v as T[]))
}

export function parseStrengthProfile(input: unknown): ProfileParseResult {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return { ok: false, field: 'profile' }
  const o = input as Record<string, unknown>
  for (const k of Object.keys(o)) if (!KEYS.has(k)) return { ok: false, field: 'unknown' }
  if (!FOCUS.includes(o.focus as Focus)) return { ok: false, field: 'focus' }
  if (!MINUTES.includes(o.session_minutes as SessionMinutes)) return { ok: false, field: 'session_minutes' }
  if (!PER_WEEK.includes(o.sessions_per_week as SessionsPerWeek)) return { ok: false, field: 'sessions_per_week' }
  if (!EXPERIENCE.includes(o.experience as Experience)) return { ok: false, field: 'experience' }
  const equipment = enumList(o.equipment, EQUIPMENT_TAGS, EQUIPMENT_TAGS.length)
  if (!equipment) return { ok: false, field: 'equipment' }
  const injury_tags = enumList(o.injury_tags, INJURY_TAGS, INJURY_TAGS.length)
  if (!injury_tags) return { ok: false, field: 'injury_tags' }
  const unavailable_days = enumList(o.unavailable_days, DAYS, 6)
  if (!unavailable_days) return { ok: false, field: 'unavailable_days' }
  if (o.bone_health_flag !== undefined && typeof o.bone_health_flag !== 'boolean') return { ok: false, field: 'bone_health_flag' }
  return {
    ok: true,
    profile: {
      focus: o.focus as Focus,
      session_minutes: o.session_minutes as SessionMinutes,
      sessions_per_week: o.sessions_per_week as SessionsPerWeek,
      equipment: equipment.length ? equipment : ['bodyweight'],
      experience: o.experience as Experience,
      injury_tags,
      bone_health_flag: o.bone_health_flag === true,
      unavailable_days,
    },
  }
}
