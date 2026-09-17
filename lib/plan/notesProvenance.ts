// AI-PROVENANCE-01 — the single owner of "did a MODEL write this session's copy?"
//
// CLAUDE.md states the rule plainly: *"Apply [the AIMark] only to actual model
// output; never to rule-engine, hand-authored copy, or Strava data."* The Session
// Detail card decided it like this:
//
//     aiGenerated={(session.coach_notes?.filter(Boolean).length ?? 0) > 0}
//
// Non-empty notes were taken to mean the enricher had been. But the RULE ENGINE
// writes `coach_notes` too, so the test answered a different question from the
// one it was asked.
//
// MEASURED 2026-09-17, 563 free plans (a free plan is never enriched, by design
// — `meta.enrichment: 'skipped'`): **12,972 of 31,517 running sessions (41.2%)
// carry rule-engine coach notes**, and every one of them rendered Kit's byline
// and the AI provenance rail over copy no model has ever seen. The founder
// caught it on the 5K time trial, whose notes are hand-authored in
// `ruleEngine.ts` AND explicitly protected from the enricher — so Kit was
// claiming authorship of the one string in the app that is most definitively
// not his.
//
// ⚠️ THE ERROR IS NOT SYMMETRIC, which is what decides the uncertain cases.
// Crediting a model for human copy is a false claim about provenance. Failing to
// credit it is modesty. So this answers TRUE only when a model demonstrably
// wrote the copy, and every unknown resolves to FALSE.

import type { Plan, Session, Week } from '@/types/plan'
import { isTimeTrial } from './sessionRole'

/** Enrichment states in which the enricher's output actually reached the plan.
 *  Everything else — 'skipped' (free tier), 'pending', every failure state, and
 *  a legacy plan with no field at all — means the copy on screen is the rule
 *  engine's. */
const ENRICHED_STATES = new Set(['applied', 'applied_partial'])

export function sessionNotesAreAiAuthored(
  session: Pick<Session, 'type' | 'role' | 'label' | 'coach_notes'>,
  meta: Plan['meta'] | undefined | null,
  /** The week the session sits in, when the caller has it. A week reverted to
   *  rule copy by ENRICH-PARTIAL-01 carries the engine's words on an otherwise
   *  enriched plan. */
  week?: Pick<Week, 'enrichment_reverted'> | null,
): boolean {
  if (!(session.coach_notes ?? []).filter(Boolean).length) return false
  if (!meta || !ENRICHED_STATES.has(meta.enrichment ?? '')) return false
  // ENRICH-PARTIAL-01 reverts an offending week to rule copy and keeps the rest,
  // so 'applied_partial' is not a per-session guarantee.
  if (week?.enrichment_reverted) return false
  // §78's time trial is deliberately skipped by `applyEnrichment` (its copy is
  // instruction, not voice), so its notes are the engine's on EVERY plan,
  // enriched or not.
  if (isTimeTrial(session)) return false
  return true
}
