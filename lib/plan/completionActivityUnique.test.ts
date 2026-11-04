import { describe, it, expect } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { upsertCompletion } from './completions'

/**
 * COMPLETION-ACTIVITY-DUPE-01 — one run satisfies one session.
 * Measured 2026-11-04 on 156 live completions: 2 activities each linked to 2 sessions.
 */
const MIGRATION = path.join(process.cwd(), 'supabase/migrations/20261104_completion_activity_unique.sql')

describe('COMPLETION-ACTIVITY-DUPE-01 — the constraint', () => {
  const sql = fs.readFileSync(MIGRATION, 'utf8')

  it('declares a LIVE-only unique index for both activity identities', () => {
    for (const col of ['apple_health_uuid', 'strava_activity_id']) {
      const idx = sql.match(new RegExp(`create unique index[^;]*?\\(user_id, ${col}\\)[^;]*?;`, 's'))
      expect(idx, `no unique index for ${col}`).toBeTruthy()
      // Partial on BOTH predicates, or a tombstoned row blocks a legitimate re-link.
      expect(idx![0]).toContain('superseded_at is null')
      expect(idx![0]).toContain(`${col} is not null`)
    }
  })

  it('supersedes the two known pairs rather than deleting them', () => {
    expect(sql).toContain('set superseded_at = now()')
    expect(sql).not.toMatch(/delete\s+from\s+public\.session_completions/i)
    // The row kept is the one whose day matches the activity's own start date.
    expect(sql).toContain("session_day = 'fri'")   // 9DCEE865 ran Sat 31 Oct
    expect(sql).toContain("session_day = 'wed'")   // D6670D38 ran Tue 29 Sep
  })
})

describe('COMPLETION-ACTIVITY-DUPE-01 — the owner translates the violation', () => {
  const client = (error: any) => ({ rpc: async () => ({ error }) }) as any

  it('a unique violation on either index becomes a sentence a runner can read', async () => {
    for (const name of ['session_completions_live_hk_uuid_key', 'session_completions_live_strava_id_key']) {
      const { error } = await upsertCompletion(
        client({ code: '23505', message: `duplicate key value violates unique constraint "${name}"` }),
        { week_n: 7, session_day: 'tue' },
      )
      expect(error?.message).toBe('That run is already linked to another session.')
    }
  })

  it('every OTHER error is passed through verbatim — including the session-day key', async () => {
    const { error } = await upsertCompletion(
      client({ code: '23505', message: 'duplicate key value violates unique constraint "session_completions_live_key"' }),
      { week_n: 7, session_day: 'tue' },
    )
    expect(error?.message).toContain('session_completions_live_key')

    const { error: other } = await upsertCompletion(client({ code: '42501', message: 'permission denied' }), { week_n: 7, session_day: 'tue' })
    expect(other?.message).toBe('permission denied')
  })

  it('success still returns a null error', async () => {
    const { error } = await upsertCompletion(client(null), { week_n: 7, session_day: 'tue' })
    expect(error).toBeNull()
  })
})

/**
 * 🔴 THIRD TIME IN ONE SESSION. An ORDER assertion over raw source compares the position
 * of a name in the CODE against the position of the same name in a COMMENT that explains
 * it — and the comment comes first, because it explains what follows. Both arms below
 * failed on their own explanatory prose. `HOOK-RGBA-COMMENTS-01` is this repo's name for
 * the class; line length is preserved so an offset still points somewhere real.
 */
function stripTs(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '))
    .replace(/(^|[^:])\/\/[^\n]*/g, (m, p1) => p1 + ' '.repeat(m.length - p1.length))
}
function stripSql(src: string): string {
  return src.replace(/--[^\n]*/g, m => ' '.repeat(m.length))
}

/**
 * The write paths must know about the indexes. Found by code review, not by me:
 * `claim_session_completion`'s `ON CONFLICT (user_id, week_n, session_day) DO NOTHING`
 * absorbs a collision on the LIVE-KEY index and cannot absorb one on a DIFFERENT index.
 * So the ordinary re-ingest this migration exists to prevent would have raised 23505 and
 * fired `completion_claim_failed` — the event that exists to surface real outages, and
 * which was created precisely because the prior implementation logged on every routine link.
 */
describe('COMPLETION-ACTIVITY-DUPE-01 — the auto-link path treats it as benign, not an outage', () => {
  const src = stripTs(fs.readFileSync(path.join(process.cwd(), 'lib/coaching/autoAnalyse.ts'), 'utf8'))

  it('both the claim and the attach branch consult the predicate', () => {
    // Claim: the benign return must come BEFORE the warn + ops event.
    const claim = src.slice(src.indexOf('if (claimRes.error)'), src.indexOf('if (claimRes.data === true)'))
    expect(claim.indexOf('isActivityAlreadyLinked')).toBeGreaterThan(-1)
    expect(claim.indexOf('isActivityAlreadyLinked')).toBeLessThan(claim.indexOf('completion_claim_failed'))
    // Attach: its error was never read at all before this.
    expect(src).toMatch(/if \(upd\.error\)/)
  })

  it('the predicate matches the INDEX NAME, never the message text', () => {
    const fn = src.slice(src.indexOf('function isActivityAlreadyLinked'))
    expect(fn).toContain("'23505'")
    expect(fn).toMatch(/session_completions_live_\(hk_uuid\|strava_id\)_key/)
    // `session_completions_live_key` is a DIFFERENT situation with a different answer,
    // and a substring test for "duplicate key" cannot tell them apart.
    expect(fn).not.toMatch(/duplicate key/i)
  })

  it('the index names in the migration are the ones the code matches', () => {
    for (const n of ['session_completions_live_hk_uuid_key', 'session_completions_live_strava_id_key']) {
      expect(sqlText(), `${n} missing from the migration`).toContain(n)
    }
  })
})

function sqlText(): string {
  return fs.readFileSync(MIGRATION, 'utf8')
}

describe('COMPLETION-ACTIVITY-DUPE-01 — the migration cannot half-apply', () => {
  const sql = stripSql(fs.readFileSync(MIGRATION, 'utf8'))

  it('is transactional, like its sibling live-key migration', () => {
    expect(sql).toMatch(/^begin;$/m)
    expect(sql).toMatch(/^commit;$/m)
    expect(sql.indexOf('begin;')).toBeLessThan(sql.indexOf('create unique index'))
  })

  it('raises on any duplicate the hand-written fix-list did not cover', () => {
    // The list is written against a 2026-11-04 snapshot; a new duplicate can arrive
    // between writing the migration and running it.
    expect(sql).toMatch(/raise exception/i)
    expect(sql).toContain('having count(*) > 1')
    expect(sql.indexOf('raise exception')).toBeLessThan(sql.indexOf('create unique index'))
  })

  it('does not use CONCURRENTLY, which cannot run inside a transaction', () => {
    expect(sql).not.toMatch(/create unique index concurrently/i)
  })
})
