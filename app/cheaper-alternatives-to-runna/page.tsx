// GTM-SEO-COMPARE-01 — page 4 of 8 competitor-comparison articles.
//
// Intentionally a shim, same four lines as pages 1 to 3. Copy lives in
// `lib/marketing/articles.ts`, markup in `components/marketing/ArticlePage.tsx`,
// and the renderer owns the JSON-LD, the "Last updated" line, the signature and
// the App Store link, so none of those is wired here.
//
// ⚠️ A ROOT SLUG, NOT `app/[slug]/page.tsx`. A root catch-all would swallow
// every other route in the app; see the note at the top of `articles.ts`.

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ArticlePage, articleMetadata } from '@/components/marketing/ArticlePage'
import { getArticle } from '@/lib/marketing/articles'

const SLUG = 'cheaper-alternatives-to-runna'

export const revalidate = 86400

export const metadata: Metadata = articleMetadata(getArticle(SLUG)!)

export default function Page() {
  const article = getArticle(SLUG)
  if (!article) notFound()
  return <ArticlePage article={article} />
}
