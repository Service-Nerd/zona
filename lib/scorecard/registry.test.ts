import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { ALL_PREDICATES } from './predicates'

/** One owner per predicate: a unique id, a §, a class, a source and a description, and every
 *  predicate file is in the registry (a file nobody imports would be a predicate that never runs). */
describe('plan-read predicate registry', () => {
  it('every id is unique', () => {
    const ids = ALL_PREDICATES.map(p => p.id)
    expect(ids.filter((id, k) => ids.indexOf(id) !== k)).toEqual([])
  })
  it('every predicate names its §, class, source and description', () => {
    const bad = ALL_PREDICATES.filter(p => !/§|S\d|ADR-/.test(p.section) || !p.source || p.description.length < 20
      || !['NEW', 'FIX', 'NOTE-TRUTH'].includes(p.cls))
    expect(bad.map(p => p.id)).toEqual([])
  })
  it('every predicate file is registered', () => {
    const dir = join(__dirname, 'predicates')
    const index = readFileSync(join(dir, 'index.ts'), 'utf8')
    const files = readdirSync(dir).filter(f => f.endsWith('.ts') && f !== 'index.ts' && !f.endsWith('.test.ts'))
    expect(files.filter(f => !index.includes(`'./${f.replace(/\.ts$/, '')}'`))).toEqual([])
  })
  it('no predicate imports a producer (ARCH-ENG-004: compute from the plan, never re-call its logic)', () => {
    const dir = join(__dirname, 'predicates')
    const PRODUCERS = /from '(@\/lib\/plan\/|(\.\.\/)+(plan\/)?)(ruleEngine|engine|foundationCompose|foundationResize|stagedRacePlan|baseBuild\w*|walkRun\w*)'|generateStrengthPlan|generateMaintenanceBlock/
    const offenders = readdirSync(dir).filter(f => f.endsWith('.ts'))
      .filter(f => PRODUCERS.test(readFileSync(join(dir, f), 'utf8').replace(/^\s*(\/\/|\*).*$/gm, '')))
    expect(offenders).toEqual([])
  })
})
