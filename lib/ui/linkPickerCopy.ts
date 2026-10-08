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
// ⚠️ WHAT THIS DELIBERATELY DOES **NOT** DO, because the board did not rule it.
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
  /** The eyebrow above the list. */
  eyebrow: string
  /** The line under it. Empty string renders nothing. */
  subtitle: string
}

/**
 * @param linkedName the linked activity's display name, when the screen holds it.
 *   Null is normal and must read as a complete sentence, not as a gap: the name comes
 *   from `preloadedRuns`, which can legitimately not contain the row (the pool is
 *   windowed). **A missing name may never produce "Linked to your ." or a bare dash.**
 */
export function linkPickerCopy(
  isLinked: boolean,
  linkedName: string | null = null,
): LinkPickerCopy {
  if (!isLinked) {
    // Unchanged. This is the state the original copy was written for and it is right.
    return { eyebrow: 'Link an activity', subtitle: 'Optional, select from recent runs' }
  }

  return {
    // PAST TENSE, and it states the state rather than instructing. The runner is not
    // being asked to do the thing they have done.
    eyebrow: 'Linked run',
    subtitle: linkedName
      ? `This session is linked to ${linkedName}. Pick another to change it.`
      : 'This session is already linked. Pick another to change it.',
  }
}
