// GTM-SEO-PLANS-01 — the marketing-plan catalogue.
//
// Single source of truth for the SEO plan pages: the dynamic route, the /plans
// hub, and sitemap.ts all read this. Each entry drives the engine's own FREE
// rule-based plan (unmodified output — validatePlan-clean — so no Coaching Board
// sign-off is needed per the SLT ruling). Copy lives here so a rename or a new
// plan touches one file.

import type { GeneratorInput } from '@/types/plan'

export interface MarketingPlan {
  slug: string
  distanceLabel: string        // '10K', 'Half marathon'
  distanceKm: number
  weeks: number
  /** Race day = the next Monday + this many days — chosen so race lands on a
   *  Sunday and the engine yields exactly `weeks` weeks (measured, not assumed). */
  dayOffset: number
  daysPerWeek: number
  // Copy (Zonna voice) --------------------------------------------------------
  metaTitle: string
  metaDescription: string
  h1: string
  heroSub: string
  ogTitle: string
  ogDescription: string
  whoFor: string
  // Generator input for this plan, given the computed race date.
  input: (raceDate: string) => GeneratorInput
  /** Sibling slugs to cross-link (internal-link equity + user journey). */
  related: string[]
  /** Hub grouping: by-distance (Wave 1) or by-goal-time (Wave 2). Default distance. */
  group?: 'distance' | 'goal'
  /** Plan-specific FAQs prepended to the shared set — the goal-time pages answer
   *  "what pace is sub-X?", the term people actually search. */
  extraFaqs?: { q: string; a: string }[]
}

const BASE = {
  goal: 'finish' as const, age: 40, fitness_level: 'intermediate' as const,
  injury_history: [] as string[], resting_hr: 55, max_hr: 180,
  preferred_long_run_day: 'sun' as const,
}

