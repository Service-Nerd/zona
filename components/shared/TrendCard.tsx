'use client'

// TIER-DIVERGENT — FREE:  locked state, upgrade CTA, hand-authored body copy
//                  PAID:  live/pending/skeleton states, AI gloss sentence when signal present
//
// Pattern 29 — TrendCard (AI-DEPTH-03, shipped 2026-05-30)
// Two-metric variant of RestraintCard (Pattern 11). Shows how the runner's
// avg HR on same-effort long runs has changed over a multi-month window.
// The numbers are formula-derived; the gloss sentence is model-written.
// AIMark lives on the model content only — via CoachByline below the metric pair.
//
// ui-patterns.md §29 — see docs/canonical/ui-patterns.md for full spec.

import { useState, useEffect, useRef } from 'react'
import CoachByline from './CoachByline'

// ── Types ─────────────────────────────────────────────────────────────────────

export type TrendCardState = 'live' | 'pending' | 'locked' | 'skeleton'

interface TrendCardLive {
  state: 'live'
  /** Short month label for earliest bucket, e.g. 'Feb'. */
  earlierMonth: string
  earlierHr: number
  nowHr: number
  /** Total runs across all buckets. */
  cohortSize: number
  windowMonths: number
  /** Model-written gloss. Present when hrIsTrending and AI succeeded. */
  gloss?: string
  /** Eyebrow label and CoachByline role. Default: 'Aerobic trend'. */
  label?: string
  /** Noun for metadata count, e.g. 'easy run'. Default: 'long run'. */
  sessionLabel?: string
  /** CO-ONE: numbers-only mode for Coach. Hides the AI gloss section so the
   *  trend reads as raw evidence with no second Kit voice. Trend interpretation
   *  folds into the one Kit read at the top of Coach instead. */
  glossless?: boolean
  onUpgrade?: never
}
/** Every non-live state also needs to know WHICH trend it is. Before
 *  2026-09-12 they did not carry it and hardcoded 'Aerobic trend' / 'long
 *  runs' instead, so once the long-run card was retired a runner looking at
 *  the EASY RUN TREND card saw the wrong session type in three places. */
interface TrendCardLabels   { label?: string; sessionLabel?: string }
interface TrendCardPending  extends TrendCardLabels { state: 'pending';  onUpgrade?: never }
interface TrendCardLocked   extends TrendCardLabels { state: 'locked';   onUpgrade?: () => void }
interface TrendCardSkeleton extends TrendCardLabels { state: 'skeleton'; onUpgrade?: never }

/** Fallbacks, in one place rather than repeated at each use site. */
export const TREND_CARD_DEFAULTS = { label: 'Aerobic trend', sessionLabel: 'long run' } as const

export type TrendCardProps =
  | TrendCardLive
  | TrendCardPending
  | TrendCardLocked
  | TrendCardSkeleton

// ── Count-up hook ─────────────────────────────────────────────────────────────

/**
 * Animates a number from 0 to `target` over `duration`ms using ease-out cubic.
 * Returns the current display value and whether the animation is complete.
 * Only runs once — subsequent re-renders with a different `target` do not
 * re-trigger (stable for the lifetime of the component).
 */
