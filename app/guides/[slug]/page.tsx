// W-01 — the guide spoke. One route for all guides, unlike the comparison
// articles, which each need their own file because they live at the root.
//
// `generateStaticParams` reads the catalogue, so a new guide is ONE entry and
// no route work at all.
//
// ⚠️ THIS ROUTE IS DELIBERATELY NOT GATED ON THE HUB (changed 2026-09-21,
// W-01a). It was, on the reasoning that a guide whose hub 404s is an orphan.
// That deadlocked two SLT rulings from the same sitting: Fried's "publish one
// and see before writing the second" cannot happen if publication waits on a
// hub that needs three. The two rulings are about different objects — Wood's
// objection is to a one-card HUB, not to a guide existing.
//
// The orphan concern was real and is answered directly: a live guide carries a
// CONTEXTUAL inbound link from the homepage, which is a better link than a hub
// card, and `guidesGate.test.ts` fails if one does not.

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ArticlePage, articleMetadata } from '@/components/marketing/ArticlePage'
import { getArticle, guideArticles } from '@/lib/marketing/articles'

export const revalidate = 86400

// A guide is live as soon as it is in the catalogue. The HUB gate is a
// separate question and does not hold the article back — see the note on
// `guidesArePublished`, and SLT 2026-09-21 where gating both deadlocked
// Fried's cadence against Wood's hub rule.
export function generateStaticParams() {
  return guideArticles().map(a => ({ slug: a.slug }))
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> },
): Promise<Metadata> {
  const { slug } = await params
  const article = getArticle(slug)
  return article && article.kind === 'guide' ? articleMetadata(article) : {}
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const article = getArticle(slug)
  // Kind is checked as well as existence: without it, /guides/runna-alternatives
  // would render a comparison article under a guide breadcrumb.
  if (!article || article.kind !== 'guide') notFound()
  return <ArticlePage article={article} />
}
