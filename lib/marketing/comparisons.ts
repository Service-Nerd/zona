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

/** Body blocks. Deliberately few: this content type is prose with section
 *  breaks, and adding block kinds is how an article template quietly becomes a
 *  page builder.
 *
 *  `table` was added for page 2 (`coopah-vs-runna`) and is a functional
 *  necessity, not a new design: a three-way price/platform comparison is a
 *  table, and the SEO brief calls a plain in-page HTML table correct and
 *  better than a graphic, because the cells are readable text. It renders as a
 *  bare `<table>` with the existing tokens, no card, no shadow, no new colour.
 *  The bar for a fourth kind stays where it was. */
export type ArticleBlock =
  | { kind: 'p'; spans: ArticleSpan[] }
  | { kind: 'h2'; text: string }
  /** `head[0]` labels the row-header column and is normally empty. Every row
   *  must be `head.length` long; asserted in `comparisons.test.ts`. */
  | { kind: 'table'; caption: string; head: string[]; rows: string[][] }

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
const table = (caption: string, head: string[], rows: string[][]): ArticleBlock =>
  ({ kind: 'table', caption, head, rows })

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
    // lastUpdatedISO moves to 2026-09-21: the internal link to page 2 is a
    // revision of this page's facts. publishedISO never moves.
    lastUpdated: '21 September 2026',
    lastUpdatedISO: '2026-09-21',
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
      // ⚠️ GTM-SEO-COMPARE-PRICE-01 — THIS PAGE AND PAGE 2 DISAGREE ON COOPAH'S
      // PRICE, and the internal link added below sends a reader straight from
      // one to the other. This page says £9.99/month billed annually; the
      // 17 Sep 2026 verification for `coopah-vs-runna` found £14.99/month or
      // £79.99/year from the App Store's own in-app-purchase listing, backed
      // by two independent 2026 reviews (Tom's Guide, Running.Reviews), and
      // could not reproduce £9.99 from any source. NOT changed here on
      // purpose: correcting a competitor's price is the founder's call, not a
      // silent edit, in case there is a promo or regional variance. Filed as
      // GTM-SEO-COMPARE-PRICE-01. Fix by moving both to one owner, not by
      // editing two strings.
      p(
        `It costs £9.99 a month, billed annually, and runs on both iOS and Android. The free trial is a week, stretched to two if you come through a London Marathon Events code. If you want to compare against a free structure first, `,
        { text: 'my 16-week marathon plan', href: '/plans/marathon-16-week' },
        ` is public whether or not you ever install anything.`,
      ),
      p(`I haven't trained on Coopah myself, so I won't invent a complaint about how the coaching logic behaves week to week. What I can tell you honestly is the size difference: Coopah has raised roughly £1.5m in seed funding, against Runna's position now inside Strava. If you're weighing depth of investment and pace of development, that's the real comparison.`),
      p(
        `I've since written `,
        { text: 'a longer, three-way comparison', href: '/coopah-vs-runna' },
        ` between Coopah, Runna and ${BRAND.name} if you want the full breakdown.`,
      ),

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
  {
    slug: 'coopah-vs-runna',
    metaTitle: `Coopah vs Runna vs ${BRAND.name}: an honest comparison`,
    metaDescription:
      `Coopah, Runna and ${BRAND.name}: real prices, real platforms, and where each one genuinely beats mine.`,
    ogTitle: `Coopah vs Runna vs ${BRAND.name}: an honest comparison`,
    ogDescription:
      `Coopah, Runna and ${BRAND.name}: real prices, real platforms, and where each one genuinely beats mine.`,
    h1: `Coopah vs Runna vs ${BRAND.name}: an honest comparison`,
    lastUpdated: '21 September 2026',
    lastUpdatedISO: '2026-09-21',
    publishedISO: '2026-09-21',
    signature: `Written by Russ Shear, who built ${BRAND.name} after running 100km in July 2026 and walking the last 40 of it.`,
    appStoreLinkText: `Get ${BRAND.name} on the App Store`,
    hubSummary: `Coopah has the London Marathon partnership, Runna has Strava's budget. What each actually costs, and who each is for.`,
    body: [
      p(`If you're choosing between Coopah and Runna, the short answer is Coopah for a London Marathon Events race specifically, Runna for almost everyone else who wants a well-funded, polished coaching app on either iOS or Android. I built ${BRAND.name}, and it's the right answer for a narrower group: iPhone-only runners who don't want streaks, badges or a feed attached to their training. This page covers all three honestly, including where mine comes last.`),

      h2('The comparison'),
      table(
        `Coopah, Runna and ${BRAND.name} compared on price, platform, watch sync and what each one is built on.`,
        ['', 'Coopah', 'Runna', BRAND.name],
        [
          ['Price', '£14.99/month or £79.99/year', '£15.99/month or £99.99/year', '£7.99/month or £59.99/year'],
          ['Platforms', 'iOS, Android', 'iOS, Android', 'iOS only'],
          ['Plan adapts to your training', 'Yes', 'Yes', 'Yes (free tier rule-based, paid tier AI-enriched)'],
          ['Watch sync', 'Apple Watch, Garmin, Coros, Polar', 'Apple Watch, Garmin, Fitbit, Coros', 'None. No Garmin workout export'],
          ['Streaks, badges, social feed', 'None advertised', `None in the app itself, but bundled into Strava's kudos and segments if you link the two`, 'None. No feed at all'],
          ['Who builds it', 'VC-backed team, roughly £1.5m raised', `Strava's engineering team, since the 2025 acquisition`, 'One person'],
          ['Free tier', 'One week trial, no ongoing free plan', 'Seven day trial, no ongoing free plan', 'Genuine free tier: a full plan, not a demo'],
        ],
      ),

      h2('Coopah'),
      p(`Coopah is the official training app of London Marathon Events, which covers the TCS London Marathon, the Brighton Marathon, the Big Half and the Vitality London 10,000. If you're running one of those, that partnership is worth something real: taper timing built around the actual event, event-specific messaging, and a discount code through the race itself.`),
      p(`Outside of an LME event, the case for Coopah is the coaching, not the badge on the app. It leans on 24/7 coach access, AI-generated answers plus real human coaches, and a weekly report that breaks down what you actually did against what was planned. That's a genuinely different product shape to Runna or ${BRAND.name}, closer to a human coach with software wrapped around it than an adaptive plan generator on its own.`),
      p(`It costs £14.99 a month, or £79.99 a year if you pay upfront. It runs on iOS and Android, and syncs with Apple Watch, Garmin, Coros and Polar. The free trial is a week. I haven't trained on it myself, so I won't invent an opinion on how the coaching logic behaves week to week. What I can tell you is the size of the operation behind it: roughly £1.5m in seed funding, a real team, and an official race partnership that neither Runna nor ${BRAND.name} has.`),

      h2('Runna'),
      p(`Runna is the biggest app in this category and it earned that position. The plans are well regarded, it runs on iOS and Android, it syncs with Apple Watch, Garmin, Fitbit and Coros, and the plan genuinely adapts as you log runs rather than staying fixed from day one.`),
      p(`Strava announced its acquisition of Runna in 2025 and the deal has closed. Runna says it's staying a standalone app "for the foreseeable future," and you can still buy a Runna subscription on its own without touching Strava at all. But the two are now one company, and if you link them, Runna's training sits next to Strava's kudos, segments, leaderboards and Local Legend badges. If you'd rather keep your coach and your social feed in separate apps, that's worth knowing before you commit.`),
      p(
        `It costs £15.99 a month, or £99.99 a year paid upfront, making it the most expensive of the three. For most people choosing a first coaching app, on either platform, with the most development resource behind it, Runna is still the safe recommendation. I said the same thing on `,
        { text: 'the alternatives page', href: '/runna-alternatives' },
        ` I wrote before this one, and nothing here changes that.`,
      ),

      h2(BRAND.name),
      p(`Mine. £7.99 a month, or £59.99 a year, and the free tier is a genuine free tier: a full plan, not a seven-day trial that expires into a paywall. No streaks, no badges, no leaderboards, no feed of any kind. The whole app is built around telling you when to hold back, because I ran a 100km race in July, went out too hard on the descents because nothing was telling me to stop, and walked the last 40km of it.`),
      p(`It's iOS only, iPhone and Apple Silicon Mac, nothing on Android, so if you're comparing three apps because you're on Android, ${BRAND.name} was never in this race. There's no Garmin workout export either. If you live on a Garmin watch and want sessions pushed to it automatically, that's a real gap, not a small one, and both Coopah and Runna do this natively. And it's built by one person working around a full-time contracting job, so feature development moves slower than either of the other two, both of which have funded teams behind them.`),

      h2('Which one'),
      p(`Training for the TCS London Marathon, Brighton Marathon, the Big Half or the Vitality London 10,000: Coopah, for the event partnership alone. Want the most established app, the widest platform support and don't mind Strava owning the company behind it: Runna, still the default answer for most runners in this category.`),
      p(
        `${BRAND.name} is the narrow case. iPhone only, no interest in a training app that also wants to be a social feed, and you've already worked out, or you're about to, that the thing that ends most people's races isn't a lack of fitness. It's not knowing when to hold back. If that's you, `,
        { text: 'my free plans', href: '/plans' },
        ` are there to try before you pay anyone anything, mine included.`,
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
