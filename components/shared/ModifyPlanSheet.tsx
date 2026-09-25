'use client'

import { useMemo, useState } from 'react'
import IconButton from '@/components/ui/IconButton'
import Sheet from './Sheet'
import { DayGridSelector } from './DayGridSelector'
import { SegmentedControl } from './SegmentedControl'
import type { GeneratorInput, Plan } from '@/types/plan'
import { formatDuration } from '@/lib/format'
import { TextField } from '@/components/shared/TextField'
import {
  MODIFIABLE_ROWS, MODIFY_GROUP_LABELS, applyEdits, pendingKeys, editsResetLoggedWeeks,
  type ModifyGroup, type PlanEdits, type ModifiableKey,
} from '@/lib/plan/modifyPlan'
import Button from '@/components/ui/Button'

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
  onStartNewPlan,
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
  /**
   * PLANVERB-01 — the door this sheet's own existence closed.
   *
   * Plan's row now says "Adjust your plan" and Me's says "Start a new plan",
   * which is the fix for two rows sharing one title and going to different
   * places. But a runner who opens this sheet BECAUSE they want a different
   * race has, from the Plan screen, nowhere left to go: the wizard is two
   * screens away on a tab they were not heading for. Splitting the verbs is
   * what created that, so the escape belongs here.
   *
   * Optional, because a caller with no wizard route is a real case (the sheet
   * is shared) and an always-on row pointing nowhere is worse than no row.
   */
  onStartNewPlan?: () => void
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
    <Sheet onClose={onClose} ariaLabel="Adjust your plan" maxHeightVh={88}>
      {(close) => (
        <>
          <div style={{ padding: '4px 20px 0' }}>
            {/* R-5 (Design Board, five-screen review) — A SHEET YOU BROWSE
                TAKES A TOP-RIGHT DISMISS; A SHEET YOU ACT IN KEEPS THE BOTTOM
                BAR. Wroblewski conceded his own rule ("slide-up sheets carry a
                mirrored nav bar at the bottom") on the SHAPE of the sheet.
                This one is BOTH, in sequence: until something is pending there
                is nothing to apply and the runner is reading, so a sticky
                full-width Close is a bar that exists to hold one word while
                covering the content underneath it. The founder named that:
                *"the close button is kind of static in and over the top of the
                modal and the scroll. I don't like it."*
                The moment an edit is pending the bottom bar arrives with
                Apply, and the dismiss goes with it. */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--space-3)' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-brand)', fontSize: '20px', fontWeight: 700, color: 'var(--ink)' }}>
                  Adjust your plan
                </div>
                <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', lineHeight: 1.5, marginTop: '4px' }}>
                  Nothing changes until you apply.
                </div>
              </div>
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
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2)' }}>
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
                          lineHeight: 1.5, marginTop: '2px', marginBottom: 'var(--space-3)',
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
                marginTop: 'var(--space-4)', fontFamily: 'var(--font-ui)', fontSize: '13px',
                color: 'var(--coach-ink)', lineHeight: 1.55,
              }}>
                Moving the race starts a new block, so the weeks you have already logged stop
                counting towards this plan. Your runs are kept.
              </div>
            )}

            {/* PLANVERB-01 — the escape. Deliberately NOT amber: this sheet's
                own note already rules that amber is coaching-warning voice,
                and wanting a different race is not a warning. The consequence
                is carried by the subtitle, in the same second-person present
                tense as every MODIFIABLE_ROW, because that is where this
                product says what a control costs. Hidden while an edit is
                pending: offering to throw the plan away mid-edit is offering
                to discard work the runner has not applied yet. */}
            {onStartNewPlan && pending.length === 0 && (
              <>
                {label('If that is not enough')}
                <button
                  type="button"
                  onClick={onStartNewPlan}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: 'var(--space-3)', padding: '14px 16px', textAlign: 'left',
                    background: 'none', borderRadius: 'var(--radius-lg)',
                    // M-3 (Design Board, Miles open-lens) — THE DASHED BORDER
                    // IS THE GRAMMAR FOR AN OPTION THAT BRANCHES rather than
                    // one that selects. Every row above this one is a setting
                    // you change inside the plan you have; this one leaves.
                    // A solid card on `--card` made it read as a ninth
                    // setting, which is precisely the confusion PLANVERB-01
                    // exists to remove. No fill, so it does not compete with
                    // the eight rows that are the sheet's actual job.
                    // 🔴 THE ONLY DASHED BORDER IN THE PRODUCT, and it read as unfinished
                    // rather than optional. Solid, matching every other card on this
                    // sheet; the row's SUBTITLE already carries that this one replaces
                    // the plan (PLANVERB-01), so the border was not the thing saying it.
                    border: '1px solid var(--line-strong)', cursor: 'pointer',
                  }}
                >
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 500, color: 'var(--ink)', lineHeight: 1.4 }}>
                      Start a new plan
                    </span>
                    <span style={{ display: 'block', fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', lineHeight: 1.5, marginTop: '2px' }}>
                      A different race or goal. Replaces the plan you have.
                    </span>
                  </span>
                  <span style={{ color: 'var(--mute)', flexShrink: 0 }} aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                      <path d="M7 4l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </button>
              </>
            )}
          </div>

          {/* ── Mirrored bottom bar, WHEN THERE IS SOMETHING TO APPLY ──────
              R-5: this bar is the act-in shape. It used to render in both
              states, so with nothing pending it was a sticky rule and a
              full-width Close permanently covering the bottom of a list the
              runner was scrolling. ⚠️ The standing rule that a sheet carries a
              mirrored bottom bar is NOT reversed — it is qualified by shape,
              which is the ruling. And the rule against a disabled primary as
              the resting state is now satisfied by there being no primary at
              all until there is something to press. */}
          {pending.length > 0 && (
          <div style={{
            position: 'sticky', bottom: 0, background: 'var(--bg)',
            borderTop: '1px solid var(--line)', padding: '12px 20px',
            marginTop: 'var(--space-5)',
          }}>
            {/* S2 (Design Board, app review 2026-09-22) — DISMISS IS NEVER THE
                CTA COLOUR. This shipped as a full-width `--moss` button reading
                "Close", which is the strongest colour in the system spent on
                leaving. The founder named it: *"I don't think one of our key
                calls to action should be Close in big green moss."*

                `--moss` is reserved for the action the runner came to take. It
                stays on `Apply N changes` below, which IS that action. */}
            <>
                {/* D1 — the reason, where the action is. A 422 from
                    /api/generate-plan is a DESIGNED refusal carrying a real
                    explanation ("too few weeks", "below the base door"), and
                    until now the runner never saw it: the sheet stayed open and
                    the button appeared dead. `--warn`, never `--danger`: a
                    refusal is not an error state (§INV-DS-005). */}
                {error && (
                  <div style={{
                    marginBottom: 'var(--space-3)', fontFamily: 'var(--font-ui)', fontSize: '13px',
                    lineHeight: 1.5, color: 'var(--warn)',
                  }}>
                    {error}
                  </div>
                )}
                <Button variant="primary" fullWidth 
                  onClick={busy ? undefined : () => onApply(applyEdits(base, edits), resets)}
                  disabled={busy} style={{ padding: '14px', borderRadius: 'var(--radius-md)', background: busy ? 'var(--moss-soft)' : 'var(--moss)', cursor: busy ? 'progress' : 'pointer', fontSize: '14px', fontWeight: 600, color: busy ? 'var(--mute)' : 'var(--card)' }}>
                  {busy
                    ? 'Rebuilding your plan…'
                    : `Apply ${pending.length} change${pending.length === 1 ? '' : 's'}`}
                </Button>
                <Button variant="secondary" size="compact" fullWidth 
                  onClick={() => setEdits({})} style={{ marginTop: '4px' }}>
                  Discard changes
                </Button>
            </>
          </div>
          )}
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
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
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
      // 🔴 PLANVERB-01 / the founder's "the date, it's not rendered correctly".
      // This hand-rolled `<input type="date">` at `fontSize: '13px'` was the
      // ONLY input in the app below the 16px floor that `TextField` exists to
      // lock — iOS zooms the page on any focused input under 16px, so tapping
      // the race date jumped the sheet. The wizard asks the same question
      // through `WizardInput` -> `TextField` and does not, which is why the
      // wizard walk measured no overflow and this surface did.
      //
      // Same shape as S5's countdown formatter: the owner existed and the call
      // site went round it.
      return (
        <TextField
          type="date"
          value={(value as string) ?? ''}
          onChange={onChange}
          ariaLabel="Race date"
        />
      )
    default:
      return null
  }
}
