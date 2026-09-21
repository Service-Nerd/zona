// W-01 — read a guide before it is published.
//
// The SLT ruling is "Claude drafts, the founder reads every word before it
// ships", and the publish gate holds guides at 404 until there are three. Both
// are right and together they made the draft unreadable, which is the same
// trap `/refusal-preview`, `/zone-block-preview` and `/me-preview` were each
// added to escape: a surface nobody can see does not get reviewed, it gets
// approved.
//
// Renders every guide regardless of the gate. `noindex` so it cannot compete
// with the real page, and it disappears on its own once the hub opens.

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ArticlePage } from '@/components/marketing/ArticlePage'
import { guideArticles } from '@/lib/marketing/articles'

export const metadata: Metadata = {
  title: 'Guide preview',
  robots: { index: false, follow: false },
}

export default function GuidePreviewPage() {
  const guides = guideArticles()
  if (guides.length === 0) notFound()
  return (
    <>
      {guides.map(g => <ArticlePage key={g.slug} article={g} />)}
    </>
  )
}
