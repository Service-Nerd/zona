// ENRICH-PII-MINIMISE-01 — the runner's first name does not reach Anthropic.
//
// SLT 2026-09-20, Fried's amendment. The name went for voice personalisation
// only; removing it takes a direct identifier out of a third-party transfer at
// no product cost, because the model writes a token and we put the name back.
//
// ⚠️ THIS IS A GUARD, NOT A ONE-OFF CHECK. The failure mode is someone adding a
// thirteenth AI surface and interpolating the name because that is the obvious
// thing to do. The last test here reads the prompt builders and fails on it.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import {
  RUNNER_NAME_TOKEN, resolveRunnerName, resolveRunnerNameDeep, containsRunnerName,
} from './nameToken'
import { buildVoiceHeader } from './prompts/voiceRules'

describe('the name is put back after the model replies', () => {
  it('substitutes the token', () => {
    expect(resolveRunnerName(`Nice one, ${RUNNER_NAME_TOKEN}.`, 'Russell')).toBe('Nice one, Russell.')
  })

  it('handles several occurrences', () => {
    expect(resolveRunnerName(`${RUNNER_NAME_TOKEN}, listen. ${RUNNER_NAME_TOKEN}.`, 'Sam'))
      .toBe('Sam, listen. Sam.')
  })

  it('leaves text with no token untouched', () => {
    expect(resolveRunnerName('Kept it under control.', 'Russell')).toBe('Kept it under control.')
  })

  it('passes null and undefined straight through', () => {
    expect(resolveRunnerName(null, 'Russell')).toBeNull()
    expect(resolveRunnerName(undefined, 'Russell')).toBeUndefined()
  })
})

describe('NO NAME is the case that must read well, not the edge case', () => {
  it('drops the token and its punctuation rather than leaving a hole', () => {
    expect(resolveRunnerName(`Nice one, ${RUNNER_NAME_TOKEN}.`, null)).toBe('Nice one.')
    expect(resolveRunnerName(`${RUNNER_NAME_TOKEN}, ease it back.`, null)).toBe('ease it back.')
    expect(resolveRunnerName(`${RUNNER_NAME_TOKEN} eased it back.`, '')).toBe('eased it back.')
  })

  it('NEVER substitutes "Athlete" — that is the PROFILE-NAME-01 defect', () => {
    for (const n of [null, undefined, '', '   ']) {
      expect(resolveRunnerName(`Go on, ${RUNNER_NAME_TOKEN}.`, n)).not.toContain('Athlete')
      expect(resolveRunnerName(`Go on, ${RUNNER_NAME_TOKEN}.`, n)).not.toContain(RUNNER_NAME_TOKEN)
    }
  })

  it('never leaves a double space or a space before punctuation', () => {
    const out = resolveRunnerName(`Right ${RUNNER_NAME_TOKEN} , go.`, null)
    expect(out).not.toMatch(/ {2}/)
    expect(out).not.toMatch(/\s[.,!?]/)
  })
})

describe('deep resolve — the enrichment payload is an object, not a string', () => {
  it('resolves nested strings, arrays and objects', () => {
    const payload = {
      meta: { coach_intro: `Right ${RUNNER_NAME_TOKEN}, here it is.` },
      weeks: [{ label: 'Wk 1', coach_notes: [`Easy does it, ${RUNNER_NAME_TOKEN}.`, 'No token here'] }],
      n: 42, ok: true, nothing: null,
    }
    const out = resolveRunnerNameDeep(payload, 'Russell')
    expect(out.meta.coach_intro).toBe('Right Russell, here it is.')
    expect(out.weeks[0].coach_notes[0]).toBe('Easy does it, Russell.')
    expect(out.weeks[0].coach_notes[1]).toBe('No token here')
    expect(out.n).toBe(42); expect(out.ok).toBe(true); expect(out.nothing).toBeNull()
  })
})

describe('🔴 THE GUARD — no prompt builder may interpolate the name', () => {
  it('the voice header emits the TOKEN, never the name', () => {
    const header = buildVoiceHeader({ firstName: 'Russell' } as never)
    expect(header).toContain(RUNNER_NAME_TOKEN)
    expect(containsRunnerName(header, 'Russell')).toBe(false)
  })

  it('no prompt builder contains a bare ${firstName} or ${athlete_name} interpolation', () => {
    const dir = 'lib/coaching/prompts'
    const offenders: string[] = []
    for (const f of readdirSync(dir).filter(f => f.endsWith('.ts') && !f.includes('.test.'))) {
      const src = readFileSync(`${dir}/${f}`, 'utf8')
      // Interpolated INTO a template literal is the defect; passing it as a
      // typed field down to voiceRules is fine and is how every builder works.
      if (/\$\{\s*(firstName|input\.firstName|athlete_name|input\.athlete_name)\s*\}/.test(src)) {
        offenders.push(f)
      }
    }
    expect(offenders).toEqual([])
  })

  it('the plan enricher sends the token, not the name', () => {
    const src = readFileSync('lib/plan/enrich.ts', 'utf8')
    expect(src).toContain('RUNNER_NAME_TOKEN')
    expect(src).not.toContain('${input.athlete_name ?? \'Athlete\'}')
  })

  it('containsRunnerName is not fooled by a substring, and ignores tiny names', () => {
    expect(containsRunnerName('Sam ran well', 'Sam')).toBe(true)
    expect(containsRunnerName('Samuel ran well', 'Sam')).toBe(false) // word boundary
    expect(containsRunnerName('a nice run', 'A')).toBe(false)        // too short to match on
  })
})
