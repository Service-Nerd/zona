// CHARITY-CODE-CONTROL-01 (Design Board, 2026-09-28) — the one string and the one list
// of places it appears.
//
// ── WHY A CONSTANT AND NOT A LITERAL ────────────────────────────────────────
// The control previously existed three times with the string typed out at each site,
// held together only by a comment asking the next person not to reword it:
//
//   "A WORDING FIX, NOT A SECOND BUTTON ... adding another here would be two controls
//    for one action and a third phrasing of the same string, which is how surfaces
//    drift apart (the reason the existing door reuses the other two doors' wording)."
//
// That is a note, not a mechanism, and this repo's own record says a rule that holds
// only while someone remembers is not a rule. `redeemCodeUsage.test.ts` is the mechanism.
//
// 🔴 THE STRING MUST NOT NAME A PROGRAMME. It said "Have a charity code?" and the same
// control is about to serve ambassador and discount codes, because Apple's redemption
// sheet is generic — it redeems any offer code for the app. A label naming one
// programme is a label rewritten every time a programme is added, and Sierra's point at
// the sitting was sharper than that: on the highest-intent screen in the product, a
// prompt that says *other people got this free* is a downsell feeling for the ~all of
// runners who have no code. Neutral and incurious is what a code-less runner reads past.
//
// ⚠️ THE WORDS ARE THE FOUNDER'S. The board ruled that ONE shared, programme-neutral
// string exists and that it lives here. It did not rule on the wording, and the value
// below is the candidate put to him, not a decision taken for him.

/** The single label for every in-app code-redemption control. */
export const REDEEM_CODE_LABEL = 'Have a code?'

/**
 * Every surface that offers code redemption, and the job each one does.
 *
 * ⚠️ THIS LIST IS THE TEST'S POPULATION, and a hand-written population is the failure
 * this repo has recorded four times in one week. So `redeemCodeUsage.test.ts` does NOT
 * trust it: it walks the tracked component files for the control and fails if it finds
 * a placement that is not declared here, and if a declared one has vanished.
 */
export const REDEEM_CODE_PLACEMENTS = [
  {
    file: 'app/dashboard/GeneratePlanScreen.tsx',
    // 🔴 MOVED 2026-09-28, founder instruction: "at end of wizard for setup but before
    // plan". It previously sat inside the `distance` step — STEP ONE — where the runner
    // was offered it before entering anything.
    //
    // ⚠️ ANCHORED TO `isLastStep`, NOT TO A NAMED STEP, and that is the board's
    // amendment rather than a preference. `buildSteps()` appends `hard-sessions`,
    // `terrain` and `injuries` ONLY when `hasPaidAccess`, so the wizard's last step is
    // `injuries` for a trial or paid runner and a different step for a free one.
    // "End of wizard" is not one screen, and anchoring to a step name would put the
    // control somewhere different depending on tier.
    where: 'beneath the final CTA, the screen before the plan is generated',
  },
  {
    file: 'app/dashboard/UpgradeScreen.tsx',
    // Kept. The founder named two placements and did not ask for this one to go; the
    // board kept it because it is the highest-intent surface in the product — the
    // runner is at the paywall, which is the moment a code is worth most.
    where: 'the paywall',
  },
  {
    // 🔴 PATH UPDATED, PLACEMENT UNCHANGED (DASHBOARD-SCREEN-EXTRACT-03): the Me index
    // moved into its own module. The register is keyed by FILE, so a pure relocation
    // reads here as "a declared placement has gone" — which is the derived-population
    // arm doing its job, not a defect.
    file: 'components/dashboard/MeScreen.tsx',
    // Me / profile. ⚠️ Wood's own ruling calls Me "the lowest-frequency surface in the
    // product", and the single lifetime in-app redemption happened here. It stays
    // because the founder asked for it, and because it is the only placement a runner
    // can return to on purpose once onboarding is behind them.
    where: 'Me / profile',
  },
] as const

/**
 * What the control must do after Apple's sheet closes.
 *
 * 🔴 `presentCodeRedemptionSheet()` RETURNS `Promise<void>`. That is the plugin's own
 * type, and it means the app cannot tell a successful redemption from a cancellation
 * from a mistyped code. Wroblewski's blocking condition at the sitting: without a
 * re-check the sheet dismisses, our screen does not change, and the runner taps it
 * again believing it failed.
 *
 * So every placement passes `onAfterSheet`, which re-runs the entitlement check that
 * `SUBS-RECONCILE-RACE-01` built this morning — `__rcIdentify` then
 * `POST /api/subscriptions/reconcile` — and reports whether anything was found.
 */
export type AfterSheet = () => Promise<boolean>
