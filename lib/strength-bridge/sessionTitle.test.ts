import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { strengthSessionTitle, STRENGTH_KIND_TITLE } from './display'

/** 🔴 Design Board 2026-10-19 — a strength session is named by what it HOLDS (S10 Am.3, S3 Am.2). */
const it_ = (exercise_id: string, light?: true) => ({ exercise_id, sets: 2, reps: 10, rir: light ? 3 : 2, rest_s: 60, per_side: false, ...(light ? { light } : {}) })
describe('strengthSessionTitle', () => {
  it('a full body with upper work is "Full body"', () => {
    expect(strengthSessionTitle({ kind: 'full_body', blocks: [{ role: 'main', items: [it_('goblet_squat')] }, { role: 'accessory', items: [it_('single_arm_dumbbell_row')] }] })).toBe('Full body')
  })
  it('🔴 a full body the clock left with no upper work is "Lower body", never "Full body"', () => {
    expect(strengthSessionTitle({ kind: 'full_body', blocks: [{ role: 'main', items: [it_('goblet_squat')] }, { role: 'core', items: [it_('suitcase_carry')] }] })).toBe('Lower body')
  })
  it('🔴 an upper session carrying light leg work says so', () => {
    expect(strengthSessionTitle({ kind: 'upper_core', blocks: [{ role: 'main', items: [it_('push_up')] }, { role: 'accessory', items: [it_('double_heel_raise', true)] }] })).toBe('Upper body and light legs')
  })
  it('otherwise the kind title', () => {
    expect(strengthSessionTitle({ kind: 'upper_core', blocks: [{ role: 'main', items: [it_('push_up')] }] })).toBe(STRENGTH_KIND_TITLE.upper_core)
  })
})

describe('🔴 no site names a session from its kind alone', () => {
  const walk = (d: string): string[] => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? (f === 'node_modules' ? [] : walk(p)) : /\.tsx?$/.test(f) && !/\.test\./.test(f) ? [p] : [] })
  it('STRENGTH_KIND_TITLE[…kind] appears only in its owner (and the session screen\'s mobility block label)', () => {
    const offenders = ['app', 'components', 'lib'].flatMap(walk)
      .filter(f => !f.endsWith('lib/strength-bridge/display.ts'))
      .filter(f => /STRENGTH_KIND_TITLE\[[^\]]*kind\]/.test(readFileSync(f, 'utf8')))
    expect(offenders).toEqual([])
  })
})
