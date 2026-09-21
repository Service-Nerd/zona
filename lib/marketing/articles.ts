// The marketing ARTICLE catalogue — comparisons and guides.
//
// ⚠️ RENAMED FROM `comparisons.ts` on 2026-09-21 (W-01), at the moment it
// stopped holding only comparisons. The alternative was a catalogue called
// COMPARISON_ARTICLES that contains guides, and this repo already carries the
// standing cost of exactly that: `strava_activities` is documented in
// CLAUDE.md as "a v1 misnomer, read it as the run log", years after the name
// stopped being true. A name is cheapest to fix on the day it starts lying.
//
// ⚠️ AND NO THIRD CATALOGUE. W-01 was scoped as a guides hub mirroring this
// file and `plans.ts`. It is not: a guide IS an article — same blocks, same
// renderer, same hub shape, same JSON-LD, same tests. A third copy of this
// machinery would have been the third writer of one pattern, which is the
// failure this codebase names more often than any other. `kind`
// discriminates; the hubs filter.
//
// GTM-SEO-COMPARE-01 (comparisons) + W-01 (guides).
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

import { BRAND, PRICING } from '@/lib/brand'
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

export type ArticleKind = 'comparison' | 'guide'

/**
 * W-01c — what a guide is FOR, which is how a reader looking for one thinks.
 *
 * The hub groups by this rather than listing eight titles flat. The buckets
 * are the four questions the eight planned guides actually answer, not a
 * taxonomy invented first and filled in after.
 *
 * ⚠️ GROUPING ACTIVATES ONLY WHEN TWO OR MORE BUCKETS HAVE SOMETHING IN THEM,
 * and that is not a hedge. Wood's objection to the hub at all was that a
 * short list with structure imposed on it reads as ABANDONED: four headings
 * over one article advertises three empty rooms. Below the threshold the hub
 * renders flat and looks deliberate, which it is. The structure is here so
 * the second guide switches it on rather than needing a build.
 */
export const GUIDE_INTENTS = [
  { id: 'easy',      label: 'Running easy' },
  { id: 'week',      label: 'Building the week' },
  { id: 'wrong',     label: 'When it goes wrong' },
  { id: 'kit',       label: 'Zones and kit' },
] as const

export type GuideIntent = (typeof GUIDE_INTENTS)[number]['id']

export interface MarketingArticle {
  /** Which hub this belongs to, and which breadcrumb it renders. Comparisons
   *  answer "which app should I use"; guides answer "what should I do". */
  kind: ArticleKind
  /** Guides only: which hub group it sits in. Required for a guide, asserted
   *  in `articles.test.ts` — an ungrouped guide would silently vanish from a
   *  grouped hub, which is the worst of the available failures. */
  intent?: GuideIntent
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
  /**
   * GUIDES ONLY, and required on them — the `CoachingPrinciples.md` sections
   * this guide's claims rest on, e.g. `['§12', '§2']`.
   *
   * ⚠️ WHY A FIELD AND NOT A CONVENTION (SLT 2026-09-21, Hutchinson).
   * Three of the eight planned guides answer COACHING questions under a Zonna
   * byline, on the open web, to people with no plan in front of them: "should
   * my easy runs feel this slow" (§12), "am I overtraining or just tired"
   * (§2/§3), "what pace should my long run be" (§52). **That is a coaching
   * surface, and it does not become a marketing surface because it lives at
   * /guides.** If the article and the engine disagree we have published a
   * position we do not implement, which is this codebase's most frequently
   * recorded failure: prose drifting from the rule it describes.
   *
   * The rule the board set is deliberately cheap to obey: **a guide may only
   * assert what an existing principle already asserts, and it names the
   * section.** A claim no principle covers is a Coaching Board item BEFORE it
   * is a writing task.
   *
   * ⚠️ This field cannot check that the claims MATCH the sections. It checks
   * that somebody had to name one, which is the point at which the question
   * gets asked at all.
   */
  principleRefs?: readonly string[]
  /** One line for the /compare hub card: what this page actually answers.
   *  REQUIRED on purpose. A hub entry that has to be written is a hub entry
   *  that exists; deriving it from the meta description would produce eight
   *  near-identical cards. */
  hubSummary: string
}

