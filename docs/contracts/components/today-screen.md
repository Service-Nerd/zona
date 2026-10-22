# `TodayScreen` — contract

**Component:** `components/dashboard/TodayScreen.tsx`

⚠️ **Written 2026-10-10 because `BASEBUILD-HANDOVER-01` added four props to it and it had
no contract at all**, while being one of the register-counted shared components (4
importers). `CLAUDE.md`: *"when changing any component prop interface, update
`docs/contracts/` in the same commit."*

## Job

**One screen, one question: what am I doing today?** Everything else on it is a card that
earns its place by being about today or about a state change the runner has not yet seen.

## Prop Interface

⚠️ **This list is GENERATED FROM SOURCE, not typed by hand.** On the sibling contract
written minutes earlier I invented a prop that did not exist and omitted two that did;
`componentContracts.test.ts` compares both directions and caught it. **50 props is past
what anyone transcribes reliably.**

⚠️ **AND GENERATING IT WAS NOT ENOUGH EITHER.** My extraction pattern was
`^  [a-zA-Z]+\??:`, which **excludes digits**, so `zone2Ceiling` was invisible to it; and
three props share a line with semicolons (`daysToRace: number; raceName: string; …`), which
the contract parser reads as one. **Both were caught by the gate, not by me.** One prop per
line here, deliberately.

```typescript
interface TodayScreenProps {
  recalTile?: React.ReactNode
  attributionRow?: React.ReactNode
  plan: Plan
  weekIndex: number
  daysToRace: number
  raceName: string
  preferredMetric: 'distance' | 'duration'
  sessionMetricOverrides: Record<string, 'distance' | 'duration'>
  stravaRuns: any[]
  allOverrides: { week_n: number; original_day: string; new_day: string; new_slot?: 'am' | 'pm' | null }[]
  overridesReady: boolean
  onOpenSession?: (s: any) => void
  allCompletions: Record<number, Record<string, any>>
  preferredUnits: 'km' | 'mi'
  zone2Ceiling: number | null
  onManualSaved?: () => void
  restingHR?: number | null
  maxHR?: number | null
  aerobicPace?: string | null
  stravaLoading?: boolean
  firstName?: string
  pendingAdjustment?: any | null
  readinessData?: {
  onAdjustmentConfirmed?: (plan: any) => void
  onAdjustmentReverted?: (plan: any) => void
  trialDaysLeft?: number | null
  onUpgrade?: () => void
  hasPaidAccess?: boolean
  dailyCoachNote?: string | null
  coachNoteSettled?: boolean
  runAnalysisMap?: Record<number, Record<string, any>>
  runAnalysisReady?: boolean
  onOpenCoach?: () => void
  onOpenPostRun?: (data: PostRunData) => void
  unreadNotifications?: number
  onOpenNotifications?: () => void
  showRacePrompt?: boolean
  pendingReshape?: ReshapeProposal | null
  nextGoalData?: { achievement: string; options: NextGoalOption[] } | null
  onPickNextGoal?: (opt: NextGoalOption) => void
  onDismissNextGoal?: () => void
  showMaintCard?: boolean
  onDismissMaintCard?: () => void
  showMaintTransition?: boolean
  handover?: HandoverCopy | null
  onBuildRacePlan?: () => void
  onDismissHandover?: () => void
  handoverBusy?: boolean
  /** MODIFY-WARN-ACK-01 — the card must show its OWN outcome; see below. */
  handoverError?: string | null
  handoverAckLabel?: string | null
  onHandoverAcknowledge?: () => void
  maintReengagement?: boolean
  maintThemeLine?: string
  onSeeMaintPlan?: () => void
  onAckMaintTransition?: () => void
  onLogRaceResult?: () => void
  onReshapeAccepted?: (plan: Plan) => void
  onReshapeDismissed?: () => void
  // STRENGTH-APP-01 (A, B), 2026-10-16. Run day: one compact strength row under the run.
  // No-run day: the strength session IS the day (hero, card, Mark complete) and no rest
  // copy renders. DateStrip: one dot, the run's; a strength-only day gets the strength dot.
  strength?: TodayStrength | null                   // { sessionsByDate, completions, onOpen, onSetStatus, recoveryEases?, onRecoveryAnswer? }
  // STRENGTH-ENTRY-01 (2026-10-17) — opens the strength setup. Passed only when strength is
  // available and NOT set up. The rest card shows one line ("Strength fits on days like
  // this") on the week's FIRST rest day only (`showsStrengthInvite`), so at most once a week.
  onStrengthInvite?: () => void
}
```

## Invariants

1. **The card stack is ordered by HORIZON, not by feature.** Today's session leads;
   state-change announcements sit above ongoing status cards; nothing decorative.
2. 🔴 **A one-time announcement SUPPRESSES its ongoing sibling until acknowledged.**
   MAINT-06 established it and 🔬 Wood made it binding again for the base-build handover:
   **two cards competing at the moment of highest uncertainty is the failure mode.**
3. **Transition cards key off `plan_kind`, never off the race week**, and their seen-state
   lives on the plan's own meta so it survives the handoff (`maintenance_transition_seen`,
   `base_build_handover_seen`).
   🔴 **The seen-flag write may touch NEITHER `race_name` NOR `race_date`.**
   `savePlanForUser` archives on a race-identity change, so a variant that touched either
   would **archive the runner's block while announcing it.**
4. ⚠️ **A transition card's rail names the block that is ENDING.** `--s-recov` for
   post-race maintenance (a maintenance block *is* recovery); `--s-easy` for a finished
   base build (fifteen weeks of easy aerobic running). Cloning a sibling's rail makes the
   colour decorative at the second use.
