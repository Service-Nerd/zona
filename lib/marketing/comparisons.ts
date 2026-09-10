// GTM-SEO-COMPARE-01 — the comparison-article catalogue.
//
// Single source of truth for the competitor-comparison pages, mirroring the
// GTM-SEO-PLANS-01 shape (`lib/marketing/plans.ts`): copy lives here as data, a
// shared renderer draws it, and each route file is a four-line shim. Eight of
// these pages are planned; adding one is an entry below plus an
// `app/<slug>/page.tsx` that re-exports the shared metadata + component. No
// markup is rewritten per page.
//
// Two house rules bind this file specifically:
//
//   1. NO EM DASHES in any copy string. Deliberate for this content type: the
//      register is plain long-form prose, and the source copy is written and
//      proof-read without them. Commas, colons and full stops only.
//   2. The brand name is interpolated from `BRAND.name`, never typed literally
//      (CLAUDE.md). These articles name the product repeatedly, so a rename that
//      missed them would leave a competitor page advertising a dead brand.
//
// Routes are ROOT-LEVEL slugs (/runna-alternatives) rather than a nested
// dynamic segment, because that is the URL shape the SEO brief specifies and a
// root catch-all would swallow every other route in the app.

import { BRAND } from '@/lib/brand'
import { articleJsonLd } from '@/lib/marketing/articleJsonLd'

/** A run of article text. A bare string is plain copy; the object form is an
 *  inline text link. Links are never buttons in this content type. */
export type ArticleSpan = string | { text: string; href: string }

/** Body blocks. Deliberately only two kinds: this content type is prose with
 *  section breaks, and adding block kinds is how an article template quietly
 *  becomes a page builder. */
export type ArticleBlock =
  | { kind: 'p'; spans: ArticleSpan[] }
  | { kind: 'h2'; text: string }

export interface ComparisonArticle {
  slug: string
  /** Under 60 characters. Asserted by `comparisons.test.ts`. */
  metaTitle: string
  /** Under 155 characters. Asserted by `comparisons.test.ts`. */
  metaDescription: string
  ogTitle: string
  ogDescription: string
  h1: string
  /** Human display form, e.g. '10 September 2026'. */
  lastUpdated: string
  /** Machine form for <time dateTime>, sitemap lastModified, and the Article
   *  JSON-LD `dateModified`. ONE field feeds all three, so the visible date and
   *  the structured-data date cannot drift apart. Update this when the page's
   *  facts are revised. */
  lastUpdatedISO: string
  /** ISO date of FIRST publish. Fixed forever; unlike `lastUpdatedISO` it must
   *  not move when the copy is revised, or the article claims to be brand new
   *  every time a price is corrected. */
  publishedISO: string
  body: ArticleBlock[]
  /** One line, plain and muted. Not an author bio block, no avatar. */
  signature: string
  /** The single plain-text App Store link that closes every article. */
  appStoreLinkText: string
  /** One line for the /compare hub card: what this page actually answers.
   *  REQUIRED on purpose. A hub entry that has to be written is a hub entry
   *  that exists; deriving it from the meta description would produce eight
   *  near-identical cards. */
  hubSummary: string
}

const p = (...spans: ArticleSpan[]): ArticleBlock => ({ kind: 'p', spans })
const h2 = (text: string): ArticleBlock => ({ kind: 'h2', text })

