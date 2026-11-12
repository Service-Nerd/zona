// ACT-FREE-TEASE-01 — what a FREE runner sees where the paid read sits.
// SLT + Design Board 2026-11-12: `docs/decisions/activation-release-3-2026-11-12.md`.
//
// 🔴 ONE RUNNER-FACING CALL SITE, NOT TWO, AND THIS HEADER CLAIMED TWO. It said `PostRunScreen`
// AND `SessionScreen`'s reflect view, *"which is why the markup gate renders both"* — and
// `SessionScreen` has no call site at all: it keeps `LockedCoachingPreview`, whose false sentence
// was fixed instead. The gate renders one, because there is one. **A header describing the build
// I intended rather than the one I shipped**, found by code review, and the more dangerous half is
// that `freeRunRead.ts`'s defect statement names both screens as fixed.
//
// Live call sites: `PostRunScreen` (a Strava/HealthKit-linked completion), `OrientationScreen`
// (the `example` mode), and `/post-run-preview` (every state, for looking at).
//
// ⚠️ CLAUDE.md's standing warning on the PostRun/Session pair still applies to anything that does
// reach both — *"wired into BOTH … if you change one, check the other"*.
//
// 🔴 THIS CARD CARRIES NO RAIL, AND THAT IS THE BINDING CONDITION BITING THE DESIGN RATHER THAN
// THE COPY. P-01's semantic pair draws moss for "held the zone" and amber for "cooked it", and
// every other zone surface in this product carries it — `ZoneWeekBlock`, `KitReceipts`, the coach
// cards. Here it cannot: **Hutchinson's SLT condition withholds the verdict, and a moss-or-amber
// rail IS the verdict, stated in colour instead of in words.** Writing careful declarative copy
// and then painting it amber would smuggle the interpretation back in through the one channel a
// copy review never checks.
//
// ⚠️ AND A NEUTRAL RAIL WAS THE WRONG ANSWER, FOUND BY LOOKING RATHER THAN BY REASONING. The
// first cut drew it in `var(--line)` on a card already bordered in `var(--line)`: rendered at
// 375px it is invisible, so it was a device carrying nothing — decoration, which this board kills
// by name. **No rail reads as "no verdict" far better than an unreadable one**, because the
// absence is legible against the cards above it that do carry one.
// `freeRunRead.markup.test.ts` asserts neither P-01 colour appears and no rail is drawn, since a
// later "make it consistent with P-01" tidy-up is exactly how this would come back.

import type { FreeRunRead } from '@/lib/coaching/freeRunRead'
import { MICRO_LABELS } from './microLabels'
import { TAP_TARGET_MIN_PX } from '@/components/ui/tapTarget'

