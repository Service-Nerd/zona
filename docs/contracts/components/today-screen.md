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
  allOverrides: { week_n: number; original_day: string; new_day: string }[]
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
  maintReengagement?: boolean
  maintThemeLine?: string
  onSeeMaintPlan?: () => void
  onAckMaintTransition?: () => void
  onLogRaceResult?: () => void
  onReshapeAccepted?: (plan: Plan) => void
  onReshapeDismissed?: () => void
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
8. **Type sizes come from the declared scale.** ⚠️ 13px is **undeclared**; copying it from
   a sibling card is how the register grows (`appTypeScale.test.ts`, which is a FALLING
   register).
9. **All five states ship together** — loading skeleton, empty, error, data, edge. *Empty
   means calm, not broken.*

## Not this component's

What the engine prescribes (Coaching Board), tier and pricing (SLT), and the decision of
*whether* a transition card should appear — that is its owner module
(`lib/plan/baseBuildHandover.ts`), deliberately pure so it can be tested without a DOM.

## Gates

`lib/plan/baseBuildHandover.test.ts` (16 arms) · `lib/ui/handoverCopy.test.ts` (7) ·
`components/ui/buttonGeometry.test.ts` · `lib/ui/appTypeScale.test.ts` ·
`lib/contracts/componentContracts.test.ts` (this contract against the real interface).
