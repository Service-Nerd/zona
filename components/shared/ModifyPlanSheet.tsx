'use client'

import { useMemo, useState } from 'react'
import Sheet from './Sheet'
import { DayGridSelector } from './DayGridSelector'
import { SegmentedControl } from './SegmentedControl'
import type { GeneratorInput, Plan } from '@/types/plan'
import { formatDuration } from '@/lib/format'
import {
  MODIFIABLE_ROWS, MODIFY_GROUP_LABELS, applyEdits, pendingKeys, editsResetLoggedWeeks,
  type ModifyGroup, type PlanEdits, type ModifiableKey,
} from '@/lib/plan/modifyPlan'

/**
 * P-02 — the modify-plan sheet.
 *
 * WHY IT EXISTS. There was no surface on which a runner could change a plan
 * parameter. The only way to change days available, weekday cap, race date,
 * long-run day, injuries or terrain was to **re-run the fourteen-screen
 * wizard, which archives the existing plan.** A runner whose life changes
 * either starts over or carries a plan that is now wrong, and the second is
 * the churn path.
 *
 * ⚠️ PRESENTATION IS THE PRIMITIVE'S, NOT OURS (SHEET-PRESENT-01). `Sheet`
 * owns the portal, `Z_LAYERS.sheet`, the measured nav inset, animation,
 * backdrop, Escape, scroll lock, focus trap and the drag pill. Seven surfaces
 * once hand-rolled this and five sat BELOW the nav, so the runner could not
 * see the part that mattered. Nothing here re-invents a bottom sheet.
 *
 * ⚠️ NO CANCEL TOP-RIGHT. The competitor puts one there; `ux-principles.md`
 * says "slide-up sheets: mirrored nav bar at bottom, not top", so ours differs
 * by rule rather than by preference.
 *
 * ⚠️ THE ROWS AND THEIR CONSEQUENCE SUBTITLES ARE NOT HERE. They live in
 * `lib/plan/modifyPlan.ts`, because copy in a component is copy no test can
 * see, and hard rule 7 applies to every one: a subtitle describing a
 * consequence the engine does not produce is a claim.
 *
 * ⚠️ NO INTENSITY RATIO — Coaching Board veto, 2026-09-20.
 */
