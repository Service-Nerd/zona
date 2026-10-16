// STRENGTH-ENGINE-01 — the strength profile grid the sweep and its gate share.
// Every focus × length × frequency × experience, across four equipment tiers and
// the three special cases (impact-restricting injury, bone flag, unavailable days).

import type { EquipmentTag, StrengthProfile } from '@/packages/strength'

export const EQUIPMENT_TIERS: EquipmentTag[][] = [
  ['bodyweight'],
  ['bands'],
  ['dumbbells', 'bench', 'bands'],
  ['barbell', 'rack', 'bench', 'dumbbells', 'kettlebell', 'box', 'pullup_bar', 'cable', 'machines', 'bands'],
]

export function strengthProfileGrid(): StrengthProfile[] {
  const out: StrengthProfile[] = []
  for (const focus of ['running', 'general'] as const)
    for (const session_minutes of [30, 45, 60] as const)
      for (const sessions_per_week of [1, 2, 3, 4] as const)
        for (const experience of ['new', 'some', 'regular'] as const)
          for (let t = 0; t < EQUIPMENT_TIERS.length; t++) {
            const special = (focus === 'running' ? 0 : 1) + session_minutes + sessions_per_week + t
            out.push({
              focus, session_minutes, sessions_per_week, experience,
              equipment: EQUIPMENT_TIERS[t],
              injury_tags: special % 5 === 0 ? ['achilles'] : special % 7 === 0 ? ['knee', 'back'] : [],
              bone_health_flag: special % 6 === 0,
              unavailable_days: special % 4 === 0 ? ['wed'] : [],
            })
          }
  return out
}
