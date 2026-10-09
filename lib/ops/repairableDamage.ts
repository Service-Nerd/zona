import { REPAIRABLE_CODES } from '@/lib/plan/planRepairs'

/**
 * DIGEST-REPAIRABLE-01 — turn the daily audit's description into an instruction.
 *
 * The audit already reports which plans are invalid and alerts when a runner's
 * set of violation codes CHANGES. That rule is right for debt with no known
 * remedy — "an alert that always fires is an alert nobody reads" (PLAN-AUDIT-01).
 *
 * 🔴 IT IS WRONG FOR DAMAGE THAT HAS A REMEDY, AND THE SIX-DAY GAP IS THE PROOF.
 * The recalibration defect broke three live plans on 2026-10-03. The transition
 * alert fired once and then went quiet — correctly, by its own rule, because
 * nothing changed after that. The damage sat for **six days** while the digest
 * said nothing, and was only found when the founder read a different line in the
 * same report and asked about it.
 *
 * So this is a STANDING count, repeated every morning until it is zero. It does
 * not decay into noise because it is **self-clearing**: one command fixes it and
 * the field disappears. *"Something happened"* is worth saying once; *"this is
 * still true and here is the fix"* is worth saying until it is not.
 *
 * ⚠️ IT READS `REPAIRABLE_CODES`, the same list the repair script's own
 * population filter reads. One list, so the digest can never advertise a command
 * that does not cover the damage it is reporting — which is exactly how that
 * script came to have a population excluding its own cases.
 */
export interface RepairableSummary {
  /** Distinct plans carrying at least one repairable violation. */
  plans: number
  /** Count per code, commonest first — so the digest can say WHAT is broken. */
  by_code: Record<string, number>
  /** The instruction. A bare run is a dry run; `--apply` writes, archiving first. */
  command: string
}

export const REPAIR_COMMAND = 'npx tsx scripts/recal-live-repair.ts --repair'

/**
 * `undefined` when there is nothing to do — **not** a zeroed object.
 *
 * ⚠️ A digest line reading `repairable: 0 plans` every morning is precisely the
 * noise this is meant to avoid being. Absence is the clean signal.
 */
export function summariseRepairable(
  flagged: ReadonlyArray<{ user_id: string; codes: readonly string[] }>,
): RepairableSummary | undefined {
  const byCode = new Map<string, number>()
  const plans = new Set<string>()

  for (const row of flagged) {
    for (const code of row.codes) {
      if (!(REPAIRABLE_CODES as readonly string[]).includes(code)) continue
      byCode.set(code, (byCode.get(code) ?? 0) + 1)
      plans.add(row.user_id)
    }
  }
  if (plans.size === 0) return undefined

  return {
    plans: plans.size,
    by_code: Object.fromEntries(Array.from(byCode).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))),
    command: REPAIR_COMMAND,
  }
}
