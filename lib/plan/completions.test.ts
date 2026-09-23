// COMPLETION-TOMBSTONE-01 — the write contract, and the gate that keeps it.
//
// The defect was not that one call site was wrong. It was that there were EIGHT
// of them, each passing `onConflict: 'user_id,week_n,session_day'` against a key
// that is not plan-scoped. Fixing eight and leaving the door open for a ninth is
// the shape this repo has recorded under five names, so the last describe block
// is the one that matters: it walks the source and fails the build.

import { describe, it, expect, vi } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { upsertCompletion } from './completions'

function fakeClient() {
  const calls: { fn: string; args: unknown }[] = []
  return {
    calls,
    rpc: (fn: string, args: unknown) => { calls.push({ fn, args }); return Promise.resolve({ error: null }) },
  }
}

describe('upsertCompletion — the write contract', () => {
  it('goes through the RPC, never the table', async () => {
    const c = fakeClient()
    await upsertCompletion(c as never, { week_n: 1, session_day: 'mon', status: 'complete' })
    expect(c.calls).toHaveLength(1)
    expect(c.calls[0].fn).toBe('upsert_session_completion')
  })

  it('OMITS a key the caller did not set — so a DS-07 edit cannot wipe logged body-state', async () => {
    const c = fakeClient()
    // The manual-log write deliberately leaves rpe/fatigue_tag out.
    await upsertCompletion(c as never, {
      week_n: 3, session_day: 'wed', status: 'complete', strava_activity_km: 7.5,
    })
    const p = (c.calls[0].args as { p: Record<string, unknown> }).p
    expect(Object.keys(p).sort()).toEqual(['session_day', 'status', 'strava_activity_km', 'week_n'])
    expect('rpe' in p).toBe(false)
  })

  it('SENDS an explicit null — so clearing an RPE still clears it', async () => {
    // ⚠️ THE OTHER HALF, and the one a `coalesce` merge would have broken.
    // `saveReflect` passes `rpe: null` when the runner removes their RPE. If the
    // RPC treated absent and null alike, clearing would silently no-op — a new
    // silent defect inside the fix for a silent defect.
    const c = fakeClient()
    await upsertCompletion(c as never, { week_n: 3, session_day: 'wed', rpe: null })
    const p = (c.calls[0].args as { p: Record<string, unknown> }).p
    expect('rpe' in p).toBe(true)
    expect(p.rpe).toBeNull()
  })

  it('never sends user_id — the database takes it from auth.uid()', async () => {
    const c = fakeClient()
    await upsertCompletion(c as never, { week_n: 1, session_day: 'mon', status: 'complete' })
    const p = (c.calls[0].args as { p: Record<string, unknown> }).p
    expect('user_id' in p).toBe(false)
  })

  it('returns the error rather than swallowing it', async () => {
    const c = { rpc: () => Promise.resolve({ error: { message: 'boom' } }) }
    const { error } = await upsertCompletion(c as never, { week_n: 1, session_day: 'mon' })
    expect(error?.message).toBe('boom')
  })
})

// ── THE GATE. Eight sites was the defect; nine is the same defect. ──────────
describe('no completion write bypasses the single owner', () => {
  const ROOT = join(__dirname, '..', '..')
  const walk = (dir: string): string[] => {
    const out: string[] = []
    for (const e of readdirSync(dir)) {
      if (e === 'node_modules' || e === '.next' || e.startsWith('.')) continue
      const p = join(dir, e)
      if (statSync(p).isDirectory()) out.push(...walk(p))
      else if (/\.(ts|tsx)$/.test(e) && !/\.test\.tsx?$/.test(e)) out.push(p)
    }
    return out
  }

  /**
   * A direct write that can land on an EXISTING row.
   *
   * ⚠️ `.insert(` IS DELIBERATELY NOT HERE. An insert creates a new row, which
   * is live by construction — it cannot touch a tombstone, so demanding a
   * superseded filter on it would be a false positive, and a gate that cries
   * wolf gets disabled. `upsert` and `update` both reach existing rows.
   */
  const WRITE = /from\(['"]session_completions['"]\)[\s\S]{0,80}?\.(upsert|update)\(/g

  it('finds files to scan (the scanner itself is alive)', () => {
    expect(walk(join(ROOT, 'app')).length + walk(join(ROOT, 'lib')).length).toBeGreaterThan(50)
  })

  it('every direct write to session_completions scopes itself to the LIVE plan', () => {
    const offenders: string[] = []
    for (const dir of ['app', 'lib']) {
      for (const file of walk(join(ROOT, dir))) {
        const rel = file.slice(ROOT.length + 1)
        // supersede.ts STAMPS rows; it does not write completions. It is the
        // one legitimate direct writer and its job is the opposite of this one.
        if (rel === 'lib/plan/supersede.ts') continue
        // The owner itself: its header DESCRIBES the pattern it replaced.
        if (rel === 'lib/plan/completions.ts') continue
        const src = readFileSync(file, 'utf8')
        WRITE.lastIndex = 0
        let m: RegExpExecArray | null
        while ((m = WRITE.exec(src))) {
          // ⚠️ THE RULE IS NOT "never write directly". Three SERVER-side writers
          // legitimately do — they hold a service-role client, so the RPC's
          // `auth.uid()` is null and unusable. What they may NOT do is touch a
          // tombstone. Each was missing `.is('superseded_at', null)` and each
          // could write to a dead row: an unlink that reports success and
          // changes nothing, a run attached where the runner never sees it.
          //
          // So the gate asks the question that actually matters: does this
          // statement scope itself to the live plan?
          // A fixed window, not "to the next blank line". The first cut used a
          // blank-line boundary and truncated a statement whose builder chain
          // had one in it — reporting a correctly-scoped write as an offender.
          // A guard that is wrong in the SAFE direction still gets switched off.
          const stmt = src.slice(m.index, m.index + 1400)
          if (!/\.is\(['"]superseded_at['"], null\)/.test(stmt)) offenders.push(`${rel}:${src.slice(0, m.index).split('\n').length}`)
        }
      }
    }
    expect(
      offenders,
      'Write to session_completions that does not scope itself to the live plan. week_n ' +
      'restarts at 1 on a new plan, so this can land on the PREVIOUS plan\'s superseded row: ' +
      'the write succeeds, reports success, and every read filters it out. Either go through ' +
      'upsertCompletion() (client) or add .is(\'superseded_at\', null) (server).\n' +
      offenders.join('\n'),
    ).toEqual([])
  })

  it('the gate can go red', () => {
    // Falsification: the exact pre-fix line must still be classified as an offender.
    const unscoped = `supabase.from('session_completions').update({ x: 1 }).eq('user_id', u)`
    const scoped   = `supabase.from('session_completions').update({ x: 1 }).eq('user_id', u).is('superseded_at', null)`
    const has = (src: string) => { WRITE.lastIndex = 0; return WRITE.test(src) }
    expect(has(unscoped)).toBe(true)
    expect(/\.is\(['"]superseded_at['"], null\)/.test(unscoped)).toBe(false)  // → offender
    expect(/\.is\(['"]superseded_at['"], null\)/.test(scoped)).toBe(true)     // → allowed
    expect(has(`await upsertCompletion(supabase, { week_n: 1 })`)).toBe(false)
  })
})
