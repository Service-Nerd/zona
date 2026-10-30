// WEEKLY-REPORT-CRON-AUTH-01 — every scheduled route accepts the header its scheduler actually sends.
//
// `push/send-weekly-report` read `x-cron-secret` only, while Vercel cron (its only caller) sends
// `Authorization: Bearer`. Every Sunday call was refused; 0 weekly reports and 0 weekly pushes in 90 days.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { cronSecretFrom, secretMatches } from './secrets'

const req = (h: Record<string, string>) => ({ headers: { get: (n: string) => h[n.toLowerCase()] ?? null } })

describe('cronSecretFrom', () => {
  it('reads the Bearer header Vercel cron and the workflows send', () => {
    expect(cronSecretFrom(req({ authorization: 'Bearer s3cret' }))).toBe('s3cret')
    expect(cronSecretFrom(req({ authorization: 'bearer s3cret' }))).toBe('s3cret')
  })
  it('falls back to x-cron-secret for manual calls', () => {
    expect(cronSecretFrom(req({ 'x-cron-secret': 's3cret' }))).toBe('s3cret')
    expect(cronSecretFrom(req({ authorization: 'Bearer ', 'x-cron-secret': 's3cret' }))).toBe('s3cret')
  })
  it('no header is no secret, and secretMatches fails closed on it', () => {
    expect(cronSecretFrom(req({}))).toBeNull()
    expect(secretMatches(cronSecretFrom(req({})), 's3cret')).toBe(false)
  })
})

// ── The real route, with a Bearer header, exactly as Vercel cron calls it ──
const from = vi.fn()
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from }) }))
vi.mock('@/lib/notifications', () => ({ recordNotification: vi.fn(), pruneReadNotifications: vi.fn() }))
vi.mock('@/lib/webpush', () => ({ sendWebPush: vi.fn() }))
vi.mock('@/lib/apnpush', () => ({ sendApnsPush: vi.fn() }))

describe('🔴 push/send-weekly-report accepts Vercel cron', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 's3cret'
    from.mockReset()
    from.mockReturnValue({ select: () => Promise.resolve({ data: [], error: null }) })
  })
  const call = async (headers: Record<string, string>) => {
    const { GET } = await import('../../app/api/push/send-weekly-report/route')
    return GET(new Request('https://www.zonna.run/api/push/send-weekly-report', { headers }) as any)
  }
  it('Authorization: Bearer is let in', async () => {
    const res = await call({ authorization: 'Bearer s3cret' })
    expect(res.status).toBe(200)
    expect(from).toHaveBeenCalledWith('push_subscriptions')
  })
  it('COACH-READ-AUTO-01: asks for a FRESH read, so Sunday never pushes an earlier, thinner one', async () => {
    from.mockReturnValue({ select: () => Promise.resolve({ data: [{ user_id: 'u1', endpoint: 'e', p256dh: 'p', auth: 'a', platform: 'web' }], error: null }) })
    const urls: string[] = []
    const realFetch = globalThis.fetch
    globalThis.fetch = (async (u: any) => { urls.push(String(u)); return new Response('{}', { status: 500 }) }) as any
    try {
      const res = await call({ authorization: 'Bearer s3cret' })
      expect(res.status).toBe(200)
      expect(urls).toHaveLength(1)
      expect(urls[0]).toMatch(/\/api\/weekly-report\?force=true$/)
      expect((await res.json()).declined).toBe(1)
    } finally { globalThis.fetch = realFetch }
  })
  it('a wrong secret is refused before anything is read', async () => {
    const res = await call({ authorization: 'Bearer nope' })
    expect(res.status).toBe(403)
    expect(from).not.toHaveBeenCalled()
  })
})

describe('every cron-secret route also accepts Bearer (the twin class)', () => {
  const api = path.join(__dirname, '../../app/api')
  const routes: string[] = []
  const walk = (d: string) => fs.readdirSync(d).forEach(f => {
    const p = path.join(d, f)
    if (fs.statSync(p).isDirectory()) walk(p)
    else if (f === 'route.ts') routes.push(p)
  })
  walk(api)
  const cronRoutes = routes.filter(p => fs.readFileSync(p, 'utf8').includes('x-cron-secret'))

  it('the population is real', () => {
    expect(cronRoutes.length).toBeGreaterThanOrEqual(10)
    expect(cronRoutes.some(p => p.includes('send-weekly-report'))).toBe(true)
  })
  it('each one reads the Authorization header, directly or through cronSecretFrom', () => {
    const blind = cronRoutes.filter(p => {
      const src = fs.readFileSync(p, 'utf8')
      return !/cronSecretFrom\(|headers\.get\(\s*['"]authorization['"]\s*\)/i.test(src)
    }).map(p => path.relative(api, p))
    expect(blind).toEqual([])
  })
  it('every Vercel cron path in vercel.json is one of them', () => {
    const crons = JSON.parse(fs.readFileSync(path.join(__dirname, '../../vercel.json'), 'utf8')).crons ?? []
    for (const c of crons) {
      const file = path.join(api, c.path.replace(/^\/api\//, ''), 'route.ts')
      expect(fs.readFileSync(file, 'utf8'), c.path).toMatch(/cronSecretFrom\(/)
    }
  })
})
