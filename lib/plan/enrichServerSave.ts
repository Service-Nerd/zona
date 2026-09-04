// ENRICH-SERVER-SAVE-01 (2026-09-04) — the server persists the enriched plan.
//
// THE DEFECT. ENRICH-SAVE-01 correctly removed a 15-second blocking wait: the
// rule plan is ready in ~10 ms, the enricher takes 28–35 s, and the runner must
// not sit staring at a spinner. So the plan is saved immediately and the enriched
// copy is written over it "as a follow-up".
//
// That follow-up was owned entirely by the CLIENT. Which means the design tells
// the runner "don't wait", and then silently penalises them for not waiting: tap
// "Use this plan", lock the phone, and the enriched copy — the paid/trial voice
// layer — is lost forever, with `meta.enrichment` stuck on 'pending'. Observed on
// a real trial plan (2026-09-04): saved 5 s after generation, never written again.
//
// Nothing on the server persisted anything; `/api/generate-plan` only ever READ
// the table (a first-plan count). The stream enqueued `final_plan` and hoped
// someone was still listening.
//
// THE GUARD, and why it is safe. This may only ever overwrite the exact plan it
// just generated:
//   • the row must already exist — generation alone never creates one, so a
//     runner who never tapped "Use this plan" is untouched;
//   • the stored row's `meta.generated_at` must equal THIS generation's, so a
//     runner who kept an older plan, or generated twice and saved the first, is
//     untouched.
// Anything else is a no-op. The client keeps its own follow-up write as the fast
// path, so the UX is unchanged; this is the backstop for everyone who walked away.
//
// The race degrades correctly. If the runner taps AFTER enrichment resolves,
// there is no row at write time, this skips — and the client, still open, writes
// it. If they tap before, the row matches and this lands.

import type { Plan } from '@/types/plan'

export interface StoredPlanRow { plan_json: unknown }

/**
 * Should the server write `finalPlan` over the stored row?
 *
 * Pure so the guard is testable without a database — the reason it is not just
 * an inline `if` in the route. Getting this wrong means overwriting a plan the
 * runner deliberately kept.
 */
export function shouldServerPersist(
  stored: StoredPlanRow | null | undefined, finalPlan: Plan,
): boolean {
  if (!stored) return false                       // never saved — nothing to update
  const storedMeta = (stored.plan_json as { meta?: { generated_at?: unknown; enrichment?: unknown } } | null)?.meta
  const storedAt = storedMeta?.generated_at
  const thisAt = finalPlan.meta.generated_at
  // Both must be present AND identical. A missing timestamp on either side is a
  // reason to decline, not to guess: an unstamped row is a legacy plan the runner
  // has been using, and overwriting it is exactly the harm this guard prevents.
  if (typeof storedAt !== 'string' || typeof thisAt !== 'string') return false
  if (storedAt !== thisAt) return false
  // Already carries a resolved status — the client's follow-up write got there
  // first. Writing again would be harmless but pointless, and skipping keeps the
  // two writers from racing over identical content.
  if (storedMeta?.enrichment && storedMeta.enrichment !== 'pending') return false
  return true
}
