// REFRAME-NOTE-LOSS-01 — the view decision, extracted so it can be tested.
//
// ⚠️ WHY THIS IS A SEPARATE FILE. The defect had two halves: the server threw
// the runner's writing away, and the client said nothing about it. The server
// half is not unit-testable without Supabase and auth; this half is, and it is
// the half the runner actually experiences. A test on the source SHAPE of the
// route would pass on a comma change and fail on a refactor, which is not a
// regression test.

/** The shape the route returns. Only the fields the view decision reads. */
export interface ReframeResponse {
  reframe?: string | null
  silenced?: boolean
  silencedMessage?: string | null
  fallback?: boolean
}

export type ReflectionView = 'input' | 'submitting' | 'reframe' | 'silenced' | 'saved'

/**
 * Which view a reframe response resolves to.
 *
 * ⚠️ THE REGRESSION IS THE LAST BRANCH. It used to return `'input'`, which put
 * the runner back at a box with no explanation, immediately after a server that
 * had discarded what they wrote. The server now persists on this path
 * (`persistReflection`), so `'saved'` is both truthful and the only state that
 * tells them so.
 */
export function viewForReframeResponse(json: ReframeResponse): ReflectionView {
  if (json.silenced && json.silencedMessage) return 'silenced'
  if (json.reframe) return 'reframe'
  return 'saved'
}

/**
 * Which view a stored row resolves to on hydration.
 *
 * ⚠️ The third branch could not happen before the fix — a row with a note and
 * no reframe was unreachable, because the route returned before writing it.
 */
export function viewForStoredReflection(row: {
  note_text?: string | null
  reframe_text?: string | null
  reframe_silenced?: boolean | null
  reframe_silenced_reason?: string | null
} | null | undefined): ReflectionView {
  if (!row) return 'input'
  if (row.reframe_silenced && row.reframe_silenced_reason) return 'silenced'
  if (row.reframe_text) return 'reframe'
  if (row.note_text) return 'saved'
  return 'input'
}
