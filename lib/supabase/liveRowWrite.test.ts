/**
 * WEEKLY-REPORT-SUPERSEDED-WRITE-01 — a week-keyed write may never land on a superseded row.
 *
 * Three facts, each correct alone: the unique key is `(user_id, week_n[, …])` and not
 * plan-scoped; every read filters `superseded_at IS NULL`; the write was a PostgREST
 * `.upsert()` on that same key. `week_n` is a WITHIN-PLAN coordinate (ADR-013), so a new
 * plan restarts at 1 and the upsert updated the PREVIOUS plan's row in place, inheriting
 * its tombstone. The write succeeded, every read excluded it, nothing errored — and the
 * archived plan's row was destroyed at the same time.
 *
 * Measured in production 2026-11-02: 1 live ghost write (`weekly_reports`, one runner's
 * week 1, superseded 10-18 and rewritten 10-25), plus 8 superseded `session_reflections`
 * rows against ZERO live ones and 13 superseded `session_metric_overrides`.
 *
 * ⚠️ THE POPULATION ARM IS WHY THIS FILE EXISTS. The behavioural arm proves the helper
 * is right; it cannot prove the helper is USED. COMPLETION-TOMBSTONE-01 fixed the fourth
 * table of this family on 2026-09-23 and these three were left for six weeks, which is
 * the "remedy applied to ONE TWIN" class — eight instances recorded, three in one day.
 * So the second arm reads the SOURCE and fails on any new blind upsert, deriving its
 * population from `WEEK_KEYED_TABLES` rather than a list typed here.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { writeLiveRow } from './liveRowWrite'
import { WEEK_KEYED_TABLES } from '@/lib/plan/supersede'
import type { SupabaseClient } from '@supabase/supabase-js'

/** A Supabase stand-in that records what it was asked to do. `liveId` is what a
 *  `superseded_at IS NULL` lookup finds; `insertError` is what INSERT returns. */
function fakeClient(opts: { liveId?: string | null; insertError?: { code: string; message: string } | null }) {
  const calls: string[] = []
  let liveId = opts.liveId ?? null
  const client = {
    from(table: string) {
      return {
        select() {
          const q: Record<string, unknown> = {}
          let liveFiltered = false
          const chain = {
            is(col: string, val: unknown) { if (col === 'superseded_at' && val === null) liveFiltered = true; return chain },
            eq(col: string, val: unknown) { q[col] = val; return chain },
            maybeSingle: async () => {
              calls.push(`select ${table} live=${liveFiltered} ${JSON.stringify(q)}`)
              // A lookup that forgot the live filter is the defect, not a pass.
              if (!liveFiltered) throw new Error('select did not filter superseded_at IS NULL')
              return { data: liveId ? { id: liveId } : null, error: null }
            },
          }
          return chain
        },
        update(row: Record<string, unknown>) {
          return {
            eq: async (col: string, val: unknown) => {
              calls.push(`update ${table} by ${col}=${val} keys=${Object.keys(row).join(',')}`)
              return { error: null }
            },
          }
        },
        insert: async () => {
          calls.push(`insert ${table}`)
          if (opts.insertError) return { error: opts.insertError }
          liveId = 'inserted-row'
          return { error: null }
        },
        upsert: async () => { calls.push(`upsert ${table}`); return { error: null } },
      }
    },
  }
  return { client: client as unknown as SupabaseClient, calls }
}

const KEY = { user_id: 'u1', week_n: 1 }
const ROW = { user_id: 'u1', week_n: 1, headline: 'new' }

