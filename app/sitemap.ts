// sitemap.ts — Next.js Metadata API.
// Lists all publicly indexable pages. App routes (/dashboard, /auth) are
// excluded — they're auth-gated and of no value to a search crawler.
// robots.ts disallows the same routes for belt-and-braces.

import type { MetadataRoute } from 'next'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://zonna.run'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: APP_URL,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${APP_URL}/support`,
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${APP_URL}/privacy`,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${APP_URL}/terms`,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ]
}
