import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * 🔒 STRENGTH-ROW-OPEN-01 — /api/strength/opened, the SLT's demand measure for demo media (STRENGTH-MEDIA-01).
 * One ops event per call, carrying a catalogue id and nothing else; the strength gate applies; an unknown id is refused,
 * so the table cannot fill with free text.
 */
const S = vi.hoisted(() => ({ isAdmin: true, events: [] as { kind: string; payload: unknown; user: unknown }[] }))
vi.mock('@/lib/supabase/getUserFromRequest', () => ({ getUserFromRequest: async () => ({ id: 'u1' }) }))
vi.mock('@/lib/trial', () => ({ getUserTier: async () => 'paid' }))
vi.mock('@/lib/ops/recordOpsEvent', () => ({ recordOpsEvent: async (kind: string, payload: unknown, user: unknown) => { S.events.push({ kind, payload, user }) } }))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => {
      const q: Record<string, unknown> = {}
      Object.assign(q, { select: () => q, eq: () => q, maybeSingle: async () => ({ data: { is_admin: S.isAdmin }, error: null }) })
      return q
    },
  }),
}))

const post = async (body: unknown) => {
  const { POST } = await import('@/app/api/strength/opened/route')
  const res = await POST(new Request('https://x/api/strength/opened', { method: 'POST', body: JSON.stringify(body) }) as never)
  return { status: res.status }
}
beforeEach(() => { S.isAdmin = true; S.events = [] })

describe('POST /api/strength/opened', () => {
  it('records one event with the catalogue id only', async () => {
    expect((await post({ exercise_id: 'front_squat' })).status).toBe(200)
    expect(S.events).toEqual([{ kind: 'strength_exercise_opened', payload: { exercise_id: 'front_squat' }, user: 'u1' }])
  })
  it('🔴 an id that is not in the catalogue is refused and records nothing', async () => {
    expect((await post({ exercise_id: 'my notes about my knee' })).status).toBe(422)
    expect((await post({})).status).toBe(422)
    expect(S.events).toEqual([])
  })
  it('🔴 behind the strength gate: a runner it is not released to records nothing', async () => {
    S.isAdmin = false
    expect((await post({ exercise_id: 'front_squat' })).status).not.toBe(200)
    expect(S.events).toEqual([])
  })
})

describe('the session screen reports each exercise once per visit', () => {
  const src = readFileSync('components/dashboard/StrengthSessionScreen.tsx', 'utf8')
  it('only on opening, not on closing', () => {
    expect(src).toContain('onClick={() => { if (!open) onOpen?.(); setOpen(o => !o) }}')
  })
  it('🔴 deduplicated per exercise', () => {
    expect(src).toContain('if (opened.current.has(id)) return; opened.current.add(id); onExerciseOpen(id)')
  })
  it('Dashboard wires it to the fire-and-forget call', () => {
    expect(readFileSync('app/dashboard/DashboardClient.tsx', 'utf8')).toContain('onExerciseOpen={recordStrengthExerciseOpened}')
    expect(readFileSync('components/dashboard/useStrengthPlan.ts', 'utf8')).toMatch(/authedFetch\('\/api\/strength\/opened'[\s\S]{0,200}\.catch\(\(\) => \{\}\)/)
  })
})