export const MARKETING_PLANS: MarketingPlan[] = [
  {
    slug: '5k-12-week',
    distanceLabel: '5K', distanceKm: 5, weeks: 12, dayOffset: 83, daysPerWeek: 4,
    metaTitle: 'Free 5K Training Plan — 12 Weeks | Zonna',
    metaDescription:
      'A free 12-week 5K training plan built to stop you overtraining. Mostly easy running, one quality session a week, every run zoned. For the day-job runner.',
    h1: 'The free 12-week 5K training plan that caps your easy days.',
    heroSub: 'Most of this plan is easy running. That’s not a mistake — it’s the plan. Read the whole thing below. No signup, no wall.',
    ogTitle: 'The free 12-week 5K plan that caps your easy days — Zonna',
    ogDescription: 'Most of this plan is easy running. That’s not a mistake — it’s the plan. Read it free, then get the version that adapts to you.',
    whoFor: 'For the runner who already runs a bit and wants a faster, more comfortable 5K without grinding every session into the ground.',
    input: (raceDate) => ({ ...BASE, race_date: raceDate, race_distance_km: 5, current_weekly_km: 20, longest_recent_run_km: 5, days_available: 4 }),
    related: ['10k-12-week', 'half-marathon-12-week', 'marathon-16-week'],
  },
  {
    slug: '10k-12-week',
    distanceLabel: '10K', distanceKm: 10, weeks: 12, dayOffset: 83, daysPerWeek: 4,
    metaTitle: 'Free 10K Training Plan — 12 Weeks | Zonna',
    metaDescription:
      'A free 12-week 10K training plan built to stop you overtraining. Mostly easy running, one quality session a week, every run zoned. For the day-job runner.',
    h1: 'The free 12-week 10K training plan that caps your easy days.',
    heroSub: 'Most of this plan is easy running. That’s not a mistake — it’s the plan. Read the whole thing below. No signup, no wall.',
    ogTitle: 'The free 12-week 10K plan that caps your easy days — Zonna',
    ogDescription: 'Most of this plan is easy running. That’s not a mistake — it’s the plan. Read it free, then get the version that adapts to you.',
    whoFor: 'For the runner who can already cover the distance and wants a stronger 10K — without going medium-hard on everything and stalling.',
    input: (raceDate) => ({ ...BASE, race_date: raceDate, race_distance_km: 10, current_weekly_km: 25, longest_recent_run_km: 8, days_available: 4 }),
    related: ['5k-12-week', 'half-marathon-12-week', 'marathon-16-week'],
  },
  {
    slug: 'half-marathon-12-week',
    distanceLabel: 'Half marathon', distanceKm: 21.1, weeks: 12, dayOffset: 83, daysPerWeek: 4,
    metaTitle: 'Free Half Marathon Training Plan — 12 Weeks | Zonna',
    metaDescription:
      'A free 12-week half marathon training plan built to stop you overtraining. Mostly easy running, one quality session a week, every run zoned. For the day-job runner.',
    h1: 'The free 12-week half marathon plan that stops you overtraining.',
    heroSub: 'Most of this plan is easy running. That’s not a mistake — it’s the plan. Read the whole thing below. No signup, no wall.',
    ogTitle: 'The free 12-week half marathon plan that caps your easy days — Zonna',
    ogDescription: 'Most of this plan is easy running. That’s not a mistake — it’s the plan. Read it free, then get the version that adapts to you.',
    whoFor: 'For the runner training around a job and a life who wants to reach the start line fit, not fried.',
    input: (raceDate) => ({ ...BASE, race_date: raceDate, race_distance_km: 21.1, current_weekly_km: 35, longest_recent_run_km: 14, days_available: 4 }),
    related: ['10k-12-week', 'marathon-16-week', '5k-12-week'],
  },
  {
    slug: 'marathon-16-week',
    distanceLabel: 'Marathon', distanceKm: 42.2, weeks: 16, dayOffset: 111, daysPerWeek: 5,
    metaTitle: 'Free Marathon Training Plan — 16 Weeks | Zonna',
    metaDescription:
      'A free 16-week marathon training plan built on easy miles. Mostly easy running, one quality session a week, every run zoned. For the day-job runner who overtrains.',
    h1: 'The free 16-week marathon training plan built on easy miles.',
    heroSub: 'Most of this plan is easy running. For a marathon, that is not a compromise — it is the whole point. Read the whole thing below. No signup, no wall.',
    ogTitle: 'The free 16-week marathon plan built on easy miles — Zonna',
    ogDescription: 'Most of this plan is easy running — the way marathon training is meant to be. Read it free, then get the version that adapts to you.',
    whoFor: 'For the runner chasing a marathon around a full life, who knows the race is won by not overcooking the easy weeks.',
    input: (raceDate) => ({ ...BASE, race_date: raceDate, race_distance_km: 42.2, current_weekly_km: 45, longest_recent_run_km: 20, days_available: 5 }),
    related: ['half-marathon-12-week', '10k-12-week', '5k-12-week'],
  },

  // ── Wave 2 — goal-time plans (the try-hard amateur's exact search) ────────
  {
    slug: 'sub-25-5k-plan',
    distanceLabel: '5K', distanceKm: 5, weeks: 12, dayOffset: 83, daysPerWeek: 4, group: 'goal',
    metaTitle: 'Free Sub-25 5K Training Plan | Zonna',
    metaDescription: 'A free 12-week plan to run a sub-25-minute 5K, built on easy miles. Sub-25 is 5:00 per km — most of this plan is run slower, on purpose. Every run zoned.',
    h1: 'The free sub-25-minute 5K plan built on easy miles.',
    heroSub: 'Sub-25 is 5:00 per kilometre. You don’t get there by running every day at 5:15 — you get there by running most days a lot slower, then sharp when it counts. Here’s the plan, free.',
    ogTitle: 'The free sub-25-minute 5K plan built on easy miles — Zonna',
    ogDescription: 'Sub-25 is won on the easy days. Read the plan free, then get the version that adapts to you.',
    whoFor: 'For the runner stuck just over 25 minutes who keeps trying to force it and keeps landing in the same place.',
    input: (raceDate) => ({ ...BASE, race_date: raceDate, goal: 'time_target', target_time: '0:25:00', race_distance_km: 5, current_weekly_km: 25, longest_recent_run_km: 8, days_available: 4, benchmark: { type: 'race', distance_km: 5, time: '0:26:30' } }),
    related: ['5k-12-week', 'sub-50-10k-plan', 'sub-2-hour-half-marathon-plan'],
    extraFaqs: [{ q: 'What pace do I need to run a sub-25 5K?', a: '5:00 per kilometre (about 8:03 per mile) the whole way. The quality sessions in this plan rehearse that pace; the easy days stay well below it so you arrive fresh enough to hold it.' }],
  },
  {
    slug: 'sub-50-10k-plan',
    distanceLabel: '10K', distanceKm: 10, weeks: 12, dayOffset: 83, daysPerWeek: 4, group: 'goal',
    metaTitle: 'Free Sub-50 10K Training Plan | Zonna',
    metaDescription: 'A free 12-week plan to run a sub-50-minute 10K, built on easy miles. Sub-50 is 5:00 per km — most of this plan is run slower, deliberately. Every run zoned.',
    h1: 'The free sub-50-minute 10K plan built on easy miles.',
    heroSub: 'Sub-50 is 5:00 per kilometre. Most of this plan is run slower than that — deliberately — so the day it matters, 5:00 feels like cruising, not clinging on.',
    ogTitle: 'The free sub-50-minute 10K plan built on easy miles — Zonna',
    ogDescription: 'Sub-50 is won on the easy days. Read the plan free, then get the version that adapts to you.',
    whoFor: 'For the runner who can nearly break 50 and keeps hammering the middle of every run to get there.',
    input: (raceDate) => ({ ...BASE, race_date: raceDate, goal: 'time_target', target_time: '0:50:00', race_distance_km: 10, current_weekly_km: 30, longest_recent_run_km: 10, days_available: 4, benchmark: { type: 'race', distance_km: 5, time: '0:24:00' } }),
    related: ['10k-12-week', 'sub-45-10k-plan', 'sub-2-hour-half-marathon-plan'],
    extraFaqs: [{ q: 'What pace is a sub-50 10K?', a: '5:00 per kilometre (about 8:03 per mile), held for 10 km. This plan practises that pace in the quality sessions and keeps the rest of the week genuinely easy.' }],
  },
  {
    slug: 'sub-45-10k-plan',
    distanceLabel: '10K', distanceKm: 10, weeks: 12, dayOffset: 83, daysPerWeek: 4, group: 'goal',
    metaTitle: 'Free Sub-45 10K Training Plan | Zonna',
    metaDescription: 'A free 12-week plan to run a sub-45-minute 10K, built on easy miles. Sub-45 is 4:30 per km — a real target, reached with a lot of easy running and a little sharp.',
    h1: 'The free sub-45-minute 10K plan built on easy miles.',
    heroSub: 'Sub-45 is 4:30 per kilometre — a real target. It’s built on a lot of easy running and a little sharp running, in that order. The plan below shows exactly how much of each.',
    ogTitle: 'The free sub-45-minute 10K plan built on easy miles — Zonna',
    ogDescription: 'Sub-45 is won on the easy days. Read the plan free, then get the version that adapts to you.',
    whoFor: 'For the experienced runner chasing 45 minutes who suspects the answer isn’t simply “train harder”.',
    input: (raceDate) => ({ ...BASE, race_date: raceDate, goal: 'time_target', target_time: '0:45:00', race_distance_km: 10, current_weekly_km: 35, longest_recent_run_km: 12, days_available: 4, fitness_level: 'experienced', benchmark: { type: 'race', distance_km: 10, time: '0:48:00' } }),
    related: ['10k-12-week', 'sub-50-10k-plan', 'sub-2-hour-half-marathon-plan'],
    extraFaqs: [{ q: 'What pace is a sub-45 10K?', a: '4:30 per kilometre (about 7:14 per mile), held for 10 km. This is a sharp target — the plan spends most of the week well below it so the fast running lands on fresh legs.' }],
  },
  {
    slug: 'sub-2-hour-half-marathon-plan',
    distanceLabel: 'Half marathon', distanceKm: 21.1, weeks: 14, dayOffset: 97, daysPerWeek: 4, group: 'goal',
    metaTitle: 'Free Sub-2-Hour Half Marathon Plan | Zonna',
    metaDescription: 'A free 14-week plan to run a sub-2-hour half marathon, built on easy miles. Sub-2 is 5:41 per km — most of this plan is run slower, on purpose. Every run zoned.',
    h1: 'The free sub-2-hour half marathon plan built on easy miles.',
    heroSub: 'Sub-2 is 5:41 per kilometre. The runners who get there run most of their week slower than that — the plan below shows you exactly how much slower, and where the sharp work goes.',
    ogTitle: 'The free sub-2-hour half marathon plan built on easy miles — Zonna',
    ogDescription: 'Sub-2 is won on the easy days. Read the plan free, then get the version that adapts to you.',
    whoFor: 'For the runner circling the two-hour mark who has tried going harder and found it hasn’t moved.',
    input: (raceDate) => ({ ...BASE, race_date: raceDate, goal: 'time_target', target_time: '1:59:00', race_distance_km: 21.1, current_weekly_km: 35, longest_recent_run_km: 14, days_available: 4, benchmark: { type: 'race', distance_km: 10, time: '0:53:00' } }),
    related: ['half-marathon-12-week', 'sub-50-10k-plan', 'sub-4-hour-marathon-plan'],
    extraFaqs: [{ q: 'What pace do I need for a sub-2-hour half marathon?', a: '5:41 per kilometre (about 9:09 per mile), held for the full 21.1 km. This plan rehearses that pace in the quality sessions and keeps the long runs easy so you can hold it on the day.' }],
  },
  {
    slug: 'sub-4-hour-marathon-plan',
    distanceLabel: 'Marathon', distanceKm: 42.2, weeks: 18, dayOffset: 125, daysPerWeek: 5, group: 'goal',
    metaTitle: 'Free Sub-4-Hour Marathon Plan | Zonna',
    metaDescription: 'A free 18-week plan to run a sub-4-hour marathon, built on easy miles. Sub-4 is 5:41 per km — the race is won in the easy weeks, and this plan protects them.',
    h1: 'The free sub-4-hour marathon plan built on easy miles.',
    heroSub: 'Sub-4 is 5:41 per kilometre for 42.2 km. It is won in the easy weeks — this plan spends most of them well under race pace so the long runs build you up instead of breaking you down.',
    ogTitle: 'The free sub-4-hour marathon plan built on easy miles — Zonna',
    ogDescription: 'Sub-4 is won on the easy days. Read the plan free, then get the version that adapts to you.',
    whoFor: 'For the runner chasing four hours who knows the wall is built in training, not on race day.',
    input: (raceDate) => ({ ...BASE, race_date: raceDate, goal: 'time_target', target_time: '3:59:00', race_distance_km: 42.2, current_weekly_km: 40, longest_recent_run_km: 20, days_available: 5, benchmark: { type: 'race', distance_km: 21.1, time: '1:52:00' } }),
    related: ['marathon-16-week', 'sub-2-hour-half-marathon-plan', 'sub-45-10k-plan'],
    extraFaqs: [{ q: 'What pace is a sub-4-hour marathon?', a: '5:41 per kilometre (about 9:09 per mile), held for the full 42.2 km. The hard part is holding it late, which is why this plan protects the easy weeks that build your durability.' }],
  },
]

