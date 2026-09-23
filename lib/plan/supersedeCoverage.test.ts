// PLAN-WEEK-COLLISION-01 — the mechanical guard.
//
// `supersede.test.ts` proves the STAMP works. It cannot prove that every READ
// honours it, and a single unfiltered week-keyed read re-opens the defect on
// that surface alone — silently, because a stale completion looks exactly like
// a real one. There were 45 candidate sites across 18 files when this shipped;
// nobody is going to remember the rule on the 46th.
//
// So: a rule that holds only while someone remembers is not a rule. This walks
// the source and fails the build.
//
// ⚠️ FALSIFICATION-TESTED. `npm run verify` is only worth something if this can
// go red — see the final describe block, which builds a deliberately-unfiltered
// chain and asserts the classifier catches it. A guard that cannot fail is the
// decorative-config class this repo has shipped before.

import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { WEEK_KEYED_TABLES } from './supersede'

const ROOT = join(__dirname, '..', '..')
const SCAN_DIRS = ['app', 'lib']

/** Reads/writes that deliberately do NOT filter, each with the argument for it.
 *  An entry here is a DECISION, not a TODO. */
const ALLOWED: { file: string; why: string }[] = [
  // app/api/delete-account/route.ts was allowlisted here with the reason
  // "deletes every row for the user regardless of plan". IT DID NOT. It named
  // three tables out of twenty-four and there was no foreign key behind it, so
  // twenty-one tables survived every deletion (DB-USER-PURGE-01, 2026-09-23).
  // The entry is gone rather than reworded because the route now names NO
  // table: deletion is an ON DELETE CASCADE in the schema, so there is no chain
  // here to exempt. Coverage moved to `npm run check:db`, which asks the
  // database instead of trusting a sentence in an allowlist.
  {
    file: 'lib/coaching/reframeTier.ts',
    why: 'Counts how much history exists on a runner to choose the reframe data tier. That is a LIFETIME measure — a previous plan\'s logs are still signal about this runner, not noise.',
  },
]

function walk(dir: string): string[] {
  const out: string[] = []
  for (const e of readdirSync(dir)) {
    if (e === 'node_modules' || e === '.next' || e.startsWith('.')) continue
    const p = join(dir, e)
    if (statSync(p).isDirectory()) out.push(...walk(p))
    else if (/\.(ts|tsx)$/.test(e) && !/\.test\.tsx?$/.test(e)) out.push(p)
  }
  return out
}

interface Chain { file: string; line: number; table: string; body: string }

/** Pull each `.from('<table>')` chain out of a file, following the leading-dot
 *  continuation lines that Supabase's builder produces. */
export function extractChains(src: string, file: string): Chain[] {
  const lines = src.split('\n')
  const chains: Chain[] = []
  for (let i = 0; i < lines.length; i++) {
    const table = WEEK_KEYED_TABLES.find(t => lines[i].includes(`from('${t}')`))
    if (!table) continue
    const buf = [lines[i]]
    let j = i + 1
    // Follow builder continuations AND the comment lines interleaved between
    // them. The first cut stopped at the first comment, which truncated the
    // chain and made a correctly-filtered read look unfiltered — a guard that
    // reports the right answer for the wrong reason is one nobody trusts.
    while (j < lines.length && /^\s*(\.|\/\/|\/\*|\*)/.test(lines[j])) buf.push(lines[j++])
    chains.push({ file, line: i + 1, table, body: buf.join('\n') })
  }
  return chains
}

export type Verdict = 'write' | 'run-keyed' | 'needs-filter' | 'filtered'

/** THE RULE, in one place so the test and the falsification case share it. */
export function classify(body: string): Verdict {
  if (/\.(upsert|insert|delete|update)\(/.test(body)) return 'write'
  // A read that resolves a RUN, not a WEEK. Must NOT be filtered: `run_analysis`
  // is UNIQUE (user_id, apple_health_uuid), so hiding a superseded row makes the
  // caller believe none exists and the follow-up insert hits the constraint.
  if (/\.eq\('(apple_health_uuid|strava_activity_id|manual_uuid)'/.test(body)) return 'run-keyed'
  if (body.includes('superseded_at')) return 'filtered'
  return 'needs-filter'
}

const files = SCAN_DIRS.flatMap(d => walk(join(ROOT, d)))
const allChains = files.flatMap(f =>
  extractChains(readFileSync(f, 'utf8'), f.slice(ROOT.length + 1)))

describe('every week-keyed read honours superseded_at', () => {
  it('found chains to check (the scanner itself is alive)', () => {
    expect(allChains.length).toBeGreaterThan(20)
  })

  it('no unfiltered week-keyed read outside the argued allowlist', () => {
    const offenders = allChains
      .filter(c => classify(c.body) === 'needs-filter')
      .filter(c => !ALLOWED.some(a => c.file === a.file))
      .map(c => `${c.file}:${c.line} (${c.table})`)

    expect(
      offenders,
      `Unfiltered read of a week-keyed table. \`week_n\` is a WITHIN-PLAN coordinate, so ` +
      `without \`.is('superseded_at', null)\` this surface shows the PREVIOUS plan's rows ` +
      `(PLAN-WEEK-COLLISION-01). Add the filter, or add an argued entry to ALLOWED in this file.\n` +
      offenders.join('\n'),
    ).toEqual([])
  })

  it('every allowlist entry still exists and still carries a reason', () => {
    for (const a of ALLOWED) {
      expect(a.why.length, `${a.file} needs a reason, not a TODO`).toBeGreaterThan(40)
      expect(files.some(f => f.endsWith(a.file)), `${a.file} is allowlisted but gone`).toBe(true)
    }
  })
})

// ── Falsification. A guard that cannot go red is decoration. ────────────────
describe('the guard can fail', () => {
  it('catches an unfiltered week-keyed read', () => {
    const bad = `.from('session_completions')\n  .select('week_n')\n  .eq('user_id', uid)`
    expect(classify(bad)).toBe('needs-filter')
  })

  it('passes a filtered read', () => {
    const good = `.from('session_completions')\n  .select('week_n')\n  .eq('user_id', uid)\n  .is('superseded_at', null)`
    expect(classify(good)).toBe('filtered')
  })

  it('does not demand a filter on a write', () => {
    expect(classify(`.from('session_completions').upsert({ x: 1 })`)).toBe('write')
  })

  it('does not demand a filter on a run-keyed lookup', () => {
    const run = `.from('run_analysis').select('week_n').eq('user_id', uid).eq('apple_health_uuid', u)`
    expect(classify(run)).toBe('run-keyed')
  })

  it('the extractor follows multi-line builder chains', () => {
    const src = `const x = sb\n  .from('run_analysis')\n  .select('*')\n  .eq('user_id', u)\nconst y = 1`
    const [c] = extractChains(src, 'x.ts')
    expect(c.body).toContain(".eq('user_id', u)")
    expect(c.body).not.toContain('const y')
  })
})
