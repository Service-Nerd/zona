import { describe, it, expect } from 'vitest'
import { buildUserMessage } from './enrich'
import type { Plan, GeneratorInput } from '@/types/plan'

/**
 * PLAN-NOTE-SURFACE-01 (enricher consistency) — the "Why this plan" rationale notes
 * the runner already sees on the plan screen are fed to the AI enricher so its voice
 * stays consistent with them and does not paraphrase or contradict them. The prompt
 * reuses the single owner planRationaleNotes(); this asserts the wiring.
 */

const input = { athlete_name: 'A', race_distance_km: 10, goal: 'finish', current_weekly_km: 30, days_available: 4 } as unknown as GeneratorInput

const planWith = (metaExtra: Partial<Plan['meta']>): Plan => ({
  weeks: [{ n: 1, sessions: {} }],
  meta: { race_name: 'X', race_date: '2026-12-01', ...metaExtra },
} as unknown as Plan)

describe('enricher rationale context', () => {
  it('injects the plan-rationale notes with a stay-consistent / do-not-repeat instruction', () => {
    const msg = buildUserMessage(planWith({ terrain_effort_note: 'Off-road, effort leads.' }), input, false)
    expect(msg).toContain('Off-road, effort leads.')
    expect(msg).toMatch(/do NOT repeat or contradict/i)
    expect(msg).toMatch(/already shown to the runner/i)
  })

  it('adds no rationale line when the plan carries no notes (no empty scaffolding)', () => {
    const msg = buildUserMessage(planWith({}), input, false)
    expect(msg).not.toMatch(/already shown to the runner/i)
  })
})
