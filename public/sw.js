// Zona Service Worker — handles Web Push notifications
// Registered by app/dashboard/DashboardClient.tsx on mount (paid/trial users only).

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'Zona', body: event.data.text() }
  }

  const title   = payload.title ?? 'Zona'
  const options = {
    body:    payload.body ?? '',
    icon:    '/icon-192.png',
    badge:   '/icon-192.png',
    tag:     payload.tag ?? 'zona-notification',
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
