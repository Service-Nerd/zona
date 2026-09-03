// ENRICH-SAVE-01 (2026-09-03) — ordering between "the runner saved their plan"
// and "the AI enrichment finished".
//
// The rule plan is ready in ~10ms; the enricher takes 28–35s (measured). The
// runner is therefore allowed to commit and leave long before the voice layer
// exists, and the enriched copy is written over their saved plan afterwards.
//
// Three orderings are possible and each needs different handling:
//
//   enrichment BEFORE the tap   → nothing to do. The plan in hand is already
//                                 enriched, so the ordinary save persists it.
//   enrichment AFTER the save   → patch it straight over the saved plan.
//   enrichment DURING the save  → must NOT patch yet. The in-flight save would
//                                 land afterwards and overwrite the enrichment
//                                 with the bare rule plan — reintroducing, as a
//                                 race, exactly the silent downgrade this change
//                                 set out to remove. Hold it and apply on
//                                 completion.
//
// Extracted from GeneratePlanScreen because the repo has no component test
// harness (every test is a pure lib/ unit) and ordering logic that is only
// exercised by hand is how the N8 save race shipped in the first place.

export type SaveState = 'idle' | 'saving' | 'saved'

/** What the caller should do with an enriched plan that has just arrived. */
export type EnrichAction =
  | 'patch'   // write it over the saved plan now
  | 'queue'   // a save is in flight; held until it completes
  | 'ignore'  // not saved yet — the pending save will carry it

export interface EnrichSaveCoordinator<T> {
  readonly state: SaveState
  /** Call when the save request goes out. */
  beginSave(): void
  /**
   * Call when the save has definitely landed. Returns an enriched plan that
   * arrived mid-save and is now safe to write, or null.
   */
  saveCompleted(): T | null
  /** Call when the save threw — returns to idle so the runner can retry. */
  saveFailed(): void
  /** Call when enrichment arrives. Tells the caller what to do with it. */
  enrichmentArrived(plan: T): EnrichAction
}

export function createEnrichSaveCoordinator<T>(): EnrichSaveCoordinator<T> {
  let state: SaveState = 'idle'
  let queued: T | null = null

  return {
    get state() { return state },

    beginSave() { state = 'saving' },

    saveCompleted() {
      state = 'saved'
      const q = queued
      queued = null
      return q
    },

    saveFailed() {
      state = 'idle'
      // Drop anything queued: it belongs to a save that never landed, and the
      // retry will read the latest plan directly.
      queued = null
    },

    enrichmentArrived(plan: T) {
      if (state === 'saved')  return 'patch'
      if (state === 'saving') { queued = plan; return 'queue' }
      return 'ignore'
    },
  }
}
