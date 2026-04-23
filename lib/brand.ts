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

  /** Primary tagline. Use on login, loading, marketing site, push notifications, OG image. */
  tagline: "Slow down. You've got a day job.",

  /**
   * Brand statement. Use for editorial contexts — about page, App Store description, press.
   * Not a UI surface tagline; too long for compact use.
   */
  brandStatement: "Slow down. You're not Kipchoge.",

  /** Sub-tagline used in login/signup context. Zona doesn't pitch — it states. */
  signupSub: '14 days, no limits. After that, you decide.',

  /**
   * Raw hex values for next/og ImageResponse — CSS variables don't work there.
   * Must stay in sync with System B palette in globals.css.
   */
  og: {
    navy:     '#0B132B',
    teal:     '#5BC0BE',
    offWhite: '#F7F9FB',
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
