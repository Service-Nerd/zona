// GTM-SEO-COMPARE-01 — page 2 of 8 competitor-comparison articles.
//
// Intentionally a shim, same as page 1. Copy lives in
// `lib/marketing/comparisons.ts`, markup in
// `components/marketing/ComparisonPage.tsx`.

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ComparisonPage, comparisonMetadata } from '@/components/marketing/ComparisonPage'
import { getComparison } from '@/lib/marketing/comparisons'

const SLUG = 'coopah-vs-runna'

export const revalidate = 86400

export const metadata: Metadata = comparisonMetadata(getComparison(SLUG)!)

export default function Page() {
  const article = getComparison(SLUG)
  if (!article) notFound()
  return <ComparisonPage article={article} />
}
