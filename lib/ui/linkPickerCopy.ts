// LINK-PICKER-ALREADY-LINKED-01 (Design Board, 2026-10-08) — the picker's heading
// must say what the session ALREADY HAS before it offers to change it.
//
// 🔴 ONE HEADING SERVED TWO OPPOSITE STATES AND IT WAS WRITTEN FOR THE EMPTY ONE.
// A linked, DONE session reached via "Update log" rendered **"Link an activity"** over
// **"Optional, select from recent runs"** — a first-time instruction over a list whose
// current selection was already made and already visible. Founder: *"seems i can still
// manually link it to the same run its linked against."*
//
// ✋ Silvanto at the sitting: *"'Optional, select from recent runs' is a sentence written
// for an empty state, rendered over a full one. The runner reads 'optional' and has to
// work out whether the selection they can see is a choice they already made or a
// suggestion we are offering. That is the sorting we are supposed to do for them."*
//
// 🎓 Sierra set the stake, and it is why this is not cosmetic: a screen that keeps
// offering to re-link teaches the runner that **our record of their training is
// provisional**, which makes them responsible for checking it every time. That
// undercuts the one claim the encouragement apps cannot make.
//
// ✅ SHAPE RULED BY THE FOUNDER, 2026-10-08: option (b), Collins' shape. The list starts
// HIDDEN behind "Wrong one?" and the screen states what it has.
//
// 🔴 HE RULED IT ONLY AFTER THE CHOICE WAS RE-PUT, because the first version I gave him
// described a highlighted list that did not exist (`LINK-PICKER-SELECTION-UNWIRED-01` —
// the selected state had never been wired). 🎪 Collins' argument was that the list
// communicates nothing about the current state; measured, it communicated nothing about
// the current state. 📱✋ Wroblewski and Silvanto argued to keep the list on the
// assumption that the selection rendered, and **lost** — recorded as a loss in
// `design-rulings.md`, not softened.
//
// ⚠️ THE LIST IS NOT DELETED. It is one tap away, and `linkPickerCopy` returns the label
// for the control that reveals it. Wroblewski's concession was explicit: the two shapes
// converge if "Wrong one?" opens exactly his list.
//
// ⚠️ WHAT THIS STILL DOES **NOT** DO, because the board did not rule it.
// Collins argued the list should not exist in this state at all — *"Linked to your 9.9km
// run, Wednesday. Wrong one?"*, reusing the affordance already live on the auto-match
// suggestion fifty lines up. Wroblewski and Silvanto want the list kept with a remove
// action brought onto the surface. **That split is RECORDED UNRESOLVED and needs the
// founder on a device.** This owner changes the SENTENCE only — the half that is wrong
// under either shape — so neither is pre-empted.
//
// ⚠️ AND THE RULE THE ITEM MISTOOK FOR THE BUG STANDS. `BUTTON-COMPONENT-01` holds that
// the moss active fill is the only selected affordance, so the picker KEEPING the linked
// run in the list is compliance, not an oversight: removing it would delete the only
// signal that says *this is the one you have*. The filter at `SessionPopupInner.tsx:372`
// is correct and is not touched.
//
// ⚠️ VOICE, not design (`brand.md`, per CLAUDE.md's split): one sentence where one will
// do, specific over abstract, past tense for a thing already done. NO EM DASH — these
// are sentences the runner reads. Living in `lib/ui` puts them inside
// `noEmDashApp.test.ts`'s roots, which is the right side of the population change that
// caught that guard out on 2026-10-07.

export interface LinkPickerCopy {
  /** The eyebrow. */
  eyebrow: string
  /** The line under it. Empty string renders nothing. */
  subtitle: string
  /**
   * The label for the control that REVEALS the list, or null when the list is already
   * the screen. Non-null means the list starts hidden.
   */
  changeLabel: string | null
}

/**
 * @param linkedName the linked activity's display name, when the screen holds it.
 *   Null is normal and must read as a complete sentence, not as a gap: the name comes
 *   from `preloadedRuns`, which can legitimately not contain the row (the pool is
 *   windowed). **A missing name may never produce "Linked to your ." or a bare dash.**
 */
export function linkPickerCopy(
  isLinked: boolean,
  linkedDescriptor: string | null = null,
): LinkPickerCopy {
  if (!isLinked) {
    // Unchanged. This is the state the original copy was written for and it is right,
    // and the list IS the screen here — there is nothing yet to state.
    return {
      eyebrow: 'Link an activity',
      subtitle: 'Optional, select from recent runs',
      changeLabel: null,
    }
  }

  return {
    eyebrow: 'Linked run',
    // PAST TENSE, and it states the state rather than instructing.
    subtitle: linkedDescriptor
      ? `Linked to your ${linkedDescriptor}.`
      : 'This session is already linked.',
    // 🎪 Collins' control, and it is DELIBERATELY the one already live on the
    // auto-match suggestion rather than a new string: *"You wrote the right control and
    // did not reuse it on the state that needs it most."*
    changeLabel: 'Wrong one?',
  }
}

/**
 * `"9.9km run, Wednesday"` — the descriptor for the statement.
 *
 * 🥇 DISTANCE AND DAY, NOT THE ACTIVITY'S NAME, AND THAT IS NOT A STYLE CHOICE.
 * `ACTIVITY-NAME-WRITER-01` (filed, P3) records that `lib/health/adapter.ts` sets
 * `name` to `Run (${sourceName})` — the app that WROTE the workout into Apple Health —
 * so the name renders as **“Run (Connect)”** or **“Run (Strava)”** above a subtitle
 * saying “Apple Health”. Two true statements that read as a contradiction. Naming the
 * run by **what the runner did** sidesteps that defect entirely instead of quoting it
 * into a new surface.
 *
 * ⚠️ `distanceText` is passed in already formatted, because `lib/format.ts` is the sole
 * owner of every distance string (ADR-015 / INV-FMT-001) and this module must not grow a
 * second opinion about units.
 */
export function linkedRunDescriptor(
  distanceText: string | null,
  startDate: string | null | undefined,
): string | null {
  const day = weekdayOf(startDate)
  if (distanceText && day) return `${distanceText} run, ${day}`
  if (distanceText)        return `${distanceText} run`
  if (day)                 return `run from ${day}`
  return null
}

/** Local weekday, or null when the date is absent or unparseable. */
function weekdayOf(startDate: string | null | undefined): string | null {
  if (!startDate) return null
  const d = new Date(startDate)
  if (Number.isNaN(d.getTime())) return null
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()]
}
