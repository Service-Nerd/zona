// GTM-SEO-COMPARE-01 — page 3 of 8 competitor-comparison articles.
//
// Intentionally a shim, same as pages 1 and 2. Copy lives in
// `lib/marketing/articles.ts`, markup in
// `components/marketing/ArticlePage.tsx`.

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ArticlePage, articleMetadata } from '@/components/marketing/ArticlePage'
import { getArticle } from '@/lib/marketing/articles'

const SLUG = 'best-running-app-for-beginners'

export const revalidate = 86400

export const metadata: Metadata = articleMetadata(getArticle(SLUG)!)

export default function Page() {
  const article = getArticle(SLUG)
  if (!article) notFound()
  return <ArticlePage article={article} />
}
