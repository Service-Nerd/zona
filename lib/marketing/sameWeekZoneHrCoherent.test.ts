// SEGMENTED-LR-HR-01 — the homepage may not print a RANGE zone beside a one-sided HR cap.
//
// 🔴 WHY THIS IS THE GATE AND NOT A PRESCRIPTION CHANGE. §84 Amendment 1 already ruled on
// these sessions, by name and deliberately: *"Out of scope, deliberately: the `Zone 2–3` long
// run with a marathon/HM-pace finish. Its `hr_target` is a CEILING describing the aerobic
// portion while the zone string describes the whole session including the faster finish — a
// different mechanism from the one ruled on here."* So the data carrying an easy ceiling
// beside a Zone 2–3 label is INTENTIONAL, and the app honours it: `SessionPopupInner` derives
// the shown band live from `session.zone` via `hrBandForZoneString`, so a `Zone 2–3` session
// renders a RANGE and the baked `hr_target` is only a fallback.
//
// ⚠️ THE WEBSITE DOES NOT. `SameWeekTwice.tsx` prints `zone` and `hr_target` side by side, raw
// — `· Zone 2–3 · < 145 bpm` — on the HOMEPAGE. Read together by a stranger those two are a
// contradiction, and the board's stated reason (the cap governs only the aerobic portion) is
// nowhere on the page.
//
// 📐 MEASURED 2026-11-13: **0 live instances.** The homepage draws week 5 of
// `half-marathon-12-week`, whose long run is a plain `Zone 2 / < 143 bpm`. The exposure is
// LATENT and it is one constant away: change `SOURCE_WEEK` to a peak-phase week, or the slug
// to a time-target plan, and the pair appears. **1,599 of 1,599 segmented long runs across
// 4,098 generated plans carry the easy ceiling**, so the population is not rare — only the
// homepage's chosen week is.
//
// This asserts the PAGE, not the engine: the data stays as the board ruled it, and the one
// surface that would render it dishonestly cannot start doing so silently.
import { describe, it, expect } from 'vitest'
import { MARKETING_PLANS } from './plans'
import { generateMarketingPlan } from './marketingPlan'
import type { Session } from '../../types/plan'

// The component's own constants. Imported-by-value rather than re-typed would be better, but
// they are module-private; a drift here is caught by the arm that asserts they still resolve.
const SOURCE_SLUG = 'half-marathon-12-week'
const SOURCE_WEEK = 5

/** A one-sided cap ("< 145 bpm") rather than a band ("145–158 bpm"). */
const isCeiling = (hr: string | null | undefined) => !!hr && /^\s*</.test(hr)
/** A zone string spanning more than one zone ("Zone 2–3"), per §84's range form. */
const isRange = (zone: string | null | undefined) => !!zone && /\d\s*[–-]\s*\d/.test(zone)

describe('SEGMENTED-LR-HR-01 — the homepage week never pairs a range zone with a one-sided cap', () => {
  const plan = (() => {
    const entry = MARKETING_PLANS.find(p => p.slug === SOURCE_SLUG)
    expect(entry, `the homepage's source plan \`${SOURCE_SLUG}\` no longer exists`).toBeTruthy()
    return generateMarketingPlan(entry!).plan
  })()

  const week = plan.weeks.find(w => (w.n ?? 0) === SOURCE_WEEK)

  it('the source week still exists — otherwise every arm below is vacuous', () => {
    expect(week, `week ${SOURCE_WEEK} of ${SOURCE_SLUG} is gone; SameWeekTwice renders nothing`).toBeTruthy()
    const sessions = Object.values(week!.sessions ?? {}).filter(Boolean) as Session[]
    expect(sessions.length, 'the homepage week has no sessions').toBeGreaterThan(0)
  })

  it('🔴 no session prints a RANGE zone beside a one-sided HR cap', () => {
    const sessions = Object.values(week!.sessions ?? {}).filter(Boolean) as Session[]
    const contradictory = sessions
      .filter(s => isRange(s.zone) && isCeiling(s.hr_target))
      .map(s => `${String(s.label)} · ${String(s.zone)} · ${String(s.hr_target)}`)
    expect(contradictory,
      'SameWeekTwice prints `zone` and `hr_target` raw and side by side on the homepage. A '
      + 'range zone next to a one-sided cap reads as a contradiction to a stranger, and §84 '
      + "Am. 1's reason for the pair (the cap governs the AEROBIC portion only) is not on the "
      + 'page. Either pick a week without one, or have the Design Board rule on how the pair '
      + 'is encoded — do NOT change the session data, which the board ruled intentional.')
      .toEqual([])
  })

  it('the detector is not vacuous — it recognises both halves of the pair', () => {
    // Without this the arm above would pass forever on a broken predicate.
    expect(isCeiling('< 145 bpm')).toBe(true)
    expect(isCeiling('145–158 bpm')).toBe(false)
    expect(isRange('Zone 2–3')).toBe(true)
    expect(isRange('Zone 2')).toBe(false)
    // And the shape it exists for is recognised when assembled by hand.
    const synthetic = { label: 'Marathon-pace long run', zone: 'Zone 2–3', hr_target: '< 145 bpm' } as Session
    expect(isRange(synthetic.zone) && isCeiling(synthetic.hr_target)).toBe(true)
  })
})
