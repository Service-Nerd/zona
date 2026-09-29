// DASHBOARD-SCREEN-EXTRACT-03 — the push/device helpers.
//
// 🔴 A SEPARATE MODULE FROM `dashboardHelpers.ts` ON PURPOSE. That file's header
// promises it is pure: no JSX, no hooks, no component state. These two talk to Capacitor
// and to APNs, so putting them there would have quietly falsified a documented constraint
// to save creating a file. The whole day's lesson is that a doc describing something it
// no longer describes is how defects survive; weakening one to avoid a second module
// would be the same move.
//
// `getDeviceToken` is used by the app-open path that stays in DashboardClient AND by
// `PushNotificationsRow`, which left with MeScreen. Bodies UNCHANGED.


import { Capacitor } from '@capacitor/core'
import { PushNotifications } from '@capacitor/push-notifications'

// ⚠️ MODULE-SCOPE STATE, MOVED WITH THE FUNCTIONS THAT OWN IT. `getDeviceToken`
// caches the APNs token here because iOS only reliably emits `registration` on the
// FIRST register() of a session. Leaving this behind would have split one mechanism
// across two files and silently broken the cache.
type PushListenerHandle = { remove: () => Promise<void> }
let cachedDeviceToken: string | null = null
let tokenListenerAttached = false


// Attach one persistent `registration` listener so any token iOS emits is
// captured into the cache, regardless of which toggle action triggered it.
export async function attachTokenListener() {
  if (tokenListenerAttached) return
  tokenListenerAttached = true
  const { PushNotifications } = await import('@capacitor/push-notifications')
  await PushNotifications.addListener('registration', tok => { cachedDeviceToken = tok.value })
}

// Resolve the APNs device token: the cached value if we've already seen one
// this session, otherwise call register() once and wait for the event (bounded
// so the UI can't hang forever — simulator/sandbox APNs can be unreachable).
// Crucially, once ANY register() fires the token is cached, so the second
// enable/disable in a session returns instantly instead of timing out.
export async function getDeviceToken(timeoutMs = 30_000): Promise<string> {
  await attachTokenListener()
  if (cachedDeviceToken) return cachedDeviceToken
  const { PushNotifications } = await import('@capacitor/push-notifications')
  let regHandle: PushListenerHandle | undefined
  let errHandle: PushListenerHandle | undefined
  try {
    return await new Promise<string>((resolve, reject) => {
      let settled = false
      const settle = (fn: () => void) => { if (!settled) { settled = true; fn() } }
      const timeoutId = setTimeout(() => {
        settle(() => reject(new Error('APNs registration timed out — push may be unavailable here')))
      }, timeoutMs)
      Promise.all([
        PushNotifications.addListener('registration', tok => {
          cachedDeviceToken = tok.value
          settle(() => { clearTimeout(timeoutId); resolve(tok.value) })
        }),
        PushNotifications.addListener('registrationError', err => {
          settle(() => { clearTimeout(timeoutId); reject(new Error(err.error)) })
        }),
      ]).then(([r, e]) => { regHandle = r as PushListenerHandle; errHandle = e as PushListenerHandle })
      PushNotifications.register().catch(err => settle(() => { clearTimeout(timeoutId); reject(err) }))
    })
  } finally {
    // Tear down the per-call waiters — the persistent listener keeps the cache warm.
    await regHandle?.remove?.()
    await errHandle?.remove?.()
  }
}
