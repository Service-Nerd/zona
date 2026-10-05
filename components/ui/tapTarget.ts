/**
 * The tap-target floor — ONE owner for a value that had twenty-nine.
 *
 * 🔴 TAP-TARGET-DECISIONS-01 batch 8a (2026-10-05). `design-rulings.md` carries
 * *"44px is the supported minimum tap target (iOS HIG)"* as 🟢 STANDING, and the
 * number was written out in **29 places**: three separate named constants —
 * `TAB_MIN_HEIGHT_PX` and `PROVENANCE_MIN_HEIGHT_PX` (both in
 * `TrainingZonesScreen.tsx`) and `SEGMENTED_MIN_HEIGHT_PX` — plus **26 inline
 * literals**. They agreed by luck.
 *
 * This repo's most expensive defects are all this shape and they have names: the
 * tier order written three times with the test asserting its own copy
 * (`TIER-OWNER-01`), the deload cadence in five places in one file
 * (`DELOAD-OWNER-01`), `sumWeeklyKm` by hand in six with a second incompatible
 * answer in fourteen more (`SESSION-KM-01/02`), fourteen copies of one Anthropic
 * call (`OPS-AI-OWNER-01`).
 *
 * ⚠️ WHY A CONSTANT AND NOT A CSS TOKEN. `globals.css` owns the floor for
 * anything using the `.btn` classes, and that is the right layer for the
 * website, which has no React. This constant is for controls styled with inline
 * style objects — the app's prevailing idiom — so the two layers are deliberate
 * and not a duplicate. Changing the rule means changing both, which is why the
 * value is stated here once with its source named.
 *
 * ⚠️ AND WHY THE FLOOR IS SOMETIMES THE FIX RATHER THAN A CONVERSION.
 * ✋ Silvanto's ruling is that the floor is a symptom of OWNERSHIP — convert the
 * control and the height is correct for free. That held for `app/page.tsx`, which
 * hand-rolled seven properties `.btn` already owned and became 47px the moment it
 * used the class. **Measured on `SessionPopupInner`, it does not hold:** its four
 * sub-floor controls are all SELECTED-STATE controls, which `design-rulings.md`
 * forbids sweeping into `Button` because the active fill is the only selected
 * affordance there is. Each would lose something real on conversion — semantic
 * per-tag colour, a type scale, or a compact footprint. So they take the floor,
 * each with its reason written at the call site, and the conversion questions go
 * to the board as their own items.
 */
export const TAP_TARGET_MIN_PX = 44
