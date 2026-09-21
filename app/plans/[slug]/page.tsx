// GTM-SEO-PLANS-01 — dynamic SEO plan route.
// One route serves every plan in the marketing catalogue. Statically generated
// (ISR daily) so the pages are crawlable and cached.

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { pageMetadata } from '@/lib/marketing/siteMeta'
import { MARKETING_PLANS, getPlan } from '@/lib/marketing/plans'
import { PlanPage } from '@/components/marketing/PlanPage'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.zonna.run'

export const revalidate = 86400
export const dynamicParams = false

export function generateStaticParams() {
  return MARKETING_PLANS.map(p => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const plan = getPlan(slug)
  if (!plan) return {}
  return pageMetadata({
    title: plan.metaTitle,
    description: plan.metaDescription,
    path: `/plans/${plan.slug}`,
    ogTitle: plan.ogTitle,
    ogDescription: plan.ogDescription,
    type: 'article',
    // The OG card names the PLAN, not the og sentence: `ogTitle` is a full
    // marketing line and renders as a wall of text at 1200x630.
    ogImageTitle: plan.h1,
  })
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const plan = getPlan(slug)
  if (!plan) notFound()
  return <PlanPage plan={plan} />
}
