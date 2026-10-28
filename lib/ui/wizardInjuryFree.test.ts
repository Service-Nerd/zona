import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { getStepSequence } from '@/app/dashboard/GeneratePlanScreen'

// WIZARD-INJURY-FREE-01 (SLT 2026-10-28, restoring SLT 2026-09-11): injury adaptation is never paid.
// The engine adapted on every plan, but the wizard asked only paid runners and sent the answer only
// for them, so a free runner's plan heard nothing about their injuries.

const WIZ = readFileSync(join(__dirname, '..', '..', 'app', 'dashboard', 'GeneratePlanScreen.tsx'), 'utf8')

describe('WIZARD-INJURY-FREE-01 — every runner is asked about injuries', () => {
  it('the injuries step is in the free sequence, and still in the paid one', () => {
    for (const goal of ['finish', 'time_target'] as const) {
      expect(getStepSequence(false, goal)).toContain('injuries')
      expect(getStepSequence(true, goal)).toContain('injuries')
    }
  })

  it('hard sessions and terrain stay paid until their tier is decided (WIZARD-PAID-INPUTS-TIER-01)', () => {
    expect(getStepSequence(false, 'finish')).not.toContain('terrain')
    expect(getStepSequence(false, 'finish')).not.toContain('hard-sessions')
  })

  it('the answer is sent for every tier: the payload line does not read paid access', () => {
    const line = WIZ.split('\n').find(l => /^\s*injury_history:/.test(l))
    expect(line, 'the injury_history payload line').toBeDefined()
    expect(line!).not.toMatch(/\bhasPaidAccess\b/)
  })

  it('the free-runner upsell no longer sells injury history', () => {
    const at = WIZ.indexOf('function TeaserCard(')
    const body = WIZ.slice(at, WIZ.indexOf('\n}\n', at))
    expect(at).toBeGreaterThan(-1)
    expect(body).not.toMatch(/injur/i)
  })
})