/**
 * COMPETITOR FACTS — the single owner (D-08) of every figure these articles
 * quote about someone else's product.
 *
 * ⚠️ WHY THIS EXISTS. Page 1 said Coopah cost £9.99 a month billed annually.
 * Page 2, verified independently four months later, said £14.99 a month or
 * £79.99 a year. Both were live at once, and page 1's link to page 2 sat three
 * sentences after its own figure. Neither was right: the founder confirmed the
 * annual price on 2026-09-21 as £119.99.
 *
 * That is not a typo, it is the configuration singularity applied to the wrong
 * kind of value. EIGHT articles are planned and every one of them will quote
 * these numbers. Fixing two strings would have left six pages free to disagree
 * again, so the figures live here with their source and the date they were
 * checked, and `comparisons.test.ts` fails the build on any price in any
 * article that is not one of these or our own.
 *
 * ⚠️ WHEN YOU REVISE A FIGURE, move `verified` with it, and move the
 * `lastUpdatedISO` of every article that quotes it. A competitor's price is
 * the fastest-rotting fact on these pages.
 */
export interface CompetitorFacts {
  name: string
  /** Display form including the symbol, e.g. '£14.99'. Null where we do not
   *  publish a monthly figure for this product. */
  monthly: string | null
  /** Display form including the symbol, e.g. '£119.99'. */
  annual: string | null
  /** Where the figures came from, named so a future revision can re-check it. */
  source: string
  /** ISO date the figures above were last checked against that source. */
  verified: string
}

export const COMPETITOR_FACTS: Record<'coopah' | 'runna' | 'trainasone', CompetitorFacts> = {
  coopah: {
    name: 'Coopah',
    // ⚠️ The MONTHLY figure is the weaker of the two. £14.99 comes from the
    // App Store's in-app-purchase listing (17 Sep 2026) and two independent
    // 2026 reviews; the ANNUAL figure is the founder's own correction on
    // 2026-09-21, which superseded both the £79.99 that verification found and
    // the £9.99-billed-annually page 1 had carried since 10 Sep. Re-check the
    // monthly against the same source next revision.
    monthly: '£14.99',
    annual: '£119.99',
    source: 'App Store in-app-purchase listing; annual corrected by the founder',
    verified: '2026-09-21',
  },
  runna: {
    name: 'Runna',
    monthly: '£15.99',
    annual: '£99.99',
    source: 'runna.com/en-gb/pricing',
    verified: '2026-09-17',
  },
  trainasone: {
    name: 'TrainAsONE',
    monthly: '£9.99',
    annual: '£99',
    source: 'trainasone.com pricing',
    verified: '2026-09-10',
  },
}

const price = (k: keyof typeof COMPETITOR_FACTS) => COMPETITOR_FACTS[k]

const p = (...spans: ArticleSpan[]): ArticleBlock => ({ kind: 'p', spans })
const h2 = (text: string): ArticleBlock => ({ kind: 'h2', text })
const table = (caption: string, head: string[], rows: string[][]): ArticleBlock =>
  ({ kind: 'table', caption, head, rows })

