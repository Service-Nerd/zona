'use client'

/**
 * RefusalView — what a runner sees when the engine will not build the plan
 * they asked for.
 *
 * TWO DIFFERENT THINGS RENDER HERE and the distinction is the whole component.
 * A **refusal** (HTTP 422) is a deliberate coaching decision (§44 / §52 / §55 /
 * §111) and reads as a calm "not yet" in coach voice. A **fault** (500, network
 * drop) is us failing and keeps the honest "something went wrong". Conflating
 * them was `REFUSAL-SCREEN-01`: a coaching decision presented as a crash.
 *
 * P-15 (SLT 2026-09-20) added the half that was missing. `REFUSAL-SCREEN-01`
 * made the refusal calm but it still **offered nothing** — a first-time
 * marathoner below the base-volume door was told no and handed no route
 * forward. Wood: a runner told no with nothing attached either gives up or
 * **trains anyway with no plan**, and the second is worse than admitting them.
 *
 * ⚠️ EXTRACTED FROM `GeneratePlanScreen` RATHER THAN COPIED. This screen sits
 * behind auth AND behind a completed wizard AND behind a refusal, so the only
 * way to look at it is to be the runner it is failing. `/refusal-preview`
 * renders THIS component in every state; a fixture rendering a second copy of
 * the markup would drift from the real one and prove nothing, which is the
 * duplication doctrine this repo keeps paying for.
 *
 * ⚠️ NOT A MODAL. P-15 names that explicitly and CLAUDE.md bars popups
 * outright: all interactions navigate to full screens.
 */

export interface RefusalOffer {
  /** Heading. Names the thing, never the shortfall. */
  title: string
  /** The one-line summary. TWO server-side variants keyed on whether the plan
   *  reaches the race door; the non-clearing one says nothing about a race. */
  line: string
  /** The credibility sentence. */
  why: string
}

export default function RefusalView({
  isRefusal,
  message,
  alternatives,
  offer,
  offerFailed,
  onAccept,
  onAdjust,
}: {
  isRefusal: boolean
  message: string | null
  alternatives: string[]
  /** ⚠️ Every string is authored server-side by `lib/plan/baseBuildCopy.ts`.
   *  This component renders them and never assembles one: the non-clearing
   *  variant must say NOTHING about a race, and a client-side template would
   *  be free to break that rule for the runner least able to absorb it. */
  offer: RefusalOffer | null
  offerFailed: boolean
  onAccept: () => void
  onAdjust: () => void
}) {
  const showOffer = isRefusal && !!offer

  return (
    <>
      {/* The refusal itself, in the CoachNoteBlock amber palette (pattern 9) —
          this IS coach voice. No alarm colour, no raw diagnostic string: the
          message arrives already brand-voiced from the route. */}
      <div style={{ background: 'var(--warn-bg)', borderRadius: 'var(--radius-lg)', padding: '20px', marginBottom: '16px' }}>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--warn)', marginBottom: '10px' }}>
          {isRefusal ? 'Not yet' : 'Something went wrong'}
        </div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--coach-ink)', lineHeight: 1.55 }}>
          {isRefusal ? message : (message ?? 'Something went wrong building the plan.')}
        </div>
        {isRefusal && alternatives.length > 0 && (
          <div style={{ marginTop: '16px', borderTop: '1px solid var(--line)', paddingTop: '14px' }}>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--warn)', marginBottom: '10px' }}>
              What would get you there
            </div>
            {alternatives.map((alt, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', marginBottom: i < alternatives.length - 1 ? '8px' : 0 }}>
                <span aria-hidden style={{ color: 'var(--warn)', fontWeight: 700, lineHeight: 1.55 }}>·</span>
                <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--coach-ink)', lineHeight: 1.55 }}>{alt}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── P-15: THE OFFER ──────────────────────────────────────────────────
          ⚠️ A SEPARATE `--card` SURFACE, NOT INSIDE THE AMBER BLOCK. Amber is
          coach-WARNING voice; an offer rendered inside it reads as more bad
          news, which is the opposite of this block's job. The 3px moss left
          rail is the session-card accent language (pattern 1), marking the
          affirmative path in the palette's own semantics. */}
      {showOffer && (
        <div style={{
          position: 'relative', background: 'var(--card)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--line)', padding: '18px 18px 18px 21px',
          marginBottom: '16px', overflow: 'hidden',
        }}>
          <span aria-hidden style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '3px', background: 'var(--moss)' }} />
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--moss)', marginBottom: '8px' }}>
            {offer!.title}
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '14px', color: 'var(--ink)', lineHeight: 1.55, marginBottom: '10px' }}>
            {offer!.line}
          </div>
          {/* The credibility sentence, and why it is not cut: it is the most
              on-brand thing this product says to a charity cohort and the
              opposite of what every competitor does (Sutherland). Muted and a
              size down so it supports rather than competes with the offer. */}
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', lineHeight: 1.55 }}>
            {offer!.why}
          </div>
        </div>
      )}

      {/* A failed acceptance says so INLINE and leaves the offer standing. The
          runner said yes and the network did not; losing the card would make
          the failure read as a second refusal. */}
      {offerFailed && (
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--warn)', lineHeight: 1.55, marginBottom: '12px' }}>
          That did not go through. Try again.
        </div>
      )}

      {/* ── CTA hierarchy ────────────────────────────────────────────────────
          With an offer, STARTING IT is primary and adjusting the answers
          demotes to the muted text link below: the canonical upgrade-screen
          shape (primary moss button + a visible secondary path), which exists
          precisely so a CTA never becomes a dark pattern by hiding the
          alternative. `ux-principles` bars dead ends, so the secondary path is
          present in BOTH branches. 44px min-height keeps the iOS HIG target. */}
      {showOffer ? (
        <>
          <button
            onClick={onAccept}
            style={{ width: '100%', padding: '15px', borderRadius: 'var(--radius-md)', background: 'var(--moss)', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 600, color: 'var(--card)' }}
          >
            Start base building
          </button>
          <button
            onClick={onAdjust}
            style={{ width: '100%', padding: '14px', marginTop: '4px', minHeight: '44px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 500, color: 'var(--mute)' }}
          >
            Adjust my answers
          </button>
        </>
      ) : (
        <button
          onClick={onAdjust}
          style={{ width: '100%', padding: '15px', borderRadius: 'var(--radius-md)', background: 'var(--moss)', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 600, color: 'var(--card)' }}
        >
          {isRefusal ? 'Adjust my answers' : 'Try again'}
        </button>
      )}
    </>
  )
}
