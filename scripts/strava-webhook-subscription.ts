// strava-webhook-subscription.ts — inspect / manage the Strava push (webhook)
// subscription. This is the external state that decides whether a run auto-links
// WITHOUT opening the app (STRAVA-WEBHOOK-OBS-01). It had NO tooling, so when the
// subscription's callback URL goes stale — e.g. the www-canonical migration made
// the apex 307-redirect, and Strava does not follow redirects and deletes a
// subscription after repeated non-2xx deliveries — it broke silently.
//
// Usage:
//   npx tsx scripts/strava-webhook-subscription.ts            # view current subscription
//   npx tsx scripts/strava-webhook-subscription.ts register   # (re)create pointing at www
//   npx tsx scripts/strava-webhook-subscription.ts delete <id>
//
// Env: STRAVA_CLIENT_ID (or default 219980), STRAVA_CLIENT_SECRET,
//      STRAVA_WEBHOOK_VERIFY_TOKEN.
// Callback is ALWAYS the www canonical host (GTM-SITE-01): a redirecting apex
// URL is exactly how the subscription dies.

const CLIENT_ID     = process.env.STRAVA_CLIENT_ID ?? '219980'
const CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET
const VERIFY_TOKEN  = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN
const CALLBACK_URL  = 'https://www.zonna.run/api/webhooks/strava'
const API           = 'https://www.strava.com/api/v3/push_subscriptions'

function requireSecret() {
  if (!CLIENT_SECRET) { console.error('✗ STRAVA_CLIENT_SECRET not set'); process.exit(1) }
}

async function view() {
  requireSecret()
  const url = `${API}?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}`
  const res = await fetch(url)
  const body = await res.json().catch(() => null)
  if (!res.ok) { console.error(`✗ ${res.status}`, body); process.exit(1) }
  const subs = Array.isArray(body) ? body : []
  if (!subs.length) {
    console.log('⚠ NO active Strava webhook subscription — no run will auto-link without opening the app.')
    console.log('  Fix: npx tsx scripts/strava-webhook-subscription.ts register')
    return
  }
  for (const s of subs) {
    const ok = s.callback_url === CALLBACK_URL
    console.log(`${ok ? '✓' : '⚠'} subscription ${s.id}`)
    console.log(`   callback_url: ${s.callback_url}${ok ? '' : `  ← EXPECTED ${CALLBACK_URL} (a redirecting/stale URL is why delivery breaks)`}`)
    console.log(`   created_at:   ${s.created_at}`)
  }
}

async function register() {
  requireSecret()
  if (!VERIFY_TOKEN) { console.error('✗ STRAVA_WEBHOOK_VERIFY_TOKEN not set'); process.exit(1) }
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID, client_secret: CLIENT_SECRET!,
      callback_url: CALLBACK_URL, verify_token: VERIFY_TOKEN,
    }),
  })
  const body = await res.json().catch(() => null)
  if (!res.ok) { console.error(`✗ register failed ${res.status}`, body); process.exit(1) }
  console.log('✓ registered', body)
}

async function del(id: string) {
  requireSecret()
  if (!id) { console.error('✗ pass the subscription id: … delete <id>'); process.exit(1) }
  const res = await fetch(`${API}/${id}?client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 204) { console.error(`✗ delete failed ${res.status}`); process.exit(1) }
  console.log(`✓ deleted subscription ${id}`)
}

const [cmd, arg] = process.argv.slice(2)
;(cmd === 'register' ? register() : cmd === 'delete' ? del(arg) : view())
  .catch(e => { console.error(e); process.exit(1) })
