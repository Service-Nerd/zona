'use client'

import { InlineError } from '@/components/shared/InlineError'
import { useState } from 'react'
import type { Plan, BenchmarkInput } from '@/types/plan'
import { authedFetch } from '@/lib/supabase/authedFetch'
import { isLongRun } from '@/lib/plan/sessionRole'
import { convertPaceString, type DistanceUnits } from '@/lib/format'
import { BenchmarkFields } from '@/components/shared/BenchmarkFields'
import { FieldLabel } from '@/components/shared/FieldText'
import { benchmarkFromFields, benchmarkProblem, type BenchmarkFieldValues } from '@/lib/plan/benchmarkCheck'
import { RaceTimesCard } from '@/components/shared/RaceTimesCard'
import PinnedBackHeader from '@/components/shared/PinnedBackHeader'
import Button from '@/components/ui/Button'

// BENCHMARK-INPUT-01 (2026-10-16) — the benchmark distances, label and inputs live in
// `components/shared/BenchmarkFields`, shared with the Generate Plan wizard. This screen
// had its own copies of all of them, and they had drifted.

// ─── Pace band extraction ─────────────────────────────────────────────────────

// Pull the first easy + quality pace_target from the plan so the panel shows
// the actual bands the user is currently training to (not synthesised values).
// PACE-UNITS-01 — `pace_target` is a STRING with `/km` welded on at generation
// time (674 of 888 stored sessions), so the unit cannot be fixed at the
// producer for a plan that already exists. Converted here, at the read, before
// either band reaches the panel.
function getPaceBands(plan: Plan, units: DistanceUnits): { easy: string | null; quality: string | null } {
  let easy: string | null = null
  let quality: string | null = null
  for (const week of plan.weeks) {
    for (const session of Object.values(week.sessions)) {
      if (!session) continue
      if (!easy && (session.type === 'easy' || isLongRun(session) || session.type === 'recovery')) {
        if (session.pace_target) easy = session.pace_target
      }
      if (!quality && (session.type === 'quality' || session.type === 'tempo' || session.type === 'intervals')) {
        if (session.pace_target) quality = session.pace_target
      }
      if (easy && quality) return { easy: convertPaceString(easy, units) ?? null, quality: convertPaceString(quality, units) ?? null }
    }
  }
  return { easy: convertPaceString(easy, units) ?? null, quality: convertPaceString(quality, units) ?? null }
}

// ─── Updated pace result ──────────────────────────────────────────────────────

