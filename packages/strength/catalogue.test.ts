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
    // 13 → 10 at STRENGTH-KNEE-DOMINANT-01: the three single-leg RDLs are hinges by movement.
    expect(CATALOGUE.filter(e => e.pattern === 'single_leg').length).toBeGreaterThanOrEqual(10)
  })
  it('every plyometric is high impact and counted in contacts', () => {
    expect(CATALOGUE.filter(e => e.pattern === 'plyometric').every(e => e.impact === 'high' && e.measure === 'contacts')).toBe(true)
  })
  it('cues are runner-facing copy: 1–3 short sentences, no em dash', () => {
    const bad = CATALOGUE.filter(e => e.cues.length < 1 || e.cues.length > 3 || e.cues.some(c => c.includes('—') || !/[.!?]$/.test(c) || c.length > 80))
    expect(bad.map(e => e.id)).toEqual([])
  })
  it('🔴 every single-leg entry is knee-dominant (it trains the quads); hip-dominant unilateral work is a hinge', () => {
    expect(CATALOGUE.filter(e => e.pattern === 'single_leg' && !e.muscles.includes('quads')).map(e => e.id)).toEqual([])
  })
  it('reviewed by the strength seat (2026-10-17); any edit after that goes back to the board', () => {
    expect(CATALOGUE_REVIEW_STATUS).toBe('reviewed')
  })
  it('🔴 every pattern that fills a main slot keeps a main-eligible entry with no kit at all', () => {
    for (const p of ['single_leg', 'hinge', 'upper_push', 'upper_pull'] as Pattern[]) {
      expect(CATALOGUE.some(e => e.pattern === p && !e.not_main && e.equipment.some(o => o.every(t => t === 'bodyweight'))), p).toBe(true)
    }
  })
  it('🔴 a name that promises kit needs that kit (no "banded" or "goblet" move for bodyweight only)', () => {
    const bad = CATALOGUE.filter(e => /banded|goblet|weighted|dumbbell|kettlebell|barbell/i.test(e.name)
      && e.equipment.some(o => o.every(t => t === 'bodyweight')))
    expect(bad.map(e => e.id)).toEqual([])
  })
  it('🔴 a cue never states an effort number: the dose line owns RIR', () => {
    expect(CATALOGUE.filter(e => e.cues.some(c => /\b(reps? short|in reserve|RIR|to failure)\b/i.test(c))).map(e => e.id)).toEqual([])
  })
})