export const COMPARISON_ARTICLES: ComparisonArticle[] = [
  {
    slug: 'runna-alternatives',
    metaTitle: `Runna alternatives for runners who don't want streaks`,
    metaDescription:
      `Runna is good, and now owned by Strava. If you want a coaching app without streaks or badges, here's what else exists in 2026, including the one I built.`,
    ogTitle: `Runna alternatives for runners who don't want streaks`,
    ogDescription:
      `Runna is good, and now owned by Strava. If you want a coaching app without streaks or badges, here's what else exists in 2026, including the one I built.`,
    h1: `Runna alternatives for runners who don't want streaks`,
    lastUpdated: '10 September 2026',
    lastUpdatedISO: '2026-09-10',
    publishedISO: '2026-09-10',
    signature: `Written by Russ Shear, who built ${BRAND.name} after running 100km in July 2026 and walking the last 40 of it.`,
    appStoreLinkText: `Get ${BRAND.name} on the App Store`,
    hubSummary: `Runna is Strava's now. What else exists, what it costs, and who each one actually suits.`,
    body: [
      p(`If you want a coaching app that isn't Runna, three actually work: Coopah, TrainAsONE, and ${BRAND.name}, which I built. Runna is still the best-resourced app in this category. The plans are good, it runs on iOS and Android, and it's now backed by Strava's engineering team. The reason to look elsewhere isn't that Runna is bad. It's that Runna is now Strava's, and Strava is built on kudos, segments, leaderboards and Local Legend badges.`),
      p(`Strava announced the acquisition in 2025 and the deal has since closed. Runna says it's staying a standalone app "for the foreseeable future," and you can still buy a Runna subscription on its own without touching Strava at all. But the two are now one company, and the joint Strava-and-Runna subscription is the direction being pushed. If you'd rather your coach and your social feed lived in different apps, that's worth knowing going in.`),
      p(`The other reason people look elsewhere is price. Runna is £15.99 a month, or £99.99 a year paid upfront. That's not unreasonable for what you get, but it's more than a lot of people expect to pay for a training plan, and it's worth knowing what else is out there before deciding it's the only option.`),

      h2('Coopah'),
      p(`Coopah is the official training app of London Marathon Events: the TCS London Marathon, Brighton Marathon, the Big Half, the Vitality London 10,000. If you're training for one of those specifically, that partnership buys you something real: aligned taper timing, event-specific messaging, and a discount code through the race itself.`),
      p(
        `It costs £9.99 a month, billed annually, and runs on both iOS and Android. The free trial is a week, stretched to two if you come through a London Marathon Events code. If you want to compare against a free structure first, `,
        { text: 'my 16-week marathon plan', href: '/plans/marathon-16-week' },
        ` is public whether or not you ever install anything.`,
      ),
      p(`I haven't trained on Coopah myself, so I won't invent a complaint about how the coaching logic behaves week to week. What I can tell you honestly is the size difference: Coopah has raised roughly £1.5m in seed funding, against Runna's position now inside Strava. If you're weighing depth of investment and pace of development, that's the real comparison.`),

      h2('TrainAsONE'),
      p(`TrainAsONE has the broadest reach of anything on this page: iOS, Android, Garmin and a web app, plus a genuine free tier before you hit a paywall. Premium is £9.99 a month, or £99 a year.`),
      p(`It's an AI-adaptive plan generator: the next session changes based on the one you actually ran, not just the one you were given. That's the same core idea Runna and ${BRAND.name} both use, built by a much smaller team with none of Strava's budget behind it. Same honesty as above: I haven't used it enough to tell you where the plan logic breaks down, only what it costs and what it runs on.`),

      h2(BRAND.name),
      p(`Mine. £7.99 a month, or £59.99 a year, and the free tier stays a genuine free tier: a full plan, not a seven-day demo. No streaks, no badges, no leaderboards, no feed. The whole app is built around telling you when to hold back, because I ran a 100km race in July, went out too hard on the descents because nothing was telling me to stop, and walked the last 40km of it.`),
      p(`It's iOS only: iPhone and Apple Silicon Mac, nothing on Android. No Garmin workout export either, so if you live on a Garmin watch and want sessions pushed to it automatically, that's a real gap, not a small one. And it's built by one person, which means slower feature development than anything else on this page.`),

      h2('Which one'),
      p(`Training for a London Marathon Events race specifically: Coopah. The partnership is real and built around your event. Want the widest platform support and don't mind an app that looks its age next to the market leaders: TrainAsONE. Everything else being equal, and Strava's ecosystem being genuinely fine by you: Runna, still the safest recommendation for most people in this category.`),
      p(`${BRAND.name} is the narrower case. iPhone only, no interest in streaks or a feed, and you already know, the easy way or the hard way, that the thing costing you races usually isn't ambition. It's not knowing when to hold back.`),
      p(
        `If you want to see what a free plan looks like before paying anyone for anything, `,
        { text: `${BRAND.name}'s plans are here`, href: '/plans' },
        `.`,
      ),
    ],
  },
]

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.zonna.run'

/**
 * Article JSON-LD for a comparison page. This is the WIRING, and it is the part
 * worth protecting: `dateModified` is read from `lastUpdatedISO`, the same field
 * that renders the visible "Last updated" line, so the structured data cannot
 * claim one date while the page shows another. Asserted in comparisons.test.ts.
 */
export function comparisonArticleJsonLd(article: ComparisonArticle) {
  return articleJsonLd({
    headline: article.metaTitle,
    datePublished: article.publishedISO,
    dateModified: article.lastUpdatedISO,
    description: article.metaDescription,
    url: `${APP_URL}/${article.slug}`,
  })
}

/**
 * Copy for the /compare hub. Here rather than in the page component for the same
 * reason the article copy is: a wording change touches one file, and the hub and
 * its cards cannot drift apart.
 */
export const COMPARISON_HUB = {
  slug: 'comparisons',
  metaTitle: `Running app comparisons | ${BRAND.name}`,
  metaDescription:
    `Honest comparisons of the running apps people choose between, including where ${BRAND.name} is the wrong answer. No affiliate links, no scores out of ten.`,
  eyebrow: 'Comparisons',
  h1: `Which running app, honestly.`,
  sub: `Comparisons of the coaching apps people actually choose between, including the ones that beat ${BRAND.name} and the runners it is wrong for. No affiliate links, no scores out of ten.`,
} as const

export function getComparison(slug: string): ComparisonArticle | undefined {
  return COMPARISON_ARTICLES.find(a => a.slug === slug)
}
