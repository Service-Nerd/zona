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
