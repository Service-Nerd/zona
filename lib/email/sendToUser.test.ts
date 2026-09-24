/**
 * EMAIL-WAVE-0 — suppression, and the outcome that stops a phantom stamp.
 *
 * 🔴 THE TWO FAILURES THIS EXISTS FOR.
 *
 * 1. **35 emails went out with no unsubscribe path**, which is why suppression
 *    now lives in the owner rather than at a call site. A check at the call site
 *    is a check the next call site forgets: this repo has paid for that with
 *    `decideTrialEmails` mailing "3 days left" to people who had already
 *    subscribed, and with the tier order existing in three places.
 *
 * 2. **A boolean return would let a suppressed send stamp `*_sent_at`.** The
 *    caller would read `false` as "failed, try tomorrow" or `true` as "done" with
 *    no way to tell "we chose not to". A stamped column for an email nobody
 *    received skips that runner **forever**, including the day they resubscribe.
 *    Hence an OUTCOME, and hence this file.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ⚠️ TYPED MOCKS, and the reason is worth a line: the first cut used
// `vi.fn(async () => true)` with `(...a as [])`, which vitest ran happily and
// `tsc` rejected — `mock.calls[0][0]` on an empty tuple has no element. The
// SUITE WAS GREEN AND THE BUILD WAS NOT. Typing the mock is what makes the
// assertions about its arguments mean anything.
type SendArgs = { to: string; subject: string; html: string; unsubscribeUrl?: string }
const sendEmailMock = vi.fn<(a: SendArgs) => Promise<boolean>>(async () => true)
const recordMock = vi.fn<(kind: string, detail: Record<string, unknown>, userId: string | null) => Promise<void>>(async () => {})
let row: Record<string, unknown> | null = { email_unsubscribed_at: null, email_unsubscribe_token: 'tok-123' }
let readError: { message: string } | null = null

vi.mock('./resend', () => ({ sendEmail: (a: SendArgs) => sendEmailMock(a) }))
vi.mock('@/lib/ops/recordOpsEvent', () => ({
  recordOpsEvent: (k: string, d: Record<string, unknown>, u: string | null) => recordMock(k, d, u),
}))
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => ({ data: row, error: readError }) }),
      }),
    }),
  }),
}))

import { sendToUser } from './sendToUser'

const base = {
  userId: 'u1', to: 'runner@example.com',
  id: 'trial_day11' as const, kind: 'transactional' as const,
  subject: '3 days left.', html: '<p>hi</p>',
}

beforeEach(() => {
  sendEmailMock.mockClear(); recordMock.mockClear()
  row = { email_unsubscribed_at: null, email_unsubscribe_token: 'tok-123' }
  readError = null
})

describe('sendToUser — the owner of every send', () => {
  it('sends for a subscribed runner, and carries the List-Unsubscribe target', () => {
    return sendToUser(base).then(outcome => {
      expect(outcome).toBe('sent')
      expect(sendEmailMock).toHaveBeenCalledTimes(1)
      const arg = sendEmailMock.mock.calls[0]![0]
      expect(arg.unsubscribeUrl, 'the header target must be built from the token').toContain('tok-123')
    })
  })

  it('SUPPRESSES an unsubscribed runner and never reaches the transport', async () => {
    row = { email_unsubscribed_at: '2026-09-20T10:00:00Z', email_unsubscribe_token: 'tok-123' }
    expect(await sendToUser(base)).toBe('suppressed_unsubscribed')
    expect(sendEmailMock, 'the transport must not be reached').not.toHaveBeenCalled()
  })

  it('suppression is DISTINGUISHABLE from failure — the phantom-stamp guard', async () => {
    // The caller stamps only on 'sent'. If these two collapsed to one value, a
    // suppressed runner would be stamped and skipped forever.
    row = { email_unsubscribed_at: '2026-09-20T10:00:00Z', email_unsubscribe_token: 't' }
    const suppressed = await sendToUser(base)
    row = { email_unsubscribed_at: null, email_unsubscribe_token: 't' }
    sendEmailMock.mockResolvedValueOnce(false)
    const failed = await sendToUser(base)
    expect(suppressed).not.toBe(failed)
    expect(suppressed).toBe('suppressed_unsubscribed')
    expect(failed).toBe('failed')
  })

  it('a consent READ failure does not send — silence is the safe direction', async () => {
    readError = { message: 'connection reset' }
    expect(await sendToUser(base)).toBe('failed')
    expect(sendEmailMock).not.toHaveBeenCalled()
  })

  it('no address is its own outcome, not a failure', async () => {
    expect(await sendToUser({ ...base, to: null })).toBe('no_address')
    expect(sendEmailMock).not.toHaveBeenCalled()
  })

  it('EVERY outcome is recorded, including the ones we chose', async () => {
    await sendToUser(base)                                                   // sent
    row = { email_unsubscribed_at: 'x', email_unsubscribe_token: 't' }
    await sendToUser(base)                                                   // suppressed
    await sendToUser({ ...base, to: undefined })                             // no address
    expect(recordMock).toHaveBeenCalledTimes(3)
    const outcomes = recordMock.mock.calls.map(c => c[1].outcome)
    expect(outcomes).toEqual(['sent', 'suppressed_unsubscribed', 'no_address'])
  })
})