export default function FreeRunReadCard({ read, onUpgrade, loading = false, example = null }: {
  /** `freeRunRead(...)`. */
  read: FreeRunRead
  /** Routes to the paywall. Not called from the no-HR state, which offers nothing to buy. */
  onUpgrade: () => void
  /** The linked activity's columns have not arrived yet. */
  loading?: boolean
  /**
   * ACT-FIRSTRUN-01 — somebody ELSE'S run, shown in onboarding before this runner has one.
   *
   * 🔴 THE DECLARATION IS A PROP, NOT A CAPTION, and that is Silvanto's amendment verbatim:
   * *"the label is not a caption, it is part of the card. Not grey small print under it — grey
   * small print is what every app uses to disclaim something it hopes you read as real."* So it
   * replaces the eyebrow, which is the first thing read, and the lock line and the paywall link
   * do not render: a runner in onboarding has full access and there is nothing to unlock.
   *
   * ⚠️ Passing this is the ONLY way the card shows data that is not the viewer's own. A
   * fabricated record presented as a real one is the thing neither this product nor its brand
   * may ship, so the shape of the API is what keeps it honest.
   */
  example?: { eyebrow: string; next: string } | null
}) {
  // See the header note: no rail at all, on any state. The left padding returns to the standard
  // 18px that every card without a rail uses, rather than keeping the 21px a rail needs.
  const shell = {
    background: 'var(--card)',
    borderRadius: 'var(--radius-lg)',
    border: '1px solid var(--line)',
    padding: '16px 18px',
  }
  const eyebrow = (
    <div style={{ fontFamily: 'var(--font-ui)', ...MICRO_LABELS.eyebrow, color: 'var(--mute)', marginBottom: 'var(--space-2)' }}>
      {example ? example.eyebrow : 'This run'}
    </div>
  )

  // ⚠️ LOADING OUTRANKS ABSENT, and the order is the decision. `freeRunRead(null)` answers
  // `absent` for a row that has not arrived AND for a session with no run, so testing absence
  // first would render nothing for a beat and then pop a card in. The caller distinguishes the
  // two with its own tri-state; this just has to honour it.
  if (loading) {
    return (
      <div data-free-run-read="loading" style={shell}>
          {eyebrow}
        <div style={{ height: '30px', width: '32%', borderRadius: '4px', background: 'var(--bg-soft)', marginBottom: 'var(--space-2)' }} />
        <div style={{ height: '13px', width: '78%', borderRadius: '4px', background: 'var(--bg-soft)' }} />
      </div>
    )
  }

  // Nothing linked, nothing to say. The one state that is an absence rather than a message —
  // "empty means calm, not broken", and there is no run to describe.
  if (read.state === 'absent') return null

  if (read.state === 'no_hr') {
    return (
      <div data-free-run-read="no_hr" style={shell}>
          {eyebrow}
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-body)', lineHeight: 1.55, color: 'var(--ink)' }}>
          {read.sentence}
        </div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-caption)', lineHeight: 1.55, color: 'var(--mute)', marginTop: 'var(--space-2)' }}>
          {read.sub}
        </div>
      </div>
    )
  }

  return (
    <div data-free-run-read="measured" style={shell}>
      {eyebrow}
      {/* Metric pair, the documented way round: the value dominates and the words sit under it
          (`ui-patterns.md` § Metric Pair — "never put label above value"). One number, not four. */}
      <div style={{
        // ⚠️ `--fs-metric` (26px), NOT `--fs-metric-lg` (38px). The first cut reached for the
        // larger one and `appTypeScale.test.ts` refused it: 38 is a MARKETING size and the app's
        // declared set is 10/11/12/14/15/17/20/26/44/56. 26 against 14px body is a 1.86x step,
        // which is the hierarchy Collins asked for; reaching outside the scale to get a bigger
        // number is the type regression Silvanto's veto exists for.
        fontFamily: 'var(--font-ui)', fontWeight: 800, fontSize: 'var(--fs-metric)',
        fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.03em',
        color: 'var(--ink)', lineHeight: 1.05,
      }}>
        {read.pct}%
      </div>
      <div style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-body)', lineHeight: 1.5, color: 'var(--ink-2)', marginTop: '2px' }}>
        {read.sentence}
      </div>
      <div style={{ fontFamily: 'var(--font-ui)', fontSize: 'var(--fs-caption)', lineHeight: 1.55, color: 'var(--mute)', marginTop: 'var(--space-3)' }}>
        {example ? example.next : read.locked}
      </div>
      {/* Pattern 11's locked CTA: a moss text link, no background, no border, one tap target.
          ⚠️ NOT RENDERED FOR AN EXAMPLE. A runner in onboarding is inside a full-access trial, so
          there is nothing locked and nothing to sell — a paywall link here would be the
          calendar-triggered upgrade prompt the SLT banned, dressed as a sample. */}
      {!example && (
        <button
          type="button"
          onClick={onUpgrade}
          style={{
            appearance: 'none', background: 'none', border: 'none', padding: '10px 0 0', margin: 0,
            fontFamily: 'var(--font-ui)', fontWeight: 600, fontSize: 'var(--fs-caption)',
            color: 'var(--moss-strong)', cursor: 'pointer', textAlign: 'left',
            // ⚠️ FROM THE OWNER, AND MEASURED BY THE GATE RATHER THAN BY ME. The first cut set
            // 34px and reasoned that the 10px of padding above made it up; `buttonGeometry.test.ts`
            // computed 37px and refused it. The second typed `44px` inline and
            // `tapTarget.test.ts`'s ratchet refused that too, correctly: the floor has one owner.
            // A tap target argued for in a comment is not a tap target.
            // ⚠️ A BARE IDENTIFIER, NOT A TEMPLATE LITERAL. `buttonGeometry.test.ts` resolves
            // `minHeight: SOME_CONST` (BUTTON-GEOMETRY-CONST-01, written after it reported 35px
            // on a 44px control). A template literal is neither a px literal nor an identifier,
            // so it fell through to padding and the gate read 37px again. Same shape as
            // `TrainingZonesScreen`'s tabs, which is the precedent that resolver was built for.
            minHeight: TAP_TARGET_MIN_PX,
          }}
        >
          {read.cta}
        </button>
      )}
    </div>
  )
}