5. **No AIMark on rule-engine output.** Provenance is honesty: the sparkle marks model
   output only, never engine copy, hand-authored strings or Strava data.
6. **Card copy lives in an owner module under `lib/ui/`, never in JSX** — *"a ternary in
   JSX cannot be called, so which branch renders cannot be proven"* (`handoverCopy.ts`,
   `linkPickerCopy.ts`).
7. **No modal, ever.** `CLAUDE.md` bars popups and Wood holds a standing kill-threat.
8. **Type sizes come from the declared scale.** 🔴 **13px is REFUSED, not merely undeclared** (`ADJUST-JOURNEY-TYPE-01`, Design Board 2026-10-14): 12→13 is 1.083× and 13→14 is 1.077×, so three levels inside two pixels is not a scale. Eleven uses on this screen converged to **Body 14/400**. Eight declarations remain and are **baselined, not converged** — the 22px/500 headline, a 40px metric, 17px ×3 and two glyphs — because each is a visible delta on the home screen that nobody has seen on a device. ⚠️ 13px is undeclared; copying it from
   a sibling card is how the register grows (`appTypeScale.test.ts`, which is a FALLING
   register).
9. **All five states ship together** — loading skeleton, empty, error, data, edge. *Empty
   means calm, not broken.*
10. **A double day (SESSION-SLOTS-01, ui-patterns § 10d).** The week is resolved from the override
    ROWS (never an original→new map, which drops `new_slot`) plus the week's `type`/`badge`, so a
    race-week double is refused. The hero is the day's first session not yet done; the other is the
    compact `SessionCard` row under an AM / PM eyebrow with `doubleAdvice()` once beneath. One CTA.
    Gate: `components/dashboard/todayDouble.markup.test.ts`.
11. **One recovery card a day (STRENGTH-RECOVERY-01 × READINESS-SURFACE-01 item 2, Design Board 2026-10-18).**
    `TdReadyHero` shows for a pending readiness row, or for TODAY's lift (never the selected day's) when
    `readinessData.warranted` and the lift is easeable, not done and unanswered (`strength.recoveryEases`). One
    `answer(kind)` covers both sessions; equal stacked buttons; copy from `lib/ui/recoveryCardCopy.ts`.
    `TodayStrength` gains `recoveryEases` and `onRecoveryAnswer`; `readinessData` gains `warranted`, `signals` and
    `detail.sleepBaseline`. Gate: `components/dashboard/recoveryCard.markup.test.ts`.

## Not this component's

What the engine prescribes (Coaching Board), tier and pricing (SLT), and the decision of
*whether* a transition card should appear — that is its owner module
(`lib/plan/baseBuildHandover.ts`), deliberately pure so it can be tested without a DOM.

## Gates

`lib/plan/baseBuildHandover.test.ts` (16 arms) · `lib/ui/handoverCopy.test.ts` (7) ·
`components/ui/buttonGeometry.test.ts` · `lib/ui/appTypeScale.test.ts` ·
`lib/contracts/componentContracts.test.ts` (this contract against the real interface).

## The handover card shows its own outcome — MODIFY-WARN-ACK-01 (2026-10-13)

🔴 **This card is on Today; the plan preview and every refusal surface render under
`screen === 'plan'`.** So tapping "Build the marathon plan" and SUCCEEDING looked
identical to being REFUSED: nothing happened, on a screen that renders neither.

Now the refusal reason renders on the card (`--warn`, never `--danger` — a designed
refusal is not an error state, §INV-DS-005), with §44/§52's consent step beneath it when
the 422 is acknowledgeable. A SUCCESS navigates to Plan, where the preview lives.

Affects the two live base-build runners when their blocks end (~11 Jan and ~18 Jan);
Tom's is a time goal and lands in §44's warn band, so his is the refusal path.


## A failed confirm or revert is said — PLAN-CHANGE-FAIL-VISIBLE-01 (2026-10-16)

The two cards that act on a `pendingAdjustment` (`AdjustmentBanner` for a plan change, `TdReadyHero` for a
readiness signal) used to catch a failed `/api/confirm-adjustment` or `/api/revert-adjustment` call with
nothing said, keeping the card on screen as if the tap had not registered. Each now holds its own
`saveError`, cleared at the start of every attempt, and renders `PLAN_CHANGE_SAVE_FAILED`
(*"Could not save that change. Try again."*) through `InlineError`. **No prop interface change:** the state is
internal, and the routes now leave the adjustment `pending` on a failed save (ADJUST-STATUS-WITHOUT-SAVE-01),
so a retry is real. Check: `components/shared/planChangeFailVisible.markup.test.ts`.

**Strength session title (STRENGTH-SESSION-TITLE-01, 2026-10-19).** Any strength session's name comes from `strengthSessionTitle(session)` (`lib/strength-bridge/display.ts`), read from what it holds (*Lower body*, *Upper body and light legs*, else the kind title), never `STRENGTH_KIND_TITLE[kind]`. Gate: `lib/strength-bridge/sessionTitle.test.ts`.

- **Session card hue (SESSION-INTERVALS-HUE-01, 2026-10-22):** both run `SessionCard`s pass `catalogueId={…catalogue_id}`, so a VO2 session (typed `quality`) takes the intervals coral on Today. The strength cards pass none.

**Selected day (TODAY-DAY-TAP-01, 2026-10-22).** The strip's selection defaults via `defaultSelectedKey` and resets only when `selectionResetKey(weekIndex, overridesReady, dayLists)` changes (`lib/ui/todaySelection.ts`): a new week, overrides becoming ready, or a session moving. A completions refresh never resets it, so a tapped day stays selected. Held by `lib/ui/todaySelection.test.ts`.
