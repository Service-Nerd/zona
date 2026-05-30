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
   * The AI coach's name. Used in CoachByline, CoachNoteBlock, coach identity card,
   * and anywhere the AI coach is named in-product. Change here → changes everywhere.
   * Never hardcode 'Kit' in components — always reference BRAND.coachName.
   */
  coachName: 'Kit',

  /**
   * App Store subtitle (30 chars max). Discovery surfaces: App Store, landing page, paid ads.
   * Functional and outward-facing — describes what the app does.
   * Length budget: 29/30 chars. Do not exceed without re-trimming.
   */
  appStoreSubtitle: 'Plans that stop overtraining.',

  /** Primary tagline. Use on login, loading, OG image, in-app footer moments. Names the user. */
  tagline: "Slow down. You've got a day job.",

  /**
   * Brand statement. Editorial/voice contexts only — privacy footer, App Store description.
   * Personality moment, not a feature description. Never use alongside tagline on the same surface.
   * NOT used on login — tagline already owns that space.
   */
  brandStatement: "You can't outrun your easy days.",

  /** Sub-text shown below the sign-in card heading. */
  signinSub: 'Pick it up where you left off.',

  /** Sub-tagline used in signup context only. The brand doesn't pitch — it states. */
  signupSub: '14 days, no limits. After that, you decide.',

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
   * Day-one body offers Apple Health; the screen absorbs Strava as an equal
   * second CTA when approved without changing the ask copy.
   */
  connect: {
    ask:     "Kit needs your runs to do anything useful.",
    subline: "Without them, he's coaching blind.",
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
  },

  trialDays: 14,
} as const