function useCountUp(target: number, duration = 600): { value: number; done: boolean } {
  const [value, setValue] = useState(0)
  const [done,  setDone]  = useState(false)
  const startRef = useRef<number | null>(null)
  const rafRef   = useRef<number | null>(null)

  useEffect(() => {
    startRef.current = null
    function tick(ts: number) {
      if (startRef.current === null) startRef.current = ts
      const elapsed = ts - startRef.current
      const t       = Math.min(elapsed / duration, 1)
      const eased   = 1 - Math.pow(1 - t, 3) // ease-out cubic
      setValue(Math.round(target * eased))
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        setDone(true)
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  // HOOKS-ORDER-01 — was `[]` ("fire once on mount"). It has to depend on
  // `target` now that the call is hoisted above the early returns: on a
  // skeleton render the target is 0, and with `[]` the animation would run to
  // zero once and never move again when the real value arrived.
  }, [target, duration])

  return { value, done }
}

// ── MetricPair ────────────────────────────────────────────────────────────────

function MetricPair({
  value,
  label,
  muted = false,
}: {
  value: string
  label: string
  muted?: boolean
}) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{
        fontFamily: 'var(--font-ui)', fontSize: '44px', fontWeight: 800,
        color: muted ? 'var(--mute)' : 'var(--ink)',
        opacity: muted ? 0.5 : 1,
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '-0.03em',
        lineHeight: 1,
      }}>
        {value}
      </div>
      <div style={{
        fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 400,
        color: 'var(--mute)',
      }}>
        {label}
      </div>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function TrendCardSkeleton({ label = TREND_CARD_DEFAULTS.label }: { label?: string }) {
  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--line)',
      borderRadius: 'var(--radius-lg)', padding: '20px',
      boxShadow: 'var(--shadow-card)',   // v2 (design_handoff_v2)
    }}>
      {/* Eyebrow */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ height: '10px', width: '38%', background: 'var(--bg-soft)', borderRadius: '4px' }} />
        <div style={{ height: '10px', width: '28%', background: 'var(--bg-soft)', borderRadius: '4px' }} />
      </div>
      {/* Metric pair */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <div style={{ flex: 1, height: '44px', background: 'var(--bg-soft)', borderRadius: '6px' }} />
        <div style={{ width: '24px', height: '20px', background: 'var(--bg-soft)', borderRadius: '4px' }} />
        <div style={{ flex: 1, height: '44px', background: 'var(--bg-soft)', borderRadius: '6px' }} />
      </div>
      {/* Byline + gloss */}
      <div style={{ borderTop: '1px solid var(--line)', paddingTop: '14px', position: 'relative', paddingLeft: '14px' }}>
        <div style={{ position: 'absolute', left: '8px', top: '14px', bottom: '0', width: '3px', background: 'var(--moss)', borderRadius: '2px', opacity: 0.3 }} />
        <div style={{ marginBottom: '10px' }}>
          <CoachByline working role={label} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ height: '13px', width: '85%', background: 'var(--bg-soft)', borderRadius: '4px' }} />
          <div style={{ height: '13px', width: '60%', background: 'var(--bg-soft)', borderRadius: '4px' }} />
        </div>
      </div>
    </div>
  )
}

// ── Explanation sheet ─────────────────────────────────────────────────────────

