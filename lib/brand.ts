/**
 * Single source of truth for all brand strings and pricing.
 * Change here → changes everywhere. Never hardcode these values in components.
 *
 * Tagline choice: "Slow down. You've got a day job." over "The slowest way to get faster."
 * Both are good. This one wins because it speaks directly to the target user's identity —
 * the person with a job and a training plan who keeps running too hard. "The slowest way..."
 * describes an approach; "You've got a day job." names a person. Runna would never say this.
 */

export const BRAND = {
  name: 'Zonna',

  /**
   * Surname half of the profile name-field placeholder pair. The first half is
   * `name` itself, so the pair reads as the product standing in for a person:
   * it demonstrates the shape of the field without looking like a stored value.
   *
   * WHY THIS EXISTS AS A CONSTANT. The placeholders used to be the founder's
   * own first and last name, which read as data rather than as a prompt: a test
   * account showed "Russell / Shear" greyed out and the account holder could not
   * tell whether the app had their name or not. Deriving the first half from
   * `name` means a rebrand carries it (see the brand-name history in CLAUDE.md);
   * this surname half is the only part that is its own string, and it is
   * deliberately a plain word so it survives a rename beside any brand name.
   */
  surnamePlaceholder: 'Run',

  /**
   * The AI coach's name. Used in CoachByline, CoachNoteBlock, coach identity card,
   * and anywhere the AI coach is named in-product. Change here → changes everywhere.
   * Never hardcode 'Kit' in components — always reference BRAND.coachName.
   */
  coachName: 'Kit',

  /**
   * App Store subtitle (30 chars max). Discovery surfaces: App Store, landing page, paid ads.
   * Functional and outward-facing — describes what the app does.
   * Value matches the LIVE App Store subtitle (reconciled 2026-06-15) and names the runner
   * ("you"), staying true to the locked functional line "Training plans that stop you overtraining."
   * Length budget: 30/30 chars exactly — no trailing period (a period would push it to 31).
   * Do not exceed without re-trimming.
   */
  appStoreSubtitle: 'Plans to stop you overtraining',

  /**
   * Marketing-site H1 (SEO-01, 2026-09-02). Web only — no length limit.
   *
   * SEPARATE FROM `appStoreSubtitle` ON PURPOSE, and they must not be merged.
   * The subtitle is capped at 30 characters by Apple and is currently 30/30; this
   * string is 38 and would be rejected by App Store Connect. They are also
   * different jobs: the subtitle is constrained by a third party and mirrors the
   * live listing, this one is search copy we control and carries the "running"
   * keyword the subtitle has no room for.
   *
   * `appStoreSubtitle` still drives og:title / twitter:title, where brand-first
   * is correct for social sharing. Changing this string does not touch those.
   */
  marketingH1: 'Running plans to stop you overtraining',

  /** Primary tagline. Use on login, loading, OG image, in-app footer moments. Names the user. */
  tagline: "Slow down. You've got a day job.",

  /**
   * Brand statement. Editorial/voice contexts only — privacy footer, App Store description.
   * Personality moment, not a feature description. Never use alongside tagline on the same surface.
   * NOT used on login — tagline already owns that space.
   */
  brandStatement: "You can't outrun your easy days.",

  /**
   * The CORE TRUTH — the thesis the whole product rests on, and the line the
   * founder story turns on. CLAUDE.md § Positioning has named it since launch;
   * it was never parameterised, so it sat hardcoded in BOTH founder surfaces
   * with DIFFERENT apostrophe entities (`&rsquo;` on /about, `&apos;` in the
   * app) — the same sentence rendering as two different characters, which is
   * precisely what "all brand strings are parameterised" exists to prevent
   * (GTM-SITE-03, 2026-09-12).
   *
   * Not a fourth tagline. It is the thesis, used as a pull-line where the story
   * is being told — never on login, never alongside `tagline` or
   * `brandStatement` on the same surface.
   */
  coreTruth: 'You\u2019re trying hard. That\u2019s the problem.',

  /**
   * The founder, as the site refers to him.
   *
   * ⚠️ PARAMETERISED FOR EXACTLY THE REASON `coreTruth` WAS (GTM-SITE-03): one
   * person was appearing under two names. The homepage's SoftwareApplication
   * `author` and the /about and legal pages said "Russell Shear"; every
   * article's Article `author` said "Russ Shear". To a crawler those are two
   * authors, which is the opposite of what an author field is for, and to a
   * reader who lands on a guide and then /about it reads as a different
   * person. He goes by Russ.
   *
   * `legalName` is separate and is NOT a style choice: the privacy policy and
   * terms name the operator of the service, and that is a legal identification
   * rather than a byline.
   */
  founder: {
    /** Byline, structured-data author, prose. */
    name: 'Russ Shear',
    /** First name alone, where the copy is conversational. */
    firstName: 'Russ',
    /** Operator of the service. Legal surfaces only. */
    legalName: 'Russell Shear',
  },

  /** Sub-text shown below the sign-in card heading. */
  signinSub: 'Pick it up where you left off.',

  /** Sub-tagline used in signup context only. The brand doesn't pitch — it states. */
  signupSub: '14 days, no limits. After that, you decide.',

  /**
   * HR-SYNC-04 — pre-purchase expectation-setter. Zone coaching needs a heart-rate
   * stream, and ~73% of logged runs currently arrive without one (INSTRUMENT-01,
   * v_hr_present_pct). Surfacing this before purchase reduces wrong-fit conversions
   * that would churn at the no-HR-card moment. Voice-neutral — states, never shames
   * or upsells. Phrased name-free so it's rename-safe. Surfaces: UpgradeScreen
   * pre-purchase copy, marketing landing (app/page.tsx). (No waitlist confirmation
   * email exists yet — carry this line into the launch email when that ships.)
   */
  hrRecommendation: 'Works best with an Apple Watch or a heart-rate strap that syncs to Apple Health.',

  /**
   * App Store presence (marketing site). `url` is empty until the app is approved
   * and live — the marketing page renders a "coming soon" badge + waitlist while
   * `url` is falsy, then a live "Download on the App Store" link once it's set.
   * Set `url` to the App Store product URL on approval day. Single source of truth.
   */
  appStore: {
    url: 'https://apps.apple.com/app/id6767516424',
    comingSoonLabel: 'Coming soon to the App Store',
    liveLabel: 'Download on the App Store',
    /**
     * P-14(a) — the passive "Leave a review" row on Me → Support.
     *
     * ⚠️ MUST TRACK `url`. It is the same product page with Apple's
     * write-review action appended; a second hardcoded App Store ID is a
     * second thing to get wrong on the day the ID changes, and this block
     * already declares itself the single source of truth. `brandAppStore
     * .test.ts` re-derives it and fails if the two drift.
     *
     * ⚠️ THE ROW MUST NOT RENDER WHEN `url` IS EMPTY. This block's own note
     * says `url` is blank until the app is approved; a review link to a page
     * that does not exist is worse than no link, so the caller gates on it.
     */
    reviewUrl: 'https://apps.apple.com/app/id6767516424?action=write-review',
  },

  /**
   * Resolved hex values for the next/og ImageResponse route. @vercel/og runs in
   * the edge runtime without a DOM, so CSS custom properties from globals.css
   * cannot resolve there — these values mirror the Warm Slate tokens 1:1 and
   * must be kept in sync with app/globals.css.
   *
   * Token mapping:
   *   bg   ← var(--bg)
   *   ink  ← var(--ink)
   *   moss ← var(--moss)
   *   mute ← var(--mute)
   */
  og: {
    bg:   '#F3F0EB',
    ink:  '#1A1A1A',
    moss: '#6B8E6B',
    mute: '#8A857D',
  },

  /**
   * In-product voice anchor. Use across push notifications, coach cards, and session prompts
   * where the message is about committing to the prescribed zone — easy or hard.
   * Not for marketing copy. Not for the login screen. Product-internal only.
   */
  voiceAnchor: 'Hold the zone.',

  /**
   * Secondary brand phrase — social, content, and about pages only.
   * Never in primary marketing copy. Never in the product UI.
   * Not a BRAND constant in the code sense — do not reference from components.
   */
  secondaryPhrase: 'Train within the lines.',

  /**
   * Connect-Your-Runs onboarding (CONNECT-01).
   * Sutherland signalling — a dedicated screen instead of a settings checkbox.
   * Day-one body offers Apple Health (the SOR per ADR-011). When Strava
   * approval lands, the screen adds Strava as a *secondary supplement* CTA
   * below HK — not a peer. Copy never frames Strava as required or primary.
   */
  connect: {
    ask:     "Kit needs your runs to do anything useful.",
    subline: "Without them, he's coaching blind.",
  },

  /**
   * Push-permission onboarding screen (PUSH-ONBOARD).
   * Surfaces after the Connect-Your-Runs screen. Same ceremony pattern.
   */
  notify: {
    ask:     "One ping a day. That's it.",
    subline: 'Your session and zone, each morning before you head out. Nothing else.',
  },

  /** Push notification titles — each is a coaching voice opportunity, not a label. */
  push: {
    weeklyReport: 'Your week, reviewed.',
    runAnalysis:  "That's done. Kit's reading.",
    /**
     * One-shot mid-trial reciprocity nudge (HOOK-02). Fires once between
     * trial day 3 and day 5 when the user has ≥2 analysed runs. Body is the
     * first sentence of the latest `run_analysis.feedback_text`.
     */
    trialInsight: 'Kit noticed something.',
    /**
     * Engine auto-applied a plan adjustment (NOTIF-01). Title only — the body
     * carries the rule-engine summary of what changed. Voice opportunity, not
     * a label: the change happened *to* the runner, so the tone is calm
     * reassurance, not alarm.
     */
    planAdjusted: "Plan's been shifted.",
    /**
     * Engine detected a change that requires the runner's confirmation.
     * Curiosity-gap framing (Sutherland): "Kit noticed something." creates
     * the question "what?" — which is the mechanism that gets it opened.
     * Body carries the AI explanation. Deep-links to Me → "1 change pending".
     */
    planNeedsReview: 'Kit noticed something.',
  },
} as const

