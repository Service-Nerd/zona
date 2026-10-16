import { describe, it, expect } from 'vitest'
import { CATALOGUE, CATALOGUE_BY_ID, CATALOGUE_REVIEW_STATUS, PATTERN_REGION } from './catalogue'
import type { Pattern } from './types'

/** STRENGTH-ENGINE-01 — the catalogue is deep, consistent, and covers every runner's kit. */
const training = CATALOGUE.filter(e => e.pattern !== 'warmup' && e.pattern !== 'mobility')
const TRAINING_PATTERNS = Object.keys(PATTERN_REGION).filter(p => PATTERN_REGION[p as Pattern] !== 'prep') as Pattern[]

describe('strength catalogue', () => {
  it('is deep: at least 80 training exercises', () => { expect(training.length).toBeGreaterThanOrEqual(80) })
  it('ids are unique and the lookup is complete', () => {
    expect(new Set(CATALOGUE.map(e => e.id)).size).toBe(CATALOGUE.length)
    expect(CATALOGUE_BY_ID.size).toBe(CATALOGUE.length)
  })
  it('every regress/progress link exists and stays in its pattern', () => {
    const bad = CATALOGUE.flatMap(e => [e.regress_to, e.progress_to].filter(Boolean).map(id => ({ e, to: CATALOGUE_BY_ID.get(id!) })))
      .filter(({ e, to }) => !to || to.pattern !== e.pattern).map(({ e }) => e.id)
    expect(bad).toEqual([])
  })
  it('every training pattern can be done with nothing but bodyweight', () => {
    const missing = TRAINING_PATTERNS.filter(p => !CATALOGUE.some(e => e.pattern === p && e.equipment.some(o => o.length === 1 && o[0] === 'bodyweight')))
    expect(missing).toEqual([])
  })
  it('running focus gets single-leg work in every lower-body pattern that can be single-leg', () => {
    for (const p of ['single_leg', 'hinge', 'calf', 'hip_abduction', 'plyometric'] as Pattern[]) {
      expect(CATALOGUE.some(e => e.pattern === p && e.unilateral), p).toBe(true)
    }
    expect(CATALOGUE.filter(e => e.pattern === 'single_leg').length).toBeGreaterThanOrEqual(12)
  })
  it('every plyometric is high impact and counted in contacts', () => {
    expect(CATALOGUE.filter(e => e.pattern === 'plyometric').every(e => e.impact === 'high' && e.measure === 'contacts')).toBe(true)
  })
  it('cues are runner-facing copy: 1–3 short sentences, no em dash', () => {
    const bad = CATALOGUE.filter(e => e.cues.length < 1 || e.cues.length > 3 || e.cues.some(c => c.includes('—') || !/[.!?]$/.test(c) || c.length > 80))
    expect(bad.map(e => e.id)).toEqual([])
  })
  it('🔴 is marked DRAFT until the founder and the strength seat have reviewed it', () => {
    expect(CATALOGUE_REVIEW_STATUS).toBe('draft')
  })
})