function ExplanationSheet({
  onClose,
  state,
  windowMonths,
  eyebrow = TREND_CARD_DEFAULTS.label,
  runNoun = TREND_CARD_DEFAULTS.sessionLabel,
}: {
  onClose: () => void
  state: TrendCardState
  windowMonths?: number
  /** Must match the CARD's eyebrow. Hardcoded until 2026-09-12, so after the
   *  long-run card was retired every runner opening this sheet from the EASY
   *  RUN TREND card was told it was about long runs. */
  eyebrow?: string
  /** Plural noun for the session type this trend is built from. */
  runNoun?: string
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(26,26,26,0.4)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        animation: 'zonna-fade-in 0.18s ease-out',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '480px',
          background: 'var(--card)',
          borderRadius: '20px 20px 0 0',
          boxShadow: '0 -8px 24px rgba(0,0,0,0.12)',
          paddingTop: '8px',
          maxHeight: '80vh', overflowY: 'auto',
          animation: 'zonna-slide-up 0.22s ease-out',
        }}
      >
        <div style={{ width: '36px', height: '4px', background: 'var(--line)', borderRadius: '2px', margin: '6px auto 18px' }} />

        <div style={{ padding: '0 20px 4px' }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700, color: 'var(--mute)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px' }}>
            {eyebrow}
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '24px', fontWeight: 600, color: 'var(--ink)', letterSpacing: '-0.4px', lineHeight: 1.15 }}>
            What this number means
          </div>
        </div>

        <div style={{ padding: '18px 20px 8px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {state === 'pending' ? (
            <>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 400, color: 'var(--ink-2)', lineHeight: 1.55 }}>
                Zonna compares your average heart rate on {`${runNoun}s`} at the same effort over time. When you have enough similar runs across multiple months, the trend becomes visible.
              </div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 400, color: 'var(--ink-2)', lineHeight: 1.55 }}>
                Keep logging runs. The signal lands when there are at least two months of comparable data.
              </div>
            </>
          ) : (
            <>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 400, color: 'var(--ink-2)', lineHeight: 1.55 }}>
                Your average heart rate on {`${runNoun}s`} at the same pace, compared across{windowMonths ? ` the last ${windowMonths} months` : ' time'}. When HR drops at the same pace, your aerobic base is growing — your easy is genuinely easier.
              </div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 400, color: 'var(--ink-2)', lineHeight: 1.55 }}>
                This is what zone discipline produces. Not faster runs. Lower heart rate at the same effort.
              </div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 400, color: 'var(--ink-2)', lineHeight: 1.55 }}>
                Zonna requires at least a 4 bpm shift across 2 or more months before surfacing a trend — so when you see a number here, there&apos;s enough data to mean something.
              </div>
            </>
          )}
        </div>

        <div style={{ position: 'sticky', bottom: 0, padding: '14px 20px 20px', background: 'var(--card)', borderTop: '0.5px solid var(--line)', marginTop: '8px' }}>
          <button
            onClick={onClose}
            style={{
              width: '100%', height: '48px',
              background: 'var(--bg-soft)', border: 'none',
              borderRadius: 'var(--radius-lg)', cursor: 'pointer',
              fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 500, color: 'var(--ink)',
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function TrendCard(props: TrendCardProps) {
  const [sheetOpen, setSheetOpen] = useState(false)

  // ── HOOKS-ORDER-01 (2026-09-11) — REACT ERROR 310, AND IT WAS THIS ────────
  //
  // These two calls used to sit at the bottom, below the skeleton / locked /
  // pending early returns. `useCountUp` is a hook containing FIVE hooks
  // (2 useState, 2 useRef, 1 useEffect), so this component rendered ONE hook in
  // its skeleton state and ELEVEN in its live state.
  //
  // On the Coach screen TrendCard mounts as `skeleton` while the aerobic trend
  // is fetched, then flips to `live` when it lands. 1 hook → 11 hooks on the
  // next render is precisely "Rendered more hooks than during the previous
  // render", and it took down the whole screen through the error boundary —
  // deterministically, for any runner with enough history for the trend to
  // return. A runner with no trend data never saw it, which is why it looked
  // like a mystery rather than a rule violation.
  //
  // Hoisted, so the hook count is identical in every state. `props` is a
  // discriminated union on `state`, so the live fields are read through a
  // narrowed local rather than asserted.
  const live    = props.state === 'live' ? props : null
  const earlier = useCountUp(live?.earlierHr ?? 0)
  const now     = useCountUp(live?.nowHr ?? 0)

  // ── Skeleton ─────────────────────────────────────────────────────────────
  if (props.state === 'skeleton') return <TrendCardSkeleton label={props.label} />

  // ── Locked (free tier) ────────────────────────────────────────────────────
  if (props.state === 'locked') {
    return (
      <div style={{
        background: 'var(--bg-soft)', border: '1px solid var(--line)',
        borderRadius: 'var(--radius-lg)', padding: '20px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700, color: 'var(--mute)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {props.label ?? TREND_CARD_DEFAULTS.label}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '44px', fontWeight: 800, color: 'var(--mute)', opacity: 0.4, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>—</div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 400, color: 'var(--mute)', marginTop: '6px' }}>earlier</div>
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '20px', color: 'var(--mute)', opacity: 0.3 }}>→</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '44px', fontWeight: 800, color: 'var(--mute)', opacity: 0.4, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>—</div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 400, color: 'var(--mute)', marginTop: '6px' }}>now</div>
          </div>
        </div>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 400, color: 'var(--mute)', lineHeight: 1.5, marginBottom: '14px' }}>
          The receipt for your easy days. Months of same-effort runs, compared.
        </div>
        {props.onUpgrade && (
          <button
            onClick={props.onUpgrade}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 600, color: 'var(--moss)' }}
          >
            Unlock trend →
          </button>
        )}
      </div>
    )
  }

  // ── Pending (paid, not enough data yet) ───────────────────────────────────
  if (props.state === 'pending') {
    return (
      <>
        <div
          onClick={() => setSheetOpen(true)}
          style={{
            background: 'var(--card)', border: '1px solid var(--line)',
            borderRadius: 'var(--radius-lg)', padding: '20px',
            boxShadow: 'var(--shadow-card)',   // v2 (design_handoff_v2)
            cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700, color: 'var(--mute)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {props.label ?? TREND_CARD_DEFAULTS.label}
            </span>
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)' }}>ⓘ</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '44px', fontWeight: 800, color: 'var(--mute)', opacity: 0.5, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>—</div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 400, color: 'var(--mute)', marginTop: '6px' }}>earlier</div>
            </div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '20px', color: 'var(--mute)', opacity: 0.4 }}>→</div>
            <div style={{ flex: 1 }}>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '44px', fontWeight: 800, color: 'var(--mute)', opacity: 0.5, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>—</div>
              <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 400, color: 'var(--mute)', marginTop: '6px' }}>now</div>
            </div>
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 400, color: 'var(--ink-2)', lineHeight: 1.5 }}>
            The trend lands after a few months of same-effort runs. Compounds quietly.
          </div>
        </div>
        {sheetOpen && (
          <ExplanationSheet
            onClose={() => setSheetOpen(false)}
            state="pending"
            eyebrow={props.label}
            runNoun={props.sessionLabel}
          />
        )}
      </>
    )
  }

  // ── Live ──────────────────────────────────────────────────────────────────
  // Props confirmed as TrendCardLive here.
  const { earlierMonth, earlierHr, nowHr, cohortSize, windowMonths, gloss, label, sessionLabel, glossless } = props
  const eyebrow    = label        ?? TREND_CARD_DEFAULTS.label
  const runNoun    = sessionLabel ?? TREND_CARD_DEFAULTS.sessionLabel

  // Count-up values come from the hoisted calls above (HOOKS-ORDER-01).
  // Gloss fades in after both count-ups complete.
  const glossVisible = earlier.done && now.done

  return (
    <>
      <div
        onClick={() => setSheetOpen(true)}
        style={{
          background: 'var(--card)', border: '1px solid var(--line)',
          borderRadius: 'var(--radius-lg)', padding: '20px',
          cursor: 'pointer',
        }}
      >
        {/* Eyebrow */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700, color: 'var(--mute)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            {eyebrow}
          </span>
          <span style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 400, color: 'var(--mute)', opacity: 0.8 }}>
            across {cohortSize} {runNoun}{cohortSize !== 1 ? 's' : ''} · {windowMonths}mo
          </span>
        </div>

        {/* Metric pair: earlier → now */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '20px' }}>
          <MetricPair value={String(earlier.value)} label={`${earlierMonth} avg`} />
          <div style={{
            fontFamily: 'var(--font-ui)', fontSize: '20px', fontWeight: 400,
            color: 'var(--mute)', lineHeight: 1, marginTop: '12px', flexShrink: 0,
          }}>
            →
          </div>
          <MetricPair value={String(now.value)} label="now" />
        </div>

        {/* AI section — CoachByline + gloss, separated by a border + left rail.
            CO-ONE: glossless mode hides this block entirely on Coach so the
            trend reads as raw evidence with no second Kit voice. Interpretation
            folds into the one Kit read at the top of the screen. */}
        {!glossless && (
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: '14px', position: 'relative', paddingLeft: '14px' }}>
            {/* 3px moss left rail — AI-card companion (Pattern 16b) */}
            <div style={{
              position: 'absolute', left: '8px', top: '14px', bottom: '0',
              width: '3px', background: 'var(--moss)', borderRadius: '2px',
            }} />

            <div style={{ marginBottom: gloss ? '10px' : 0 }}>
              <CoachByline
                working={!gloss && !glossVisible}
                role={eyebrow}
              />
            </div>

            {gloss && (
              <p style={{
                fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 400,
                color: 'var(--ink-2)', lineHeight: 1.55, margin: 0,
                opacity: glossVisible ? 1 : 0,
                transition: 'opacity 0.2s ease-out',
              }}>
                {gloss}
              </p>
            )}

            {/* When no gloss came back from AI (silent fallback) */}
            {!gloss && glossVisible && (
              <p style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 400, color: 'var(--mute)', lineHeight: 1.55, margin: 0 }}>
                {runNoun.charAt(0).toUpperCase() + runNoun.slice(1)} HR, {earlierMonth} to now.
              </p>
            )}
          </div>
        )}
      </div>

      {sheetOpen && (
        <ExplanationSheet
          onClose={() => setSheetOpen(false)}
          state="live"
          windowMonths={windowMonths}
          eyebrow={eyebrow}
          runNoun={runNoun}
        />
      )}
    </>
  )
}
