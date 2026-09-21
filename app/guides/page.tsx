// W-01 — the guides hub.
//
// ⚠️ GATED, AND THE GATE IS THE POINT. SLT 2026-09-21 resolved Fried against
// Traynor: the shelf ships now, the door opens at `GUIDES_MIN_TO_PUBLISH`.
// Fried's objection was that "a hub with two guides is worse than no hub" and
// the writing is founder-time at roughly one a week; Traynor's was that the
// shelf is nearly free and its absence delays the third guide. Both hold, so
// the page exists and 404s until there are three.
//
// The gate is read from the catalogue, never restated here — a second copy of
// "three" is how a gate ends up meaning two different things.

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ArticleHub, hubMetadata } from '@/components/marketing/ArticleHub'
import { guideArticles, guidesArePublished, GUIDE_HUB } from '@/lib/marketing/articles'

export const revalidate = 86400

export const metadata: Metadata = hubMetadata(GUIDE_HUB)

export default function GuideHubPage() {
  if (!guidesArePublished()) notFound()
  return (
    <ArticleHub
      hub={GUIDE_HUB}
      articles={guideArticles()}
      section={null}
      breadcrumbLabel="Guides"
    />
  )
}
