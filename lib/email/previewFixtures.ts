// previewFixtures.ts — the one set of example runs every preview surface uses.
//
// 🔴 ONE SET, BECAUSE TWO WOULD DRIFT. `scripts/render-emails.ts` writes files to
// look at and `/api/email/preview` sends them to an inbox. If each held its own
// fixtures, the thing you APPROVE and the thing you RECEIVE would slowly stop
// being the same email — the duplication class this codebase keeps paying for
// (`--s-long` in three places, the tier order in three, fourteen Anthropic calls).
//
// ⚠️ EVERY EMAIL APPEARS IN BOTH ITS STATES, and that is not thoroughness for its
// own sake: **22 of 30 real recipients hit the empty one.** A preview that only
// shows the happy path is how the empty variant shipped unnoticed in the first
// place.

import type { RunSummary } from './trialEmailTemplates'

/** A clean run: in the band, under the ceiling. 68 of 73 real runs look like this. */
export const RUN_CLEAN: RunSummary = {
  actualLoadKm: 8.2, hrInZonePct: 84, hrAboveCeilingPct: 6,
  verdict: 'nailed', analysedRunCount: 9, dayName: 'Tuesday',
}

/** In the band but HOT above the cap — the case §12 Am.2 exists for. Up to 5 of 73. */
export const RUN_HOT: RunSummary = {
  actualLoadKm: 8.2, hrInZonePct: 84, hrAboveCeilingPct: 22,
  verdict: 'close', analysedRunCount: 9, dayName: 'Tuesday',
}

/** No heart rate at all — an iPhone-only runner (ADR-011 §5). Must degrade to silence. */
export const RUN_NO_HR: RunSummary = {
  actualLoadKm: 8.2, hrInZonePct: null, hrAboveCeilingPct: null,
  verdict: null, analysedRunCount: 9, dayName: 'Tuesday',
}

/** Nothing at all. What 22 of 30 real recipients actually got. */
export const RUN_NONE: RunSummary = {
  actualLoadKm: null, hrInZonePct: null, hrAboveCeilingPct: null,
  verdict: null, analysedRunCount: 0, dayName: null,
}

/** A shape-accurate unsubscribe token, never a real one. */
export const PREVIEW_TOKEN = '00000000-0000-4000-8000-000000000000'

/** The session a First-read CTA deep-links to. */
export const PREVIEW_SESSION = { weekN: 2, sessionDay: 'tue' }
