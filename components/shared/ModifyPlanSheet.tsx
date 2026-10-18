'use client'

import { useMemo, useState } from 'react'
import { TAP_TARGET_MIN_PX } from '@/components/ui/tapTarget'
import FloatingBackButton from './FloatingBackButton'
import { useNavHeight } from './Sheet'
import { DayGridSelector } from './DayGridSelector'
import { SegmentedControl } from './SegmentedControl'
import type { GeneratorInput, Plan } from '@/types/plan'
import { formatDuration } from '@/lib/format'
import { TextField } from '@/components/shared/TextField'
import {
  MODIFIABLE_ROWS, MODIFY_GROUP_LABELS, applyEdits, pendingRows, editsResetLoggedWeeks,
  modifiableRowsFor, runDaysOf, runDaysEdits, longRunDayEdits, RUN_DAYS_REFUSAL, type RunDaysRefusal,
  type ModifyGroup, type PlanEdits, type ModifiableKey,
} from '@/lib/plan/modifyPlan'
import Button from '@/components/ui/Button'
import { MICRO_LABELS } from './microLabels'
import ActionRow from './ActionRow'

/** 🧭 ICON-RULE-01 × PINNED-DAYS-01 (Design Board 2026-10-18): NO row icons here. Location earns an icon
 *  on a list of eight or more rows; merging the two day rows left seven, under three labelled groups, so the
 *  icons came off (the Strength door's with them). They return as a decision, not as drift. */

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
  ackLabel = null,
  onAcknowledge,
  onApply,
  hasPaidAccess,
  onStartNewPlan,
  edits,
  onEditsChange,
  strengthDoor = null,
}: {
  plan: Plan
  onClose: () => void
  /** Regenerate with the overlaid input. The caller owns diff-then-accept. */
  /** D1 — the sheet renders its OWN in-flight and failure states. They used to
   *  live only inside the confirm screen, which does not exist until the
   *  request has already SUCCEEDED, so the whole failure path was invisible. */
  busy?: boolean
  error?: string | null
  /**
   * §44/§52 step two — MODIFY-WARN-ACK-01 (2026-10-13).
   *
   * ⚠️ THE PROP CONTRACT MIRRORS `RefusalView` ON PURPOSE (`ackLabel` +
   * `onAcknowledge`, both optional, both required together to render). That
   * component already owns this affordance for the wizard; a second vocabulary
   * for the same consent step is how two surfaces start disagreeing about what
   * the runner just agreed to. The LABEL is never written here — it comes from
   * `ACK_LABEL`, which is Hutchinson's binding condition rendered as a verb.
   */
  ackLabel?: string | null
  onAcknowledge?: () => void
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
  /**
   * 🔴 CONTROLLED SINCE MODIFY-CONFIRM-01 (2026-09-27), AND THE REASON IS A DEFECT.
   *
   * `edits` was `useState` HERE. Opening the confirm screen unmounts this sheet,
   * so every edit was destroyed the moment the runner reached the diff — and the
   * diff's only exit was "Keep my current plan". **There was no non-destructive
   * way back: wanting to change one of two edits cost you both.** The founder hit
   * exactly this ("Apply 2 changes" in his screenshot).
   *
   * The back arrow the Design Board ruled is only real if the edits survive it,
   * so ownership moves up to the caller, which outlives both surfaces.
   */
  edits: PlanEdits
  onEditsChange: (next: PlanEdits) => void
  /**
   * STRENGTH-ENTRY-01 — the Strength door (Design Board: *"Plan's one action is Change your
   * plan, so strength lives in it as a row"*). A DOOR, not a ninth edit row: strength is its
   * own plan and is never part of Apply. Null when strength is not available to this runner.
   */
  strengthDoor?: { title: string; subtitle: string; onOpen: () => void } | null
}) {
  const base = plan.meta?.generator_input as GeneratorInput
  // 🧭 `BASEBUILD-ADJUST-REBUILD-01` — the rows this PLAN KIND may offer, derived from
  // a declared per-kind set rather than a list typed here. Six of the eight cannot
  // change a base-build plan's output, measured against the real producer.
  const rows = modifiableRowsFor(plan)

  // Pending ROWS: "Days you run" moves two keys and is one change (PINNED-DAYS-01).
  const pending = useMemo(() => (base ? pendingRows(base, edits, rows) : []), [base, edits, rows])
  const current = useMemo(() => (base ? applyEdits(base, edits) : null), [base, edits])
  const runDays = useMemo(() => (current ? runDaysOf(current, plan) : []), [current, plan])
  const [refusal, setRefusal] = useState<RunDaysRefusal | null>(null)
  const applyDayResult = (r: ReturnType<typeof runDaysEdits>) => {
    if (!r.ok) { setRefusal(r.reason); return }
    setRefusal(null)
    onEditsChange({ ...edits, ...r.edits })
  }
  const resets  = useMemo(() => editsResetLoggedWeeks(plan, edits), [plan, edits])

  const set = <K extends ModifiableKey>(k: K, v: PlanEdits[K]) =>
    onEditsChange({ ...edits, [k]: v })
  const valueOf = <K extends ModifiableKey>(k: K): GeneratorInput[K] =>
    (k in edits ? edits[k] : base?.[k]) as GeneratorInput[K]

  const label = (t: string) => (
    <div style={{
      fontFamily: 'var(--font-ui)',
      ...MICRO_LABELS.eyebrow,
      color: 'var(--mute)',
      margin: '22px 0 8px',
    }}>{t}</div>
  )

  // 🧭 SAVE-PATTERN-01 (Design Board 2026-10-18) — A SCREEN, NOT A SHEET. At 88vh with seven controls and a date
  // field it was a screen in all but name, without the back arrow every other screen has, and changing a plan had
  // two grammars (a sheet here, a full screen for strength). R-5's logic survives: nothing pending, nothing to press;
  // an edit pending, the Apply bar arrives at the bottom, lifted clear of the floating nav.
  const navH = useNavHeight() ?? 0
  return (
    <div role="region" aria-label="Adjust your plan" style={{ paddingTop: 'var(--space-4)' }}>
        <>
          {/* A pushed screen that scrolls: the floating arrow owner (BACK-ARROW-FLOAT-01). */}
          <FloatingBackButton onClick={onClose} ariaLabel="Back to your plan" />
          <div style={{ padding: '0 20px' }}>
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
                {/* The same title treatment as the consent screen that follows: one journey, one voice. */}
                <div className="screen-header__title">Adjust your plan</div>
                <div className="screen-header__sub">Nothing changes until you apply.</div>
              </div>
            </div>

            {(['week', 'body', 'race'] as ModifyGroup[]).map(group => (
              <div key={group}>
                {label(MODIFY_GROUP_LABELS[group])}
                <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)', overflow: 'hidden' }}>
                  {rows.filter(r => r.group === group).map((row, i, arr) => {
                    const changed = pending.includes(row.key)
                    return (
                      <div key={row.key} style={{
                        padding: '14px 16px',
                        borderBottom: i < arr.length - 1 ? '1px solid var(--line)' : 'none',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
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
                            fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 600,
                            color: changed ? 'var(--ink)' : 'var(--ink-2)',
                          }}>{row.label}</div>
                        </div>
                        <div style={{
                          fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)',
                          lineHeight: 1.5, marginTop: '2px', marginBottom: 'var(--space-3)',
                        }}>{row.consequence}</div>
                        {row.key === 'days_available' ? (
                          <DayGridSelector
                            ariaLabel={row.label}
                            multiple
                            value={runDays}
                            onChange={(v) => current && applyDayResult(runDaysEdits(current, current.preferred_long_run_day, v))}
                          />
                        ) : row.key === 'preferred_long_run_day' ? (
                          <RowControl
                            rowKey={row.key}
                            value={valueOf(row.key)}
                            onChange={(v) => current && applyDayResult(longRunDayEdits(current, runDays, v as 'sat' | 'sun'))}
                          />
                        ) : (
                          <RowControl
                            rowKey={row.key}
                            value={valueOf(row.key)}
                            onChange={(v) => set(row.key, v as never)}
                          />
                        )}
                        {/* PINNED-DAYS-01 — one control cannot contradict itself, so the old two-control
                            conflict line (SHEET-DAY-QUESTION-01) is gone. What is left to say is a
                            refused tap, and why; muted, the same treatment as the consequence. */}
                        {refusal && (row.key === 'days_available' || row.key === 'preferred_long_run_day') && (
                          <div style={{
                            fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)',
                            lineHeight: 1.5, marginTop: 'var(--space-2)',
                          }}>{RUN_DAYS_REFUSAL[refusal]}</div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}

            {/* STRENGTH-ENTRY-01 — the Strength door, its own group because it opens its own
                plan rather than editing this one. Hidden while an edit is pending, for the
                reason the escape below gives: leaving mid-edit is leaving unapplied work. */}
            {strengthDoor && pending.length === 0 && (
              <>
                {label('Around your runs')}
                <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)', overflow: 'hidden' }}>
                  <ActionRow title={strengthDoor.title}
                    subtitle={strengthDoor.subtitle} onClick={strengthDoor.onOpen} />
                </div>
              </>
            )}

            {/* The one edit that costs the runner something they earned. Stated
                before Apply, not after, and only when it is actually true. */}
            {resets && (
              <div style={{
                background: 'var(--warn-bg)', borderRadius: 'var(--radius-lg)', padding: '14px 16px',
                marginTop: 'var(--space-4)', fontFamily: 'var(--font-ui)', fontSize: '14px',
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
                    <span style={{ display: 'block', fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 600, color: 'var(--ink)', lineHeight: 1.4 }}>
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
            position: 'sticky', bottom: navH, background: 'var(--bg)',
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
                    marginBottom: 'var(--space-3)', fontFamily: 'var(--font-ui)', fontSize: '14px',
                    lineHeight: 1.5, color: 'var(--warn)',
                  }}>
                    {error}
                  </div>
                )}
                {/* Step two, and it is a SECOND step rather than a relabelled
                    first one (Hutchinson, binding, PREP-ACK-WARN-OFFER-01): a
                    consent, visually subordinate to Apply, directly under the
                    reason it consents to. Before this the sheet showed the
                    reason and nothing to do about it, and Apply re-sent the
                    identical request — measured twice on one runner, ten
                    seconds apart. */}
                {/* `size="compact"` and NO inline padding/radius/font-size: those
                    belong to the variant (BUTTON-INLINE-OVERRIDE-01). Only the
                    spacing to the next control is set here. */}
                {error && ackLabel && onAcknowledge && (
                  <Button variant="secondary" fullWidth
                    onClick={busy ? undefined : onAcknowledge}
                    disabled={busy}
                    style={{ marginBottom: 'var(--space-3)' }}>
                    {ackLabel}
                  </Button>
                )}
                {/* 🔴 NO INLINE STYLE, and every property it used to set was either
                    WRONG or NOISE (BUTTON-INLINE-OVERRIDE-01, founder device review
                    2026-10-14: *"buttons still don't look right in terms of style and
                    colour"*). Sampled from his screenshot, the fill was **#6B8E6B** =
                    `--moss`, where `.btn--primary` is `--moss-strong` #557055.

                    ⚠️ White on `--moss` is **3.68:1** against AA's 4.5; on
                    `--moss-strong` it is **5.48**. That is the precise failure
                    `BUTTON-COMPONENT-01` shipped to fix, and `a11yContrast.test.ts`
                    records the identical wrong paint being corrected on the MARKETING
                    mockup in September. Fixed on the drawing, not on the live button —
                    the fourth "remedy applied to one case and not its twin" in this family.

                    ⚠️ `--radius-md` (14px) is **`.btn--compact`'s** radius on a
                    regular button. `CTA-COMPACT-SCOPE-01` ruled compact a ROW class the
                    day before; that sweep matched `size="compact"`, so a call site
                    inline-styling the same geometry was invisible to it.

                    The rest was noise: `fontSize`/`fontWeight` restated the variant's own
                    values, and `.btn:disabled` + `.btn--busy` already own the busy paint
                    and cursor — so `busy`/`busyLabel` replace the hand-rolled ternary and
                    `aria-busy`, which this button never announced, now fires. */}
                <Button variant="primary" fullWidth
                  onClick={busy ? undefined : () => onApply(applyEdits(base, edits), resets)}
                  busy={busy} busyLabel="Rebuilding your plan…">
                  {`Apply ${pending.length} change${pending.length === 1 ? '' : 's'}`}
                </Button>
                {/* 🎓 Sierra, CTA-COMPACT-SCOPE-01: this is NOT a peer of Apply and
                    must not look like one. It clears the pending selections and LEAVES
                    YOU ON THE SHEET -- the X above is what exits -- so "Discard changes"
                    named an outcome it does not produce. Founder approved the wording. */}
                {/* ⚠️ NOT fullWidth. `GHOST-AFFORDANCE-01` (2026-09-25) rules that "a
                    button that is one of the primary actions takes a SURFACE", and a
                    sweep removed ten full-width ghosts. The settled-ground scan for
                    CTA-COMPACT-SCOPE-01 MISSED that row and the board ruled a
                    full-width ghost; `buttonOwnership.test.ts` caught it. A centred
                    ghost keeps what the board wanted -- a quiet action that is not a
                    peer of Apply -- without reversing a standing rule. */}
                <Button variant="ghost"
                  onClick={() => onEditsChange({})}
                  style={{ marginTop: '4px', marginLeft: 'auto', marginRight: 'auto', display: 'block' }}>
                  Reset my selections
                </Button>
            </>
          </div>
          )}
        </>
    </div>
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
                  // 🔴 TAP-TARGET-DECISIONS-01 — was 30px. A SELECTED-STATE chip: the
                  // moss fill IS the selected affordance, which `design-rulings.md`
                  // forbids sweeping into `Button`. It takes the floor instead.
                  minHeight: TAP_TARGET_MIN_PX, display: 'inline-flex', alignItems: 'center',
                  padding: '7px 12px', borderRadius: '999px', cursor: 'pointer',
                  background: on ? 'var(--moss)' : 'var(--bg-soft)',
                  border: '1px solid var(--line)',
                  fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 600,
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