export function getPlan(slug: string): MarketingPlan | undefined {
  return MARKETING_PLANS.find(p => p.slug === slug)
}

/** Card/link title: goal plans lead with the goal, distance plans with distance + length. */
export function planCardTitle(p: MarketingPlan): string {
  return (p.group ?? 'distance') === 'goal'
    ? p.metaTitle.replace(/^Free /, '').replace(/ \| .*$/, '')
    : `${p.distanceLabel} · ${p.weeks}-week plan`
}

/** Race day = next Monday + dayOffset (a Sunday); the runner only sees week
 *  numbers, so this keeps the plan honest for the engine without dating the page. */
export function planAnchor(dayOffset: number): { planStart: string; raceDate: string } {
  const now = new Date()
  const nextMonday = new Date(now)
  nextMonday.setUTCDate(now.getUTCDate() + (((8 - now.getUTCDay()) % 7) || 7))
  const race = new Date(nextMonday)
  race.setUTCDate(nextMonday.getUTCDate() + dayOffset)
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  return { planStart: iso(nextMonday), raceDate: iso(race) }
}

/** Shared FAQ set (drives on-page copy AND FAQPage JSON-LD), interpolated per plan. */
export function faqsFor(plan: MarketingPlan): { q: string; a: string }[] {
  const d = plan.distanceLabel.toLowerCase()
  return [
    ...(plan.extraFaqs ?? []),
    {
      q: `How many days a week is this ${plan.distanceLabel} plan?`,
      a: `${plan.daysPerWeek} days a week. Easy runs, and from the build phase one quality session a week. The rest is recovery — on purpose.`,
    },
    {
      q: `Is this ${plan.distanceLabel} plan good for beginners?`,
      a: `It suits a runner who already runs a little and wants to stop going medium-hard on everything. If you are brand new to running, build an easy base first, then start here.`,
    },
    {
      q: `Do I need a heart-rate monitor for this ${d} plan?`,
      a: `No. Every run has a pace band and a zone. A heart-rate monitor just helps you hold the easy days honestly — which is exactly what the app adds on top of this plan.`,
    },
    {
      q: `Can I move the sessions around?`,
      a: `Carefully, yes — keep the two hardest days apart. The static plan below can’t move itself. The app does that for you when your week changes, and keeps the easy/hard rhythm intact.`,
    },
    {
      q: `Why is so much of the plan easy running?`,
      a: `Because you can’t outrun your easy days. Running easy when it’s easy is what lets you run genuinely hard on the one day that earns it. The grey middle — medium-hard on everything — is where amateur runners stall and get injured.`,
    },
  ]
}
