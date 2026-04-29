// Vetra Service Worker — handles Web Push notifications
// Push-only worker — no asset caching; PWA assets served fresh from network.
// Registered by app/dashboard/DashboardClient.tsx on mount (paid/trial users only).

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'Vetra', body: event.data.text() }
  }

  const title   = payload.title ?? 'Vetra'
  const options = {
    body:    payload.body ?? '',
    icon:    '/icons/icon-192x192.png',
    badge:   '/icons/icon-72x72.png',
    tag:     payload.tag ?? 'zona-notification', // Legacy tag name — user-invisible functional ID
    data:    payload.data ?? {},
    actions: payload.actions ?? [],
    silent:  false,
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const url = event.notification.data?.url ?? '/dashboard'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find(c => c.url.includes('/dashboard'))
      if (existing) {
        existing.focus()
        existing.navigate(url)
      } else {
        self.clients.openWindow(url)
      }
    })
  )
})
