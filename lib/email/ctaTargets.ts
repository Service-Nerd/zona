// ctaTargets.ts — where an email's single CTA lands.
//
// 🔴 DESIGN BOARD AMENDMENT 2, 2026-09-24. Every CTA pointed at `BASE_URL`, the
// marketing homepage. Wroblewski counted the journey: **email → homepage → find
// the App Store badge → open app → find Upgrade. Four steps, two of them
// guesses**, on a phone, from an inbox, for the one action we ask for.
//
// ⚠️ AND THE OBVIOUS FIX WOULD HAVE SHIPPED INERT. `DashboardClient`'s deep-link
// handler accepts `post-run` and `session` and nothing else — `upgrade` is
// reachable only through a legacy `?strava=upgrade` quirk, and there is NO
// connect screen at all (13 routes, the flow is a `showConnectRuns` overlay). So
// an email linking `?screen=upgrade` would have looked fixed and changed nothing:
// the decorative class this repo keeps recording.
//
// This module is the single vocabulary shared by the emails and the handler, and
// `emailCtaTargets.test.ts` reads BOTH SIDES so a target the app ignores fails
// the build.

/** The screens an email is allowed to send someone to. */
export const EMAIL_CTA_SCREENS = ['connect', 'upgrade'] as const
export type EmailCtaScreen = (typeof EMAIL_CTA_SCREENS)[number]

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.zonna.run'

/**
 * ⚠️ A WEB URL, NOT A CUSTOM SCHEME, AND THAT IS DELIBERATE. `app.zonna.ios://`
 * would open the app for someone who has it and show an error to everyone else,
 * and an email cannot know which. The web dashboard is the same Next.js app, so
 * this lands on the real screen for a logged-in reader and on login for anyone
 * else — which still beats the homepage by three steps. Universal Links make it
 * open natively; until they ship this is the honest best.
 */
export function ctaHref(screen: EmailCtaScreen): string {
  return `${BASE_URL}/dashboard?screen=${screen}`
}
