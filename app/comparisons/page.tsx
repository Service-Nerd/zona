// GTM-SEO-COMPARE-01 — the comparison hub.
//
// Reduced to a shim on 2026-09-21 (W-01) when `/guides` needed the same page.
// Markup, JSON-LD and metadata live in `components/marketing/ArticleHub.tsx`
// so the two hubs cannot drift; this file supplies the copy and the filter.
//
// ⚠️ IT FILTERS BY KIND. It used to map the whole catalogue, which was correct
// while the catalogue held only comparisons and became a live defect the
// moment `kind` was introduced: `/comparisons` would have listed guides.

import type { Metadata } from 'next'
import { ArticleHub, hubMetadata } from '@/components/marketing/ArticleHub'
import { comparisonArticles, COMPARISON_HUB, GUIDE_HUB } from '@/lib/marketing/articles'

export const revalidate = 86400

export const metadata: Metadata = hubMetadata(COMPARISON_HUB)

export default function ComparisonHubPage() {
  return (
    <ArticleHub
      hub={COMPARISON_HUB}
      articles={comparisonArticles()}
      section="comparisons"
      breadcrumbLabel="Comparisons"
      siblingHub={{ href: `/${GUIDE_HUB.slug}`, label: 'Read the guides' }}
    />
  )
}
