// PLAN-DOORS-01 (Design Board 2026-10-22, 6t-k). The ONE owner of the two plan doors' faces. A runner meets each door
// on more than one surface (run plan: Plan and Me; strength: Me and the Adjust screen), and before this each surface
// drew its own, so the Strength door wore a dumbbell on Me and nothing inside Adjust, and Me had no run-plan door at
// all. ICON-RULE-01 is amended with IDENTITY: a door met on more than one surface wears its destination's glyph on
// every one. Rendering a door anywhere but through here is what `iconRule.test.ts` refuses.
import ActionRow from '@/components/shared/ActionRow'
import { RowIcon } from '@/components/shared/RowIcon'
import { ADJUST_PLAN_TITLE, adjustPlanSubtitle, STRENGTH_TITLE } from '@/components/shared/meDoors'

/** The destination glyphs. One per plan, the same on every surface. */
export const PLAN_DOOR_GLYPH = { run: 'run', strength: 'dumbbell' } as const

export function AdjustPlanDoor({ onOpen, strengthAvailable, divider }: { onOpen: () => void; strengthAvailable: boolean; divider?: boolean }) {
  return <ActionRow icon={<RowIcon name={PLAN_DOOR_GLYPH.run} />} title={ADJUST_PLAN_TITLE} subtitle={adjustPlanSubtitle(strengthAvailable)} onClick={onOpen} divider={divider} />
}

export function StrengthDoor({ onOpen, subtitle, divider }: { onOpen: () => void; subtitle: string; divider?: boolean }) {
  return <ActionRow icon={<RowIcon name={PLAN_DOOR_GLYPH.strength} />} title={STRENGTH_TITLE} subtitle={subtitle} onClick={onOpen} divider={divider} />
}
