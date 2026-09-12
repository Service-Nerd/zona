'use client'

// DayBudgetRows — UX-WIZARD-01 step 2. "How long on THIS day?"
//
// The WeekGrid above answers WHICH days. This answers HOW LONG on each, for the
// weekdays the runner actually runs. A single global cap costs real training:
// measured 2026-09-12, a 30-minute weekday cap removes 22.1% of mean peak
// volume, because a runner with 30 minutes on Tuesday and 90 on Thursday must
// enter 30 and every weekday shrinks to it.
//
// WHY TAP-TO-CYCLE RATHER THAN CHIPS PER DAY. The canonical `Chip` is 14px text
// with 18px padding; seven of them across five weekday rows is thirty-five
// controls on one substep, which is not a calm screen. Cycling mirrors the grid
// directly above ("tap a day to add it") so the runner reuses an idiom they
// learned ten seconds ago, and each row stays one line.
//
// "Same" means NO OVERRIDE, not a budget of zero — the cycle returns to it after
// the last option so clearing is always reachable by tapping. That is the sparse
// `DayBudgets` model made visible; a sentinel value is how "unknown" starts
// meaning "zero" (SESSION-KM-02).
//
// ui-patterns.md § Form Fields & Pickers → WeekGrid (same family).

import { cycleDayBudget, WEEKDAYS, type WeekPlan, type DayBudgets, type DayKey } from './WeekGrid.logic'

const LABEL: Record<DayKey, string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday', thu: 'Thursday', fri: 'Friday',
  sat: 'Saturday', sun: 'Sunday',
}

export function DayBudgetRows({
  plan,
  budgets,
  options,
  defaultLabel,
  onChange,
}: {
  plan: WeekPlan
  budgets: DayBudgets
  /** Cycle order. Values only — the label map below keeps them in one place. */
  options: readonly { value: number; label: string }[]
  /**
   * What "no override" reads as. Pass a WORD, never a duration: if it renders
   * the chosen cap ("45 min") it collides with an override of the same value,
   * and the two rows then differ by colour alone.
   */
  defaultLabel: string
  onChange: (next: DayBudgets) => void
}) {
  const running = WEEKDAYS.filter(d => plan[d] !== 'rest')

  // Empty state: a weekend-only runner has no weekday to budget, so the whole
  // block is absent rather than rendering a heading over nothing.
  if (running.length === 0) return null

  const values = options.map(o => o.value)
  const labelFor = (v: number) => options.find(o => o.value === v)?.label ?? `${v} min`

  return (
    <div>
      <div style={{
        fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 700,
        letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--mute)',
        marginBottom: '10px',
      }}>
        Different on some days?
      </div>

      <div style={{
        border: '1px solid var(--line)', borderRadius: 'var(--radius-md)',
        overflow: 'hidden', background: 'var(--card)',
      }}>
        {running.map((d, i) => {
          const v = budgets[d]
          const isOverride = v != null
          return (
            <button
              key={d}
              type="button"
              onClick={() => onChange(cycleDayBudget(budgets, d, values))}
              // ⚠️ The state MUST be in the label, not only in the colour.
              // Found by clicking it: cycling Monday from absent to 45 min when
              // the weekday cap is ALSO 45 min changes nothing a screen reader
              // can hear, and nothing a colour-blind runner can see — the rows
              // differed by moss-vs-mute alone (WCAG 1.4.1, use of colour).
              // `defaultLabel` is now a word rather than a duration for the same
              // reason: "Same" can never collide with a minutes value.
              aria-label={
                isOverride
                  ? `${LABEL[d]}: ${labelFor(v)}, set for this day. Tap to change.`
                  : `${LABEL[d]}: same as your weekday cap. Tap to set a different cap.`
              }
              style={{
                width: '100%', minHeight: '48px', padding: '12px 14px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                background: 'transparent', border: 'none',
                borderTop: i === 0 ? 'none' : '1px solid var(--line)',
                cursor: 'pointer', fontFamily: 'var(--font-ui)',
                transition: 'background 0.15s',
              }}
            >
              <span style={{ fontSize: '15px', color: 'var(--ink)' }}>{LABEL[d]}</span>
              <span style={{
                fontSize: '14px',
                fontWeight: isOverride ? 600 : 400,
                color: isOverride ? 'var(--moss)' : 'var(--mute)',
              }}>
                {isOverride ? labelFor(v) : defaultLabel}
              </span>
            </button>
          )
        })}
      </div>

      <div style={{
        fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)',
        lineHeight: 1.5, marginTop: '10px',
      }}>
        Tap a day to give it its own cap. Most people leave these alone.
      </div>
    </div>
  )
}
