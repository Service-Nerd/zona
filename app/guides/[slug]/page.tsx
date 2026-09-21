// W-01 — the guide spoke. One route for all guides, unlike the comparison
// articles, which each need their own file because they live at the root.
//
// `generateStaticParams` reads the catalogue, so a new guide is ONE entry and
// no route work at all. It also returns nothing until the hub is open, so an
// unpublished guide has no page rather than an orphan one.

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ArticlePage, articleMetadata } from '@/components/marketing/ArticlePage'
import { getArticle, guideArticles, guidesArePublished } from '@/lib/marketing/articles'

export const revalidate = 86400

export function generateStaticParams() {
  return guidesArePublished() ? guideArticles().map(a => ({ slug: a.slug })) : []
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
  if (!article || article.kind !== 'guide' || !guidesArePublished()) notFound()
  return <ArticlePage article={article} />
}
