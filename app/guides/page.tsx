// W-01 — the guides hub.
//
// ⚠️ STILL GATED, but at 1 since the founder overruled the SLT's 3 on
// 2026-09-21. The board's reasoning was sound and the risk it named is real:
// "a hub with two guides is worse than no hub", because a one-card index
// reads as abandoned. Lowering the number does not remove that risk, so it is
// answered in the DESIGN — `youngNote` says the section is being written one
// guide at a time, while it is small. A section that tells you it is small
// reads as deliberate; one that shows a single card and says nothing reads as
// neglected.
//
// The gate is read from the catalogue, never restated here — a second copy of
// the number is how a gate ends up meaning two different things.

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ArticleHub, hubMetadata } from '@/components/marketing/ArticleHub'
import { guideArticles, guidesByIntent, shouldGroupGuides, guidesArePublished, guidesSectionIsMature, GUIDE_HUB, COMPARISON_HUB } from '@/lib/marketing/articles'

export const revalidate = 86400

export const metadata: Metadata = hubMetadata(GUIDE_HUB)

export default function GuideHubPage() {
  if (!guidesArePublished()) notFound()

  // W-01c — grouping switches itself on at the second POPULATED bucket, so at
  // one guide this is undefined and the hub renders flat. Four headings over
  // one article advertises three empty rooms, which is the same "reads as
  // abandoned" failure the publish gate exists for.
  const groups = shouldGroupGuides() ? guidesByIntent() : undefined

  return (
    <ArticleHub
      hub={GUIDE_HUB}
      articles={guideArticles()}
      groups={groups}
      section="guides"
      breadcrumbLabel="Guides"
      youngNote={guidesSectionIsMature()
        ? undefined
        : 'One at a time, and only when there is something worth saying. The list is short on purpose.'}
      siblingHub={{ href: `/${COMPARISON_HUB.slug}`, label: 'Compare the apps' }}
    />
  )
}