describe('writeLiveRow — the live row, or a new one, never a tombstone', () => {
  it('updates the LIVE row by primary key when one exists', async () => {
    const { client, calls } = fakeClient({ liveId: 'live-1' })
    const out = await writeLiveRow(client, 'weekly_reports', KEY, ROW)
    expect(out).toEqual({ ok: true, action: 'updated' })
    // By id — an update targeted at the primary key cannot reach a superseded row, which
    // is the whole property. A `week_n` filter could match either.
    expect(calls).toContain('update weekly_reports by id=live-1 keys=user_id,week_n,headline')
  })

  it('INSERTS when there is no live row, even though a superseded one holds the key', async () => {
    // This is the case the old upsert got wrong: no live row, tombstone present.
    const { client, calls } = fakeClient({ liveId: null })
    const out = await writeLiveRow(client, 'weekly_reports', KEY, ROW)
    expect(out).toEqual({ ok: true, action: 'inserted' })
    expect(calls).toContain('insert weekly_reports')
    expect(calls.some(c => c.startsWith('update'))).toBe(false)
  })

  it('a unique violation with NO live row is reported, and nothing is written', async () => {
    // The pre-migration state: the plain UNIQUE still matches the tombstone. Writing it
    // is the defect, so the only correct move is to decline and say why.
    const { client, calls } = fakeClient({ liveId: null, insertError: { code: '23505', message: 'duplicate key' } })
    const out = await writeLiveRow(client, 'weekly_reports', KEY, ROW)
    expect(out.ok).toBe(false)
    if (out.ok) throw new Error('unreachable')
    expect(out.reason).toBe('tombstone-collision')
    expect(out.message).toMatch(/20261102_live_week_keys\.sql/)
    expect(calls.some(c => c.startsWith('update'))).toBe(false)
  })

  it('a unique violation from a CONCURRENT insert updates the row that now exists', async () => {
    // Same error code, opposite cause: the re-read finds a live row, so this is a race
    // and not a missing index. Distinguishing them is why the helper asks twice.
    let live: string | null = null
    const base = fakeClient({ liveId: null, insertError: { code: '23505', message: 'duplicate key' } })
    const client = {
      from(table: string) {
        const inner = (base.client as unknown as { from: (t: string) => Record<string, unknown> }).from(table)
        return {
          ...inner,
          select() {
            const chain = {
              is: () => chain, eq: () => chain,
              maybeSingle: async () => {
                const data = live ? { id: live } : null
                live = 'raced-in'           // the concurrent writer lands between the two reads
                return { data, error: null }
              },
            }
            return chain
          },
        }
      },
    } as unknown as SupabaseClient
    const out = await writeLiveRow(client, 'weekly_reports', KEY, ROW)
    expect(out).toEqual({ ok: true, action: 'updated' })
  })

  it('a non-unique error is reported as an error, not as a tombstone collision', async () => {
    const { client } = fakeClient({ liveId: null, insertError: { code: '42501', message: 'permission denied' } })
    const out = await writeLiveRow(client, 'weekly_reports', KEY, ROW)
    expect(out).toEqual({ ok: false, reason: 'error', message: 'permission denied' })
  })
})

// ── The population arm ──────────────────────────────────────────────────────────────

/**
 * Blank comment text, preserving length so offsets stay valid.
 *
 * ⚠️ WITHOUT THIS THE ARM FIRES ON ITS OWN DOCUMENTATION. `lib/plan/completions.ts`
 * quotes `onConflict: 'user_id,week_n,session_day'` in its header while explaining
 * COMPLETION-TOMBSTONE-01, and the comments added by this item quote the upserts they
 * replaced. `HOOK-RGBA-COMMENTS-01` recorded the identical hole in the pre-commit hook:
 * a value inside a comment is PROSE, and this repo has four times recorded that a guard
 * which fires on ordinary work gets switched off, which is the same as having no guard.
 * A value inside a STRING is still code, so string literals are left alone.
 */
function stripComments(src: string): string {
  const out = src.split('')
  let i = 0
  while (i < src.length) {
    const c = src[i], d = src[i + 1]
    if (c === '/' && d === '/') {
      while (i < src.length && src[i] !== '\n') { out[i] = ' '; i++ }
    } else if (c === '/' && d === '*') {
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] !== '\n') out[i] = ' '; i++ }
      out[i] = ' '; out[i + 1] = ' '; i += 2
    } else if (c === '"' || c === "'" || c === '`') {
      i++
      while (i < src.length && src[i] !== c) { if (src[i] === '\\') i++; i++ }
      i++
    } else i++
  }
  return out.join('')
}

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) sourceFiles(full, acc)
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) acc.push(full)
  }
  return acc
}

describe('no week-keyed table is written with a blind upsert', () => {
  it('derives its population from WEEK_KEYED_TABLES, not from a list typed here', () => {
    // If a table leaves that array this arm stops covering it, which is the
    // "checker shares the producer's list" flaw — so assert the array still holds the
    // three this item fixed plus the one COMPLETION-TOMBSTONE-01 did.
    for (const t of ['weekly_reports', 'session_reflections', 'session_metric_overrides', 'session_completions']) {
      expect(WEEK_KEYED_TABLES as readonly string[]).toContain(t)
    }
  })

  it('no source file upserts a week-keyed table on a week_n conflict target', () => {
    const offenders: string[] = []
    for (const dir of ['app', 'lib']) {
      for (const file of sourceFiles(join(process.cwd(), dir))) {
        const src = stripComments(readFileSync(file, 'utf8'))
        for (const table of WEEK_KEYED_TABLES) {
          if (!src.includes(`'${table}'`)) continue
          // The shape: a `.upsert(` whose onConflict names week_n, anywhere in this file.
          // Bounded to the region after the table name so an unrelated upsert in a large
          // route is not attributed to it.
          const from = src.indexOf(`'${table}'`)
          const region = src.slice(from, from + 1600)
          const m = region.match(/\.upsert\([\s\S]{0,600}?onConflict:\s*'([^']*week_n[^']*)'/)
          if (m) offenders.push(`${file.replace(process.cwd() + '/', '')} → ${table} onConflict '${m[1]}'`)
        }
      }
    }
    expect(offenders).toEqual([])
  })
})
