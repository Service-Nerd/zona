// ADJUST-TRIGGER-MANUAL-DEAD-01 — a trigger type with no producer can never fire, and
// became a marketing claim anyway.
//
// 🔴 `TriggerType` declared ELEVEN members and `'manual'` had **zero producers**: nothing in
// the repo ever constructed `{ type: 'manual' }`, and no stored `plan_adjustments` row
// carried it. The "Check now" button sets `body.manual`, which the route reads as `isManual`
// to gate throttling and confirmation — whatever actually fires carries its own type.
//
// ⚠️ IT WAS NOT HARMLESS. The SLT's "eleven live triggers" is this union's LENGTH, and the
// founder asked for those eleven to go on the website. One could never fire and two more are
// the runner telling us rather than us noticing, so the honest count of things we WATCH FOR
// is **eight**. **A dead union member turned into a claim about the product.**
//
// This is the `declared but no producer` class (`LoadShape.ariaLabel`, decorative config),
// and the point of this file is that the next one fails the build instead of reaching a
// marketing surface.
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { TRIGGER_TYPES, DETECTED_TRIGGER_TYPES } from './planAdjustment'

/** Every source file under lib/ and app/, walked — never a hand-written list, which is the
 *  defect shape this file exists to catch. */
function sources(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.next' || e.startsWith('.')) continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) sources(p, acc)
    else if (/\.(ts|tsx)$/.test(e) && !/\.test\.tsx?$/.test(e)) acc.push(p)
  }
  return acc
}

const FILES = [
  ...sources(join(process.cwd(), 'lib')),
  ...sources(join(process.cwd(), 'app')),
]
const BODIES = FILES.map(f => readFileSync(f, 'utf8'))

/** A producer CONSTRUCTS the trigger: `type: '<name>'` inside an object literal. */
const producerCount = (t: string) =>
  BODIES.reduce((n, src) => n + (src.match(new RegExp(`type:\\s*'${t}'`, 'g')) ?? []).length, 0)

describe('every declared trigger type has a producer', () => {
  it('🔴 the population is real — the walk found the engine', () => {
    // An empty or tiny file set would make every arm below pass on nothing, which is this
    // repo's `an empty population renders as a clean result` class, recorded today.
    expect(FILES.length).toBeGreaterThan(200)
    expect(BODIES.some(b => b.includes('checkAdjustmentTriggers'))).toBe(true)
  })

  it('🔴 THE DEFECT, AS A RULE: no member of the union is unconstructable', () => {
    const dead = TRIGGER_TYPES.filter(t => producerCount(t) === 0)
    expect(
      dead,
      `These trigger types can never fire — nothing constructs them. Delete the member, or ` +
      `wire a producer. A dead member is counted by anything that reads the union's ` +
      `LENGTH, which is how "eleven live triggers" reached a marketing brief: ${dead.join(', ')}`,
    ).toEqual([])
  })

  it("…and 'manual' specifically is gone", () => {
    expect(TRIGGER_TYPES as readonly string[]).not.toContain('manual')
  })

  it('the honest "things we watch for" count is 8, derived not typed', () => {
    // ⚠️ The number that may go on a website. It is DERIVED from the union minus the two
    // user-initiated members, so it cannot drift from the code the way "eleven" did.
    expect(DETECTED_TRIGGER_TYPES).toHaveLength(8)
    expect(TRIGGER_TYPES).toHaveLength(10)
    for (const t of ['skip_with_reason', 'session_reorder']) {
      expect(TRIGGER_TYPES as readonly string[]).toContain(t)
      expect(DETECTED_TRIGGER_TYPES as readonly string[]).not.toContain(t)
    }
  })

  it('⚠️ the detected set is a SUBSET, so a new trigger cannot be silently excluded', () => {
    for (const t of DETECTED_TRIGGER_TYPES) {
      expect(TRIGGER_TYPES as readonly string[]).toContain(t)
    }
    // And the only two exclusions are the declared ones — a third would mean someone
    // quietly decided a detector does not count as something we watch for.
    expect(TRIGGER_TYPES.length - DETECTED_TRIGGER_TYPES.length).toBe(2)
  })

  it('the array is the source and the type is derived from it', () => {
    // Two hand-maintained copies is what the compiler caught when 'manual' was deleted:
    // the backtest script still named it. One source now.
    const src = readFileSync(join(process.cwd(), 'lib/coaching/planAdjustment.ts'), 'utf8')
    expect(src).toContain('export const TRIGGER_TYPES = [')
    expect(src).toContain('export type TriggerType    = typeof TRIGGER_TYPES[number]')
    const script = readFileSync(join(process.cwd(), 'scripts/backtest-adjustment-triggers.ts'), 'utf8')
    // ⚠️ `toMatch(/\b…\b/)`, not `toContain`: `hollowTestShapes.test.ts` — shipped
    // earlier today — caught this exact line, because `toContain('TRIGGER_TYPES')`
    // also passes against `TRIGGER_TYPESX`. My own lint, on my own test, same day.
    expect(script).toMatch(/\bTRIGGER_TYPES\b/)
    // Its two hand-written copies are gone.
    expect(script).not.toMatch(/const ALL_TRIGGERS: TriggerType\[\] = \[\n/)
  })
})