function UpdatedPaceResult({ plan, weeksUpdated, stravaConnected, units }: { plan: Plan; weeksUpdated: number; stravaConnected: boolean; units: DistanceUnits }) {
  const { meta } = plan
  const { easy, quality } = getPaceBands(plan, units)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
      <div style={{
        background: 'var(--card)', borderRadius: '12px',
        border: '0.5px solid var(--moss)', borderLeft: '3px solid var(--moss)',
        padding: '16px',
      }}>
        <div style={{ fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--moss)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 'var(--space-3)' }}>
          Pace updated
        </div>
        {meta.vdot !== undefined && (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
            <span style={{ fontFamily: 'var(--font-brand)', fontSize: '28px', fontWeight: 600, color: 'var(--moss)' }}>
              {meta.vdot}
            </span>
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)' }}>VDOT</span>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {[
            ...(easy    ? [{ label: 'Easy pace',    value: easy }]    : []),
            ...(quality ? [{ label: 'Quality pace', value: quality }] : []),
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)' }}>{label}</span>
              <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 500, color: 'var(--ink)' }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      <RaceTimesCard variant="result" stravaConnected={stravaConnected} />

      <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)', textAlign: 'center' }}>
        {weeksUpdated} remaining {weeksUpdated === 1 ? 'week' : 'weeks'} updated.
      </div>
    </div>
  )
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function BenchmarkUpdateScreen({
  onBack,
  plan,
  stravaConnected,
  onUpdated,
  units = 'km',
}: {
  onBack: () => void
  plan: Plan
  stravaConnected: boolean
  onUpdated: (plan: Plan) => void
  units?: DistanceUnits
}) {
  const [values, setValues] = useState<BenchmarkFieldValues>({
    type: null, distKm: null, hours: 0, mins: 0, secs: 0, ttDistKm: '', date: '',
  })
  const onChange = (patch: Partial<BenchmarkFieldValues>) => setValues(v => ({ ...v, ...patch }))

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ plan: Plan; weeksUpdated: number } | null>(null)

  // The same gate the server runs (§55 Am. 1): complete AND humanly possible.
  const built = benchmarkFromFields(values)
  function canSubmit() {
    return built !== null && benchmarkProblem(built) === null
  }

  async function handleRecalibrate() {
    if (!canSubmit()) return
    setLoading(true)
    setError(null)

    // TIME-INPUT-SECONDS-01 — the runner's OWN seconds, never a fabricated `:00`
    // (8 of 8 stored benchmarks ended `:00` before it). Now built by the one shared
    // builder, which also carries the run date this screen never used to ask for —
    // §42's staleness ramp reads it (BENCHMARK-INPUT-01).
    const benchmark = built!

    try {
      const res = await authedFetch('/api/recalibrate-zones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ benchmark }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Try again.')
        return
      }
      setResult({ plan: data.plan, weeksUpdated: data.weeks_updated })
      onUpdated(data.plan)
    } catch {
      setError('Could not reach the server. Check your connection.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>

      {/* BACK-ARROW-TITLE-COLLIDE-01 — the arrow and the title pin TOGETHER. This title
          is short and discrete, so it belongs in the band: a floating disc at x 16–60 was
          otherwise free to park on "Update pace targets." mid-word.
          ⚠️ The earlier fix here (BACK-ARROW-FLOAT-04) made the arrow float because its
          header sat in a `flexShrink: 0` block beside a body whose `overflowY: auto` can
          never overflow under `minHeight: 100%`. That diagnosis still stands; the remedy
          moved on. */}
      <PinnedBackHeader onClick={onBack} padding="16px 16px 0">
        <div style={{ margin: 'var(--space-4) 0 var(--space-6)' }}>
          {/* SUBPAGE-TYPE-SCALE-01 — the documented screen-title role, from its owner. */}
          <div className="screen-header__title" style={{ marginBottom: 'var(--space-2)' }}>
            Update pace targets.
          </div>
          {/* SUBPAGE-TYPE-SCALE-01 — the documented screen-SUBTITLE role, from its owner. */}
          <div className="screen-header__sub">
            You&rsquo;ve done the work. Let&rsquo;s make sure your paces reflect it.
          </div>
        </div>
      </PinnedBackHeader>

      {/* Body */}
      {/* STICKY-INERT-SCREENS-01 (Design Board, 2026-10-01) — the `overflowY: 'auto'` that
          was here is GONE, not fixed with `minHeight: 0`. Under a `minHeight: 100%`
          outer the box grows to fit its content, so the overflow could never happen:
          it claimed to be a scroller and was not. The two live options were not equal.
          `minHeight: 0` would have made it real — a pane with its own scroll inside the
          page scroller, which is a seam, and `SCROLL-NATIVE-01` removed chaining a week
          earlier for the same reason. `PullToRefresh` is the app's one scroller.
          ⚠️ Nothing was captured today: every sticky element here is a SIBLING. The cost
          was the next sticky CHILD, which would never stick, silently, with a green
          gate. Registered in `lib/ui/stickyScroller.test.ts` until now. */}
      <div style={{ flex: 1, padding: '0 16px 24px', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

        {result ? (
          <UpdatedPaceResult plan={result.plan} weeksUpdated={result.weeksUpdated} stravaConnected={stravaConnected} units={units} />
        ) : (
          <>
            <RaceTimesCard variant="anchor" stravaConnected={stravaConnected} />
            <div>
              <FieldLabel>New benchmark</FieldLabel>
              <BenchmarkFields values={values} onChange={onChange} units={units} />
            </div>

            {/* BENCHMARK-INPUT-01 — the app's form-error alert (as the wizard's save
                bar), not an amber coaching card: this is a refusal, not advice. */}
            {error && (
              <InlineError>{error}</InlineError>
            )}
          </>
        )}
      </div>

      {/* CTA */}
      <div style={{
        flexShrink: 0,
        padding: '12px 16px calc(12px + env(safe-area-inset-bottom))',
        borderTop: '1px solid var(--line)',
        background: 'var(--bg)',
      }}>
        {result ? (
          <Button variant="secondary" fullWidth onClick={onBack}>
            Back to plan
          </Button>
        ) : (
          <Button
            onClick={handleRecalibrate}
            disabled={!canSubmit()}
            busy={loading}
            busyLabel="Recalibrating…"
            fullWidth
            style={{ padding: '15px', borderRadius: 'var(--radius-md)', fontSize: '15px' }}
          >
            Recalibrate paces
          </Button>
        )}
      </div>
    </div>
  )
}
