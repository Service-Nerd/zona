// ZONE-SPLIT-CONFIG-01 — the run zone split uses the same guarded max and config ceiling as the plan's zones (§50, §14).
import { describe, it, expect, vi } from 'vitest'

const settings = vi.fn()
vi.mock('@/lib/plan', () => ({ readPlanJson: async () => ({ plan: { meta: { zone2_ceiling: 140, max_hr: null, age: null } }, error: null }) }))
import { getUserHRZones } from './strava'
import { GENERATION_CONFIG } from './plan/generationConfig'
import { tanakaMaxHR } from './plan/maxHrGuard'

const supabase = { from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: settings() }) }) }) }) }
const year = new Date().getUTCFullYear()
const ceiling = (rest: number, max: number) => Math.round(rest + (GENERATION_CONFIG.ZONES.Z2.karvonen_pct[1] / 100) * (max - rest))

describe('getUserHRZones', () => {
  it('🔴 a device-observed max below the age estimate is a floor: zones use the estimate (§50)', async () => {
    const age = 30, est = tanakaMaxHR(age)   // 187
    settings.mockReturnValue({ resting_hr: 55, max_hr: 175, max_hr_source: 'observed', birth_year: year - age })
    const z = await getUserHRZones(supabase, 'u')
    expect(z.maxHR).toBe(est)
    expect(z.zone2Ceiling).toBe(ceiling(55, est))
    expect(z.zone2Ceiling).toBeGreaterThan(ceiling(55, 175))
  })
  it('a max the runner confirmed is trusted, even below the estimate', async () => {
    settings.mockReturnValue({ resting_hr: 55, max_hr: 175, max_hr_source: 'user_confirmed', birth_year: year - 30 })
    expect((await getUserHRZones(supabase, 'u')).maxHR).toBe(175)
  })
  it('a max above the estimate (within tolerance) is trusted', async () => {
    settings.mockReturnValue({ resting_hr: 50, max_hr: 195, max_hr_source: 'observed', birth_year: year - 30 })
    expect((await getUserHRZones(supabase, 'u')).maxHR).toBe(195)
  })
  it('no age anywhere: the raw max stands, as before', async () => {
    settings.mockReturnValue({ resting_hr: 55, max_hr: 175, max_hr_source: 'observed', birth_year: null, date_of_birth: null })
    expect((await getUserHRZones(supabase, 'u')).maxHR).toBe(175)
  })
  it('date_of_birth is the fallback when birth_year is missing', async () => {
    settings.mockReturnValue({ resting_hr: 55, max_hr: 175, max_hr_source: 'observed', birth_year: null, date_of_birth: `${year - 30}-06-01` })
    expect((await getUserHRZones(supabase, 'u')).maxHR).toBe(tanakaMaxHR(30))
  })
  it('the ceiling is the top of Zone 2 from GENERATION_CONFIG, not a typed 0.70', async () => {
    settings.mockReturnValue({ resting_hr: 60, max_hr: 190, max_hr_source: 'user_confirmed', birth_year: year - 30 })
    expect((await getUserHRZones(supabase, 'u')).zone2Ceiling).toBe(ceiling(60, 190))
  })
})
