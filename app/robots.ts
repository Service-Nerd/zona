// robots.ts — Next.js Metadata API.
// Allow marketing + legal surfaces; disallow the authenticated app, auth
// routes, and all API routes. The app shell lives at /dashboard — there's
// nothing there for a crawler and every route behind it requires auth anyway.

import type { MetadataRoute } from 'next'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://zonna.run'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/privacy', '/terms', '/support'],
        disallow: ['/dashboard', '/auth', '/api'],
      },
    ],
    sitemap: `${APP_URL}/sitemap.xml`,
  }
}
