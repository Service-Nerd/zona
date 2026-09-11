// sitemap.ts — Next.js Metadata API.
// Lists all publicly indexable pages. App routes (/dashboard, /auth) are
// excluded — they're auth-gated and of no value to a search crawler.
// robots.ts disallows the same routes for belt-and-braces.

import type { MetadataRoute } from 'next'
import { MARKETING_PLANS } from '@/lib/marketing/plans'
import { COMPARISON_ARTICLES, COMPARISON_HUB } from '@/lib/marketing/comparisons'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.zonna.run'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: APP_URL,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    // GTM-SEO-PLANS-01 — the free-plan hub and each plan (primary landing pages).
    {
      url: `${APP_URL}/plans`,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    ...MARKETING_PLANS.map(p => ({
      url: `${APP_URL}/plans/${p.slug}`,
      changeFrequency: 'monthly' as const,
      priority: 0.8,
    })),
    // GTM-SEO-COMPARE-01 — the comparison hub, then each article.
    {
      url: `${APP_URL}/${COMPARISON_HUB.slug}`,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    // Competitor-comparison articles, root-level slugs.
    // This sitemap is a HAND-MAINTAINED list, not a walk of the route tree, so a
    // new page under app/ does NOT appear here on its own. Driving it off the
    // catalogue means the remaining seven articles are listed the moment they
    // are added to `COMPARISON_ARTICLES`, rather than depending on someone
    // remembering this file.
    ...COMPARISON_ARTICLES.map(a => ({
      url: `${APP_URL}/${a.slug}`,
      lastModified: a.lastUpdatedISO,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
    // GTM-SITE-02 — pricing. High priority: it is the page that decides
    // whether an evaluating visitor (or partner) can understand the offer.
    {
      url: `${APP_URL}/pricing`,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    // GTM-CHARITY-01 — audience landing page for charity-place runners, all
    // distances. Priority 0.8: it is a primary entry point for a real referral
    // channel, not a supporting page.
    {
      url: `${APP_URL}/charity-runners`,
      changeFrequency: 'monthly',
      priority: 0.8,
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