export default function ModifyPlanSheet({
  plan,
  onClose,
  busy = false,
  error = null,
  onApply,
  hasPaidAccess,
}: {
  plan: Plan
  onClose: () => void
  /** Regenerate with the overlaid input. The caller owns diff-then-accept. */
  /** D1 — the sheet renders its OWN in-flight and failure states. They used to
   *  live only inside the confirm screen, which does not exist until the
   *  request has already SUCCEEDED, so the whole failure path was invisible. */
  busy?: boolean
  error?: string | null
  onApply: (next: GeneratorInput, resetsLoggedWeeks: boolean) => void
  hasPaidAccess: boolean
}) {
  const base = plan.meta?.generator_input as GeneratorInput
  const [edits, setEdits] = useState<PlanEdits>({})

  const pending = useMemo(() => (base ? pendingKeys(base, edits) : []), [base, edits])
  const resets  = useMemo(() => editsResetLoggedWeeks(plan, edits), [plan, edits])

  const set = <K extends ModifiableKey>(k: K, v: PlanEdits[K]) =>
    setEdits(e => ({ ...e, [k]: v }))
  const valueOf = <K extends ModifiableKey>(k: K): GeneratorInput[K] =>
    (k in edits ? edits[k] : base?.[k]) as GeneratorInput[K]

  const label = (t: string) => (
    <div style={{
      fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em',
      textTransform: 'uppercase', color: 'var(--mute)', margin: '22px 0 8px',
    }}>{t}</div>
  )

  return (
    <Sheet onClose={onClose} ariaLabel="Change your plan" maxHeightVh={88}>
      {(close) => (
        <>
          <div style={{ padding: '4px 20px 0' }}>
            <div style={{ fontFamily: 'var(--font-brand)', fontSize: '20px', fontWeight: 700, color: 'var(--ink)' }}>
              Change your plan
            </div>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', lineHeight: 1.5, marginTop: '4px' }}>
              Nothing changes until you apply.
            </div>

            {(['week', 'body', 'race'] as ModifyGroup[]).map(group => (
              <div key={group}>
                {label(MODIFY_GROUP_LABELS[group])}
                <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)', overflow: 'hidden' }}>
                  {MODIFIABLE_ROWS.filter(r => r.group === group).map((row, i, arr) => {
                    const changed = pending.includes(row.key)
                    return (
                      <div key={row.key} style={{
                        padding: '14px 16px',
                        borderBottom: i < arr.length - 1 ? '1px solid var(--line)' : 'none',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                          {/* A pending edit reads in MOSS. Not amber: amber is
                              coaching-warning voice and an unapplied edit is
                              not a warning. The dot plus the value darkening
                              is enough; the count lives in the bottom bar. */}
                          {changed && (
                            <span aria-hidden style={{
                              width: '6px', height: '6px', borderRadius: '50%',
                              background: 'var(--moss)', flexShrink: 0,
                            }} />
                          )}
                          <div style={{
                            fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 500,
                            color: changed ? 'var(--ink)' : 'var(--ink-2)',
                          }}>{row.label}</div>
                        </div>
                        <div style={{
                          fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)',
                          lineHeight: 1.5, marginTop: '2px', marginBottom: '10px',
                        }}>{row.consequence}</div>
                        <RowControl
                          rowKey={row.key}
                          value={valueOf(row.key)}
                          onChange={(v) => set(row.key, v as never)}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}

            {/* The one edit that costs the runner something they earned. Stated
                before Apply, not after, and only when it is actually true. */}
            {resets && (
              <div style={{
                background: 'var(--warn-bg)', borderRadius: 'var(--radius-lg)', padding: '14px 16px',
                marginTop: '16px', fontFamily: 'var(--font-ui)', fontSize: '13px',
                color: 'var(--coach-ink)', lineHeight: 1.55,
              }}>
                Moving the race starts a new block, so the weeks you have already logged stop
                counting towards this plan. Your runs are kept.
              </div>
            )}
          </div>

          {/* ── Mirrored bottom bar ────────────────────────────────────────
              Two states, and NEITHER is a disabled primary sitting there
              implying the runner has failed to do something. */}
          <div style={{
            position: 'sticky', bottom: 0, background: 'var(--bg)',
            borderTop: '1px solid var(--line)', padding: '12px 20px',
            marginTop: '20px',
          }}>
            {/* S2 (Design Board, app review 2026-09-22) — DISMISS IS NEVER THE
                CTA COLOUR. This shipped as a full-width `--moss` button reading
                "Close", which is the strongest colour in the system spent on
                leaving. The founder named it: *"I don't think one of our key
                calls to action should be Close in big green moss."*

                `--moss` is reserved for the action the runner came to take. It
                stays on `Apply N changes` below, which IS that action. */}
            {pending.length === 0 ? (
              <button
                onClick={close}
                style={{
                  width: '100%', padding: '14px', borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-soft)', border: '1px solid var(--line)', cursor: 'pointer',
                  fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 600, color: 'var(--ink-2)',
                }}
              >
                Close
              </button>
            ) : (
              <>
                {/* D1 — the reason, where the action is. A 422 from
                    /api/generate-plan is a DESIGNED refusal carrying a real
                    explanation ("too few weeks", "below the base door"), and
                    until now the runner never saw it: the sheet stayed open and
                    the button appeared dead. `--warn`, never `--danger`: a
                    refusal is not an error state (§INV-DS-005). */}
                {error && (
                  <div style={{
                    marginBottom: '10px', fontFamily: 'var(--font-ui)', fontSize: '13px',
                    lineHeight: 1.5, color: 'var(--warn)',
                  }}>
                    {error}
                  </div>
                )}
                <button
                  onClick={busy ? undefined : () => onApply(applyEdits(base, edits), resets)}
                  disabled={busy}
                  style={{
                    width: '100%', padding: '14px', borderRadius: 'var(--radius-md)',
                    background: busy ? 'var(--moss-soft)' : 'var(--moss)', border: 'none',
                    cursor: busy ? 'progress' : 'pointer',
                    fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 600,
                    color: busy ? 'var(--mute)' : 'var(--card)',
                  }}
                >
                  {busy
                    ? 'Rebuilding your plan…'
                    : `Apply ${pending.length} change${pending.length === 1 ? '' : 's'}`}
                </button>
                <button
                  onClick={() => setEdits({})}
                  style={{
                    width: '100%', padding: '12px', marginTop: '4px', minHeight: '44px',
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 500, color: 'var(--mute)',
                  }}
                >
                  Discard changes
                </button>
              </>
            )}
          </div>
        </>
      )}
    </Sheet>
  )
}

const DAY_OPTIONS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

/**
 * One control per row. ⚠️ Every one is an EXISTING shared control — the wizard
 * already built all of these, and a second day-picker or a second segmented
 * control is a second thing to keep in step.
 */
function RowControl({ rowKey, value, onChange }: {
  rowKey: ModifiableKey
  value: unknown
  onChange: (v: unknown) => void
}) {
  switch (rowKey) {
    case 'days_available':
      return (
        // ⚠️ String values, parsed back on change. `SegmentedControl` is
        // typed to string options; widening its generic for one caller would
        // change a shared control to suit this screen.
        <SegmentedControl
          ariaLabel="Days a week"
          options={[2, 3, 4, 5, 6].map(n => ({ value: String(n), label: String(n) }))}
          value={String(value ?? 4)}
          onChange={(v) => onChange(Number(v))}
        />
      )
    case 'days_cannot_train':
      return (
        <DayGridSelector
          ariaLabel="Days you cannot run"
          multiple
          value={((value as string[]) ?? []) as never}
          onChange={(v) => onChange(v)}
        />
      )
    case 'preferred_long_run_day':
      return (
        <SegmentedControl
          ariaLabel="Long run day"
          options={[{ value: 'sat', label: 'Saturday' }, { value: 'sun', label: 'Sunday' }]}
          value={(value as string) ?? 'sun'}
          onChange={onChange}
        />
      )
    case 'max_weekday_mins':
      return (
        <SegmentedControl
          ariaLabel="Weekday time limit"
          // ⚠️ `formatDuration`, not `${n} min`. PREF-SWEEP-01 caught the first
          // cut welding the glyph to the value, and it was not merely a style
          // violation: ADR-015 locks the ≥60 rule to hours, so the hand-written
          // version would have shown "60 min" and "90 min" where the rest of
          // the product says "1h" and "1h 30". A unit string assembled at the
          // render site is how two surfaces start disagreeing.
          options={[30, 45, 60, 90].map(n => ({ value: String(n), label: formatDuration(n) ?? String(n) }))}
          value={String(value ?? 60)}
          onChange={(v) => onChange(Number(v))}
        />
      )
    case 'hard_session_relationship':
      return (
        <SegmentedControl
          ariaLabel="Hard sessions"
          options={[
            { value: 'avoid',   label: 'Avoid' },
            { value: 'neutral', label: 'Neutral' },
            { value: 'love',    label: 'Enjoy' },
          ]}
          value={(value as string) ?? 'neutral'}
          onChange={onChange}
        />
      )
    case 'terrain':
      return (
        <SegmentedControl
          ariaLabel="Terrain"
          options={[
            { value: 'road',  label: 'Road' },
            { value: 'trail', label: 'Trail' },
            { value: 'mixed', label: 'Mixed' },
          ]}
          value={(value as string) ?? 'road'}
          onChange={onChange}
        />
      )
    case 'injury_history':
      return (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {['knee', 'shin', 'achilles', 'calf', 'itb', 'plantar'].map(inj => {
            const on = ((value as string[]) ?? []).includes(inj)
            return (
              <button
                key={inj}
                onClick={() => {
                  const cur = (value as string[]) ?? []
                  onChange(on ? cur.filter(x => x !== inj) : [...cur, inj])
                }}
                style={{
                  padding: '7px 12px', borderRadius: '999px', cursor: 'pointer',
                  background: on ? 'var(--moss)' : 'var(--bg-soft)',
                  border: '1px solid var(--line)',
                  fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 500,
                  color: on ? 'var(--card)' : 'var(--ink-2)', textTransform: 'capitalize',
                }}
              >
                {inj}
              </button>
            )
          })}
        </div>
      )
    case 'race_date':
      return (
        <input
          type="date"
          value={(value as string) ?? ''}
          onChange={e => onChange(e.target.value)}
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 'var(--radius-md)',
            background: 'var(--bg-soft)', border: '1px solid var(--line)',
            fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink)',
          }}
        />
      )
    default:
      return null
  }
}
