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
  name: 'Zona',

  /**
   * App Store subtitle (30 chars max). Discovery surfaces: App Store, landing page, paid ads.
   * Functional and outward-facing — describes what Zona does.
   */
  appStoreSubtitle: 'Training plans that stop you overtraining.',

  /** Primary tagline. Use on login, loading, OG image, in-app footer moments. Names the user. */
  tagline: "Slow down. You've got a day job.",

  /**
   * Brand statement. Editorial/voice contexts only — privacy footer, App Store description.
   * Personality moment, not a feature description. Never use alongside tagline on the same surface.
   * NOT used on login — tagline already owns that space.
   */
  brandStatement: "You can't outrun your easy days.",

  /** Sub-text shown below the sign-in card heading. */
  signinSub: 'Access your training plan.',

  /** Sub-tagline used in signup context only. Zona doesn't pitch — it states. */
  signupSub: '14 days, no limits. After that, you decide.',

  /**
   * Raw hex values for next/og ImageResponse — CSS variables don't work there.
   * DEPRECATED — remove once OG image regenerated with Warm Slate palette (see ADR-007).
   * These reference the retired System B palette; kept only to avoid breaking the OG route
   * before the visual update lands in Phase 2.
   */
  og: {
    navy:     '#0B132B', // DEPRECATED — retire with Phase 2 OG image update
    teal:     '#5BC0BE', // DEPRECATED — retire with Phase 2 OG image update
    offWhite: '#F7F9FB', // DEPRECATED — retire with Phase 2 OG image update
  },

  /** Push notification titles — each is a coaching voice opportunity, not a label. */
  push: {
    weeklyReport: 'Your week, reviewed.',
    runAnalysis:  'Run logged.',
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
