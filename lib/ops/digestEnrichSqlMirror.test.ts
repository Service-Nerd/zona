import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ENRICHED_STATES } from './enrichHealth'

// OPS-DIGEST-ENRICH-WIRE-01 — THE DECLARED DUPLICATION, GIVEN A GATE.
//
// The daily ops digest is a cloud routine, not repo code, and it cannot call
// `GET /api/ops/enrich-health` because that endpoint requires `CRON_SECRET` and a
// routine has no way to hold one. So the routine's Q5B SQL MIRRORS the judgement in
// `enrichHealth.ts`: which states count as having voice, and which plans are not
// eligible at all.
//
// 🔴 A MIRRORED PREDICATE WITH A HUMAN IN BETWEEN IS THE `deloadCadence` /
// `tierResolution` class, and this repo has already paid 84 plans for it once. The
// item that shipped this wiring declared the duplication as a real risk and left it
// at a note. A note is not a mechanism, so this is the mechanism.
//
// ⚠️ WHAT IT CHECKS, PRECISELY: that the SQL recorded in the runbook compares
// `enrichment` against exactly the states this module names. Add a third enriched
// state to `ENRICHED_STATES` and this goes red, pointing at the runbook — which is
// where the re-application procedure lives.
//
// ⚠️ WHAT IT CANNOT CHECK, and the reason the runbook still matters: the LIVE
// routine. The prompt lives at claude.ai, outside this repo, and no test here can
// read it. The runbook is the canonical transcript of what was applied (byte-verified
// against the live prompt on 2026-10-02), so this gate catches the lib and the
// transcript drifting apart. Transcript-versus-live stays a by-hand step, and
// `subscriptionHealthConsumer.test.ts` names the same residual.

const RUNBOOK = join(__dirname, '..', '..', 'docs', 'runbooks', 'digest-enrichment-health.md')

/** The Q5B SQL as the runbook records it, from the heading to the terminating `from s;`. */
function q5bSql(): string {
  const src = readFileSync(RUNBOOK, 'utf8')
  const start = src.indexOf('Q5B — enrichment health, FLEET-WIDE and UNWINDOWED')
  if (start < 0) return ''
  const end = src.indexOf('from s;', start)
  if (end < 0) return ''
  return src.slice(start, end + 'from s;'.length)
}

/** Every single-quoted literal in an `in (...)` / `not in (...)` list against `enrichment`. */
function statesComparedWithIn(sql: string): Set<string> {
  const out = new Set<string>()
  for (const m of Array.from(sql.matchAll(/enrichment\s+(?:not\s+)?in\s*\(([^)]*)\)/g))) {
    for (const lit of Array.from(m[1]!.matchAll(/'([^']*)'/g))) out.add(lit[1]!)
  }
  return out
}

/** Every single-quoted literal compared with `<>` against `enrichment`. */
function statesComparedWithNotEqual(sql: string): Set<string> {
  const out = new Set<string>()
  for (const m of Array.from(sql.matchAll(/enrichment\s*<>\s*'([^']*)'/g))) out.add(m[1]!)
  return out
}

describe('the digest Q5B SQL mirrors enrichHealth.ts', () => {
  // ⚠️ THE VACUITY ARM, FIRST. A check whose population is empty passes every other
  // arm in the file, and this repo has shipped that exact green tick more than once.
  // Rename the runbook heading or the SQL and this fails rather than going quiet.
  it('finds the SQL block in the runbook at all', () => {
    const sql = q5bSql()
    expect(sql).not.toBe('')
    expect(sql).toContain('from plans p')
    expect(statesComparedWithIn(sql).size).toBeGreaterThan(0)
    expect(statesComparedWithNotEqual(sql).size).toBeGreaterThan(0)
  })

  it('counts exactly the ENRICHED_STATES as having voice', () => {
    expect(Array.from(statesComparedWithIn(q5bSql())).sort())
      .toEqual([...ENRICHED_STATES].sort())
  })

  // `NOT_ELIGIBLE` is private to the module on purpose — it is one value and the
  // comment explains it — so this arm pins the value the SQL excludes and the module
  // test (`enrichHealth.test.ts`) pins the behaviour. Both must move together.
  it('excludes exactly the ineligible state', () => {
    expect(Array.from(statesComparedWithNotEqual(q5bSql()))).toEqual(['skipped'])
  })

  // The window is the entire point of Q5B: Q5 is scoped to 7 days and a failed
  // enrichment is permanent. A `created_at >=` filter creeping in here would restore
  // the gap this closed, silently, while every other arm stayed green.
  it('has no date window', () => {
    expect(q5bSql()).not.toMatch(/created_at\s*>=/)
    expect(q5bSql()).not.toMatch(/interval/)
  })
})