/**
 * All pricing in GBP. Change once here — reflected in UpgradeScreen, checkout, marketing site.
 * Stripe price IDs remain in env vars (STRIPE_PRICE_MONTHLY, STRIPE_PRICE_ANNUAL).
 */
export const PRICING = {
  currency: 'GBP',
  symbol: '£',

  monthly: {
    amount: 7.99,
    display: '£7.99',
    label: '£7.99 / month',
    /** P-09 — see the note on `annual.perWeekDisplay`. */
    perWeekDisplay: '£1.84 / week',
  },

  annual: {
    amount: 59.99,
    display: '£59.99',
    label: '£59.99 / year',
    perMonthEquiv: 5.0,
    perMonthDisplay: '£5 / month',
    savingPercent: 37,
    /** Honest saving copy — replaces "BEST VALUE" which is banned. */
    savingLabel: 'Save 37% / year',
    /**
     * P-09 — the per-WEEK figure, because a subscription to a running app is
     * bought against a weekly habit and £59.99 is not a number anyone feels.
     *
     * ⚠️ A CONSTANT, NOT ARITHMETIC IN A COMPONENT. ADR-015 / INV-CFG-001: a
     * price derived at the render site is a second source of truth for a
     * number that has exactly one, and `lib/marketing/pricing.test.ts` cannot
     * see it there.
     *
     * ⚠️ THE TEARDOWN'S FIGURES WERE WRONG AND THE REAL ONES ARE BETTER. The
     * brief suggested "~80p per week", which implies £41.60/year and is not
     * our price. 59.99 / 52 = £1.15; 7.99 × 12 / 52 = £1.84. **Our annual is
     * already cheaper per week than the competitor's £1.54, with no price
     * change** — a fact worth stating rather than a discount worth inventing.
     */
    perWeekDisplay: '£1.15 / week',
  },

  trialDays: 14,

  /**
   * P-09 — the trial timeline. Three rows, on the paywall.
   *
   * ⚠️ EVERY ROW IS VERIFIED AGAINST WHAT THE SYSTEM ACTUALLY DOES, because
   * `TIER-TRIAL-CONFIDENCE-01` was a live false claim of exactly this kind:
   * the marketing site said "Two weeks, full access" while the trial silently
   * did not receive `confidence_score`. It was fixed at the root rather than
   * softened, so the claim is now true — and it was checked again here before
   * being written down: **0 of 21 gated features are denied to `trial`.**
   *
   * Day 11 is not a marketing choice either: `trialEmailWindow` sends the
   * "3 days left." nudge three days before expiry, so on a 14-day trial that
   * IS day 11. If `trialDays` changes, these day numbers are wrong — which is
   * why `brandPricing.test.ts` derives them rather than trusting the strings.
   *
   * ⚠️ NO COUNTDOWN AND NO URGENCY. The teardown's competitor shows an exit
   * price that undercuts its own headline by £24, which teaches the runner the
   * first two prices were theatre. A timeline states what happens; it does not
   * pressure.
   */
  trialTimeline: [
    { day: 1,  label: 'Today',        detail: 'Full access. Every paid feature, nothing held back.' },
    { day: 11, label: 'Day 11',       detail: 'We email you three days before it ends. No surprise charge.' },
    { day: 14, label: 'Day 14',       detail: 'It ends. You keep your plan and drop to the free tier.' },
  ],
} as const