export const MARKETING_ARTICLES: MarketingArticle[] = [
  {
    kind: 'comparison',
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
      p(`The other reason people look elsewhere is price. Runna is ${price('runna').monthly} a month, or ${price('runna').annual} a year paid upfront. That's not unreasonable for what you get, but it's more than a lot of people expect to pay for a training plan, and it's worth knowing what else is out there before deciding it's the only option.`),

      h2('Coopah'),
      p(`Coopah is the official training app of London Marathon Events: the TCS London Marathon, Brighton Marathon, the Big Half, the Vitality London 10,000. If you're training for one of those specifically, that partnership buys you something real: aligned taper timing, event-specific messaging, and a discount code through the race itself.`),
      // GTM-SEO-COMPARE-PRICE-01, CLOSED 2026-09-21. This page carried
      // "£9.99 a month, billed annually" from 10 Sep while page 2 published
      // £14.99/£79.99, with page 1's link to page 2 three sentences below it.
      // Both now read `COMPETITOR_FACTS`, which is the only fix that survives
      // six more articles.
      p(
        `It costs ${price('coopah').monthly} a month, or ${price('coopah').annual} a year, and runs on both iOS and Android. The free trial is a week, stretched to two if you come through a London Marathon Events code. If you want to compare against a free structure first, `,
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
      p(`TrainAsONE has the broadest reach of anything on this page: iOS, Android, Garmin and a web app, plus a genuine free tier before you hit a paywall. Premium is ${price('trainasone').monthly} a month, or ${price('trainasone').annual} a year.`),
      p(`It's an AI-adaptive plan generator: the next session changes based on the one you actually ran, not just the one you were given. That's the same core idea Runna and ${BRAND.name} both use, built by a much smaller team with none of Strava's budget behind it. Same honesty as above: I haven't used it enough to tell you where the plan logic breaks down, only what it costs and what it runs on.`),

      h2(BRAND.name),
      p(`Mine. ${PRICING.monthly.display} a month, or ${PRICING.annual.display} a year, and the free tier stays a genuine free tier: a full plan, not a seven-day demo. No streaks, no badges, no leaderboards, no feed. The whole app is built around telling you when to hold back, because I ran a 100km race in July, went out too hard on the descents because nothing was telling me to stop, and walked the last 40km of it.`),
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
    kind: 'comparison',
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
          ['Price', `${price('coopah').monthly}/month or ${price('coopah').annual}/year`, `${price('runna').monthly}/month or ${price('runna').annual}/year`, `${PRICING.monthly.display}/month or ${PRICING.annual.display}/year`],
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
      p(`It costs ${price('coopah').monthly} a month, or ${price('coopah').annual} a year if you pay upfront. It runs on iOS and Android, and syncs with Apple Watch, Garmin, Coros and Polar. The free trial is a week. I haven't trained on it myself, so I won't invent an opinion on how the coaching logic behaves week to week. What I can tell you is the size of the operation behind it: roughly £1.5m in seed funding, a real team, and an official race partnership that neither Runna nor ${BRAND.name} has.`),

      h2('Runna'),
      p(`Runna is the biggest app in this category and it earned that position. The plans are well regarded, it runs on iOS and Android, it syncs with Apple Watch, Garmin, Fitbit and Coros, and the plan genuinely adapts as you log runs rather than staying fixed from day one.`),
      p(`Strava announced its acquisition of Runna in 2025 and the deal has closed. Runna says it's staying a standalone app "for the foreseeable future," and you can still buy a Runna subscription on its own without touching Strava at all. But the two are now one company, and if you link them, Runna's training sits next to Strava's kudos, segments, leaderboards and Local Legend badges. If you'd rather keep your coach and your social feed in separate apps, that's worth knowing before you commit.`),
      p(
        `It costs ${price('runna').monthly} a month, or ${price('runna').annual} a year paid upfront, making it the most expensive per month of the three. For most people choosing a first coaching app, on either platform, with the most development resource behind it, Runna is still the safe recommendation. I said the same thing on `,
        { text: 'the alternatives page', href: '/runna-alternatives' },
        ` I wrote before this one, and nothing here changes that.`,
      ),

      h2(BRAND.name),
      p(`Mine. ${PRICING.monthly.display} a month, or ${PRICING.annual.display} a year, and the free tier is a genuine free tier: a full plan, not a seven-day trial that expires into a paywall. No streaks, no badges, no leaderboards, no feed of any kind. The whole app is built around telling you when to hold back, because I ran a 100km race in July, went out too hard on the descents because nothing was telling me to stop, and walked the last 40km of it.`),
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
  // ── GUIDE 1 ────────────────────────────────────────────────────────────
  // SLT 2026-09-21: Claude drafts, the founder edits, supplies anything first
  // person, and READS IT END TO END before it ships. Nothing here is written
  // in his voice about his own running, by rule.
  //
  // ⚠️ `principleRefs` is not decoration. Hutchinson's ruling: this is a
  // COACHING surface, answering a coaching question under a Zonna byline to
  // someone with no plan in front of them. Every claim below traces to §12 or
  // its Amendment 1, and nothing here asserts anything the engine does not.
  {
    kind: 'guide',
    intent: 'easy',
    slug: 'should-easy-runs-feel-this-slow',
    principleRefs: ['§12', '§1', '§2'],
    metaTitle: 'Should easy runs feel this slow?',
    metaDescription:
      `Yes, and slower than that. Why your easy pace should feel almost embarrassing, what the ceiling actually is, and how to tell easy from lazy.`,
    ogTitle: 'Should easy runs feel this slow?',
    ogDescription:
      `Yes, and probably slower. What an easy run is actually for, and why running it "comfortably hard" is the thing costing you the race.`,
    h1: `Should easy runs really feel this slow?`,
    lastUpdated: '21 September 2026',
    lastUpdatedISO: '2026-09-21',
    publishedISO: '2026-09-21',
    signature: `Written by Russ Shear, who built ${BRAND.name} after running 100km in July 2026 and walking the last 40 of it.`,
    appStoreLinkText: `Get ${BRAND.name} on the App Store`,
    hubSummary: `Yes. And the reason it feels wrong is the same reason it works.`,
    body: [
      p(`Short answer: yes, and there is a reasonable chance it should be slower still. The feeling you are describing, that this cannot possibly be doing anything, is not a sign you have the pace wrong. For most runners it is the first sign they have it right.`),
      p(`The thing that is well established here is not a promise about what easy running will do for you. It is the problem: recreational runners consistently accumulate more moderate-effort work than they intend to. Ask a group what their easy pace is and then look at what they actually ran, and the gap is the whole story. That is where the stagnation comes from, and it is the specific thing this plan is built to stop.`),

      h2('What an easy run is actually for'),
      p(`An easy run is not a small hard run. It is a different session with a different job, and the job is aerobic adaptation: more capillaries, more mitochondria, a heart that moves more blood per beat. Those adaptations respond to time spent in the right zone, not to effort. You cannot hurry them by trying harder, and trying harder actively costs you, because the fatigue you generate has to be paid back out of the session that was supposed to be hard.`),
      p(`This is why the pace feels wrong. Every other kind of training you have done rewards effort. This one rewards patience, and patience feels like nothing is happening.`),
      p(`Worth being precise about what is being asked, because it is easy to hear the wrong thing: this is not about doing less. It is about where the effort goes. Most of your week is easy so that one day a week can be genuinely hard, and that hard day is the one that gets protected. Running everything at seven-tenths is not more work, it is the same work spread so thin that none of it lands.`),

      h2('The ceiling, and why it is a ceiling'),
      p(`${BRAND.name} caps every easy run at the top of Zone 2, which is roughly 60 to 70 percent of heart-rate reserve. The important word is cap. It is not a band you are supposed to sit inside and it is not a target to hit.`),
      p(
        `Going slower than the cap breaks nothing. An easy run at the very bottom of your range is a perfectly good easy run, and any app that flags it as a problem is measuring the wrong thing. We know because ours did: a detector we shipped counted time OUTSIDE the zone in both directions, and on review 6 of 22 flagged runs were predominantly too easy, the worst at 17 percent in zone with 83 percent below and nothing at all above. That was our bug, not the runner's. `,
        { text: 'The rule is a ceiling now', href: '/plans' },
        `, and it only looks down.`,
      ),

      h2('How slow, in practice'),
      p(`If you train by heart rate, the ceiling is the number. If you do not, the usable version is the talk test: you should be able to speak a full sentence without breaking it up to breathe. Not a word, not four words. A sentence.`),
      p(`For a lot of people that lands somewhere between 60 and 90 seconds per kilometre slower than the pace they have been calling easy. That gap is the entire problem, and it is why the runs have not been working.`),

      h2('Easy is not the same as lazy'),
      p(`The distinction that matters is not how hard it feels, it is what the session is for. A lazy run is one with no job. An easy run has a specific job and a specific ceiling, and staying under that ceiling on a day your legs feel good is harder than running fast. That is the discipline the whole method rests on.`),
      p(`The test is not the individual run, it is the week. If your easy days are genuinely easy, your hard day should feel available. If you arrive at the hard session already flat, the easy days were not easy, whatever your watch said.`),

      h2('One more reason, and it is not about speed'),
      p(`A week with most of its sessions genuinely easy and one properly hard day puts less cumulative mechanical load through your legs than four moderate-hard runs covering the same distance. That is arithmetic rather than a prediction, and it is a separate argument from the pace one. Nobody can tell you whether you personally will stay healthy. What can be said is which of two weeks asks more of the tissue, and it is not the one that feels harder to hold back on.`),

      h2('Why this is most of your week'),
      p(
        `In a ${BRAND.name} plan the large majority of your sessions are easy, and that ratio is the plan rather than a gap in it. Intensity is counted in sessions across the whole block, not minutes within a run, so one genuinely hard session in a week of genuinely easy ones is a complete week of training. `,
        { text: 'Every plan we publish is free to read', href: '/plans' },
        `, so you can count the easy days yourself before you believe anyone about this.`,
      ),

      h2('Week three is the hard part'),
      p(`Week one is a relief. Week two feels like cheating. Week three is when people quit the method, and it is worth knowing why in advance: your easy pace has not moved, the hard session has not felt dramatically better, and somebody you run with is training harder than you and saying so. That is the point at which most people quietly add ten seconds a kilometre back, and once they do they are in the grey zone for good.`),
      p(`Nothing has gone wrong at week three. That is just the shape of it. Aerobic adaptation is not fast and it is not dramatic, and the first month mostly buys you the ability to keep going.`),
      p(`The marker to watch is not a pace and it is not a heart rate. Both move with heat, sleep, caffeine and how your week went, by more than three weeks of adaptation will move them, so you will read noise and conclude it is not working. The question to ask instead is simpler and you already know the answer: when the hard session comes round, does it feel available? If your easy days were genuinely easy, it should. If you arrive at it already flat, they were not, whatever your watch said.`),
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
export function marketingArticleJsonLd(article: MarketingArticle) {
  return articleJsonLd({
    headline: article.metaTitle,
    datePublished: article.publishedISO,
    dateModified: article.lastUpdatedISO,
    description: article.metaDescription,
    url: `${APP_URL}${articlePath(article)}`,
  })
}

/**
 * Copy for the /compare hub. Here rather than in the page component for the same
 * reason the article copy is: a wording change touches one file, and the hub and
 * its cards cannot drift apart.
 */
export const COMPARISON_HUB = {
  slug: 'comparisons',
  metaTitle: `Running app comparisons`,
  metaDescription:
    `Honest comparisons of the running apps people choose between, including where ${BRAND.name} is the wrong answer. No affiliate links, no scores out of ten.`,
  eyebrow: 'Comparisons',
  h1: `Which running app, honestly.`,
  sub: `Comparisons of the coaching apps people actually choose between, including the ones that beat ${BRAND.name} and the runners it is wrong for. No affiliate links, no scores out of ten.`,
} as const

/**
 * The single owner of an article's URL (D-08).
 *
 * Comparisons sit at the ROOT (`/runna-alternatives`) because the search query
 * IS the slug: people type "runna alternatives". That reasoning does not carry
 * to a guide — nobody searches for a brand when they type "should my easy runs
 * feel this slow" — so guides sit under their hub, where the breadcrumb
 * (Home > Guides > ...) finally matches the URL it claims to describe.
 *
 * ⚠️ FOUR PLACES BUILT THIS STRING BY HAND before this existed: the hub link,
 * the sitemap, the Article JSON-LD and the page metadata. Four producers of
 * one fact, and the kind-dependent shape is exactly the sort of rule three of
 * them would have kept and one would have missed.
 */
export const articlePath = (a: Pick<MarketingArticle, 'kind' | 'slug'>): string =>
  a.kind === 'guide' ? `/${GUIDE_HUB.slug}/${a.slug}` : `/${a.slug}`

export const comparisonArticles = (): MarketingArticle[] =>
  MARKETING_ARTICLES.filter(a => a.kind === 'comparison')

export const guideArticles = (): MarketingArticle[] =>
  MARKETING_ARTICLES.filter(a => a.kind === 'guide')

/**
 * Guides bucketed by intent, in `GUIDE_INTENTS` order, empty buckets dropped.
 * The hub decides whether to USE the grouping (see `shouldGroupGuides`); this
 * only reports the shape.
 */
export function guidesByIntent(): { id: GuideIntent; label: string; articles: MarketingArticle[] }[] {
  const all = guideArticles()
  return GUIDE_INTENTS
    .map(g => ({ id: g.id, label: g.label, articles: all.filter(a => a.intent === g.id) }))
    .filter(g => g.articles.length > 0)
}

/**
 * Whether the hub should render groups at all.
 *
 * ⚠️ Two POPULATED BUCKETS, not two articles. Two guides in the same bucket
 * under one heading is a heading for no reason, and one bucket showing while
 * three stay hidden tells the reader nothing they can act on. Below the
 * threshold the hub renders flat, which is what it does today at one guide.
 */
export function shouldGroupGuides(): boolean {
  return guidesByIntent().length >= 2
}

/**
 * How many guides before the HUB opens.
 *
 * ⚠️ WAS 3, SET TO 1 BY FOUNDER DECISION 2026-09-21, overruling the SLT gate.
 * Recorded rather than quietly changed, because the board's reasoning was
 * sound and the risk it named is real.
 *
 * The original gate (Fried, on Wood's reasoning): *"a hub with two guides is
 * worse than no hub"* — a one-card index teaches a visitor the section is
 * abandoned. That is a genuine failure mode and removing the gate does not
 * remove it.
 *
 * **So it is answered in the design instead of by the number.** Below
 * `GUIDES_SECTION_MATURE` the hub says plainly that it is being written one
 * guide at a time. A section that tells you it is small reads as deliberate;
 * a section that shows you one card and says nothing reads as neglected. Same
 * page, opposite impression, and the difference is one sentence.
 *
 * THE CONSTANT STAYS rather than the gate being deleted: the mechanism and its
 * four reading surfaces are still correct, and a future decision to hold a new
 * section back is a one-line change instead of a rebuild.
 */
export const GUIDES_MIN_TO_PUBLISH = 1

/**
 * Is the guides HUB open? Not "is a guide live".
 *
 * ⚠️ THESE WERE ONE THING UNTIL 2026-09-21 AND CONFLATING THEM PRODUCED A
 * DEADLOCK between two SLT rulings from the same sitting:
 *
 *   Fried's cadence — "write ONE. Publish it. Do not write the second until
 *   the first has existed for a fortnight." The point is to learn whether
 *   anyone wants these before writing eight.
 *
 *   Wood's gate — the hub opens at three, because "a hub with one card teaches
 *   a visitor the section is abandoned."
 *
 * Gate the ARTICLE on the hub and Fried's ruling becomes unreachable: the
 * first guide can never exist for a fortnight, so the second is never written,
 * so the hub never opens. Both rulings are right and they are about different
 * objects. **Wood's objection is to a one-card HUB, not to a guide existing.**
 *
 * So: an approved guide in the catalogue is LIVE, at `/guides/<slug>`, and the
 * hub stays shut until three. A guide is not orphaned in the meantime — it is
 * linked in context from the homepage, which is a better inbound link than a
 * hub card anyway, and the breadcrumb already renders the hub unlinked while
 * it is closed (GUIDE-BREADCRUMB-01).
 */
export const guidesArePublished = (): boolean =>
  guideArticles().length >= GUIDES_MIN_TO_PUBLISH

/**
 * Is the section big enough to stand on its own, or should it say so?
 *
 * Separate from `guidesArePublished` on purpose: "should this hub exist" and
 * "should this hub explain itself" are different questions, and merging two
 * questions into one boolean is exactly what deadlocked the publish gate
 * against Fried's cadence earlier today.
 */
export const GUIDES_SECTION_MATURE = 3

export const guidesSectionIsMature = (): boolean =>
  guideArticles().length >= GUIDES_SECTION_MATURE

/** Copy for the /guides hub. Same shape and same reasoning as COMPARISON_HUB:
 *  a wording change touches one file, and hub and cards cannot drift apart. */
export const GUIDE_HUB = {
  slug: 'guides',
  metaTitle: `Running guides for people who go too hard`,
  metaDescription:
    `Straight answers to what runners actually ask at 10pm: how slow easy should feel, and whether you are overtraining or just tired.`,
  eyebrow: 'Guides',
  h1: `The questions you are actually asking.`,
  sub: `Not a library of tempo-run explainers. The specific things that go wrong when you are trying hard and it is not working, answered plainly.`,
} as const

export function getArticle(slug: string): MarketingArticle | undefined {
  return MARKETING_ARTICLES.find(a => a.slug === slug)
}
