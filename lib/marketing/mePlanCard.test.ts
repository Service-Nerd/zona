import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { BRAND, PRICING } from '@/lib/brand'
import { FREE_FEATURES, PAID_FEATURES } from '@/lib/marketing/pricing'

/**
 * P-12 (the Me plan card) and P-14(a) (the passive review row).
 *
 * The teardown's one genuinely copyable idea was the plan card's ORDER: state
 * what the runner already has, then what Pro adds. Ours was a single "View
 * plans" row — a link, not a value statement.
 */
const CARD = readFileSync(join(process.cwd(), 'components/shared/MePlanCard.tsx'), 'utf8')
const DASH_RAW = readFileSync(join(process.cwd(), 'app/dashboard/DashboardClient.tsx'), 'utf8')
/** ⚠️ Comments stripped for the "must not contain" checks. FOURTH time today a
 *  substring assertion read a comment as code: the comment explaining that the
 *  native review prompt is deliberately absent contains the words
 *  `SKStoreReview` and `requestReview`. */
const DASH_CODE = DASH_RAW
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').filter(l => !l.trim().startsWith('//')).join('\n')
const DASH = DASH_RAW

describe('P-12 — the plan card reads the gate-linked lists, never a retyped one', () => {
  it('reads real files', () => {
    expect(CARD).toContain('export default function MePlanCard')
    expect(DASH).toContain('<MePlanCard')
  })

  it('imports the SAME rows /pricing renders', () => {
    // A hand-written feature list here is the homepage "four answers" defect
    // waiting to happen — prose about a rule always drifts from the rule —
    // and it would sit outside BOTH guards that already cover these rows
    // (pricing.test.ts and pricingRowTruth.test.ts).
    expect(CARD).toContain("from '@/lib/marketing/pricing'")
    expect(CARD).toMatch(/\bFREE_FEATURES\b/)
    expect(CARD).toMatch(/\bPAID_FEATURES\b/)
  })

  it('does not restate a single feature name in the component', () => {
    for (const f of [...FREE_FEATURES, ...PAID_FEATURES]) {
      expect(CARD, `"${f.name}" is retyped in the card`).not.toContain(f.name)
    }
  })

  it('shows what you HAVE before what you lack', () => {
    const have = CARD.indexOf('On the free plan')
    const adds = CARD.indexOf('Full access adds')
    expect(have).toBeGreaterThan(-1)
    expect(adds).toBeGreaterThan(-1)
    expect(have, 'the order is the whole point of taking this pattern').toBeLessThan(adds)
  })

  it('the price comes from the same constant the paywall uses', () => {
    expect(CARD).toContain('PRICING.annual.perWeekDisplay')
    expect(CARD).not.toMatch(/£\d/)
  })

  it('a subscriber still sees the card, with no upsell', () => {
    // Hiding it would make the section appear only when we want something.
    expect(CARD).toContain('{!subscribed && (')
    expect(CARD).toContain("planName = subscribed ? 'Full access'")
  })

  it('the trial line states the END, not a countdown', () => {
    // P-09 hard rule 2: a timeline describes what happens; urgency is the
    // mechanism we refused when we refused the competitor's exit price.
    expect(CARD).toContain('then you drop to the free plan and keep this plan')
    expect(CARD).not.toMatch(/hurry|only \d|expires soon|act now/i)
  })

  it('§3.1.2 reviewer reachability survives: Me still reaches the paywall', () => {
    expect(CARD).toMatch(/\bonUpgrade\b/)
    expect(CARD).toContain('View plans')
  })

  it('no hardcoded hex or font stack', () => {
    expect(CARD).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(CARD).toContain('var(--font-ui)')
  })
})

describe('P-14(a) — the passive review row', () => {
  it('the review URL is DERIVED from the store URL, not a second hardcoded ID', () => {
    // BRAND.appStore declares itself the single source of truth for the store
    // presence; a second App Store ID is a second thing to get wrong.
    expect(BRAND.appStore.reviewUrl).toBe(`${BRAND.appStore.url}?action=write-review`)
  })

  it('the row is gated on the store URL existing', () => {
    // The block's own note says `url` is blank until approval, and a review
    // link to a page that does not exist is worse than no link.
    expect(DASH).toContain('{BRAND.appStore.url && <>')
    expect(DASH).toContain('BRAND.appStore.reviewUrl')
  })

  it('uses ExternalLink, not a bare anchor', () => {
    // Inside the Capacitor webview a bare href REPLACES the app.
    const at = DASH.indexOf('Leave a review')
    expect(DASH.slice(at - 600, at)).toContain('<ExternalLink')
  })

  it('asks without persuading — no framing, no claim', () => {
    // The moment it acquires a reason it becomes marketing copy on a support
    // screen and needs a brand decision.
    const at = DASH.indexOf('Leave a review')
    const row = DASH.slice(at - 200, at + 200)
    expect(row).not.toMatch(/help other runners|love|enjoying|support us|takes a second/i)
  })

  it('(b) the native prompt is deliberately NOT here', () => {
    // Apple rate-limits to three a year, so firing on less than a real win
    // wastes a scarce resource, and "a defined win" must be written down
    // before it is coded — P-14's own acceptance criterion.
    expect(DASH_CODE).not.toContain('SKStoreReview')
    expect(DASH_CODE).not.toContain('requestReview')
  })
})

describe('the trial-length claim stays consistent across surfaces', () => {
  it('the card does not restate the trial length as a literal', () => {
    // ⚠️ Narrowed to the CLAIM shape, not the bare number: `14` also matches
    // `fontSize: '14px'`, and a test that fails on a stylesheet value teaches
    // people to delete it. The card takes `trialDaysLeft` as a prop and must
    // never hardcode "14 days".
    expect(CARD).not.toMatch(new RegExp(`\\b${PRICING.trialDays}[- ]day`, 'i'))
    expect(CARD).toMatch(/\btrialDaysLeft\b/)
  })
})
