// GTM-SEO-PLANS-01 — dynamic SEO plan route.
// One route serves every plan in the marketing catalogue. Statically generated
// (ISR daily) so the pages are crawlable and cached.

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { BRAND } from '@/lib/brand'
import { MARKETING_PLANS, getPlan } from '@/lib/marketing/plans'
import { PlanPage } from '@/components/marketing/PlanPage'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://zonna.run'

export const revalidate = 86400
export const dynamicParams = false

export function generateStaticParams() {
  return MARKETING_PLANS.map(p => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const plan = getPlan(slug)
  if (!plan) return {}
  const url = `${APP_URL}/plans/${plan.slug}`
  return {
    title: plan.metaTitle,
    description: plan.metaDescription,
    alternates: { canonical: url },
    openGraph: {
      title: plan.ogTitle,
      description: plan.ogDescription,
      url,
      siteName: BRAND.name,
      type: 'article',
    },
  }
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const plan = getPlan(slug)
  if (!plan) notFound()
  return <PlanPage plan={plan} />
}
