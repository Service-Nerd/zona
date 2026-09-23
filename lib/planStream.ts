// PLAN-STREAM-OWNER-01 — the single owner of reading /api/generate-plan's
// NDJSON stream.
//
// ── WHY THIS EXISTS ────────────────────────────────────────────────────────
// The route writes `rule_plan` IMMEDIATELY, then `await`s enrichment, then
// writes `final_plan` and closes. ADR-006's whole promise — the runner always
// holds a complete plan before the model runs — lives or dies on the client
// acting on the FIRST message rather than on the closed response.
//
// 🔴 THE DEFECT THIS CLOSES. There were two hand-written consumers of that one
// stream and only one of them was right. The wizard used `getReader()` and
// revealed the plan in about a second. The modify-plan sheet used
// `await res.text()`, which does not resolve until the stream CLOSES — so it
// sat through the entire enrichment before it could use a message the server
// had sent at once.
//
// ⚠️ AND ITS OWN COMMENT SAID THE OPPOSITE, IN SO MANY WORDS:
// *"Taking that first message is correct and avoids holding the sheet open for
// the model."* It took the first message — after awaiting all of them. The
// claim was about WHICH message it used; the computation waited for every one.
// Reading the code confirmed the wrong thing, which is why nobody caught it.
//
// MEASURED on production 2026-09-23 (ops_events): the `enrich-plan` call behind
// the founder's adjust attempt took **38,924 ms**. The sheet spun for all of it
// and then showed "Could not reach the server."
//
// ── WHY AN ASYNC GENERATOR ─────────────────────────────────────────────────
// The two callers legitimately want different amounts of the stream: the wizard
// needs BOTH messages (the ceremony reveals on `rule_plan`, then patches on
// `final_plan`), the sheet needs only the first. A helper that returned "the
// first plan" would fit one caller and be re-hand-written by the other, which
// is the shape that produced this defect. Yielding messages lets each caller
// decide when to stop, and a caller that stops early releases the connection
// through the `finally` below.
//
// ⚠️ CANCELLING EARLY IS SAFE **BY EXISTING DESIGN**, not by luck.
// ENRICH-SERVER-SAVE-01 moved the enrich→persist chain out of the stream body
// and onto `waitUntil` precisely so a disconnecting client cannot take the
// write down with it. Before that change, breaking out of this loop would have
// silently lost the enriched plan.

import type { Plan } from '@/types/plan'

export interface PlanStreamMessage {
  type: 'rule_plan' | 'final_plan'
  plan: Plan
}

/**
 * Yield each NDJSON message as it arrives.
 *
 * A consumer that `break`s gets the reader cancelled for it. A malformed line
 * throws, exactly as the hand-written loops did — the callers' existing
 * `catch` blocks own that, and swallowing it here would turn a broken stream
 * into a silently empty one, which is the failure class this repo pays for
 * most often.
 */
export async function* readPlanStream(res: Response): AsyncGenerator<PlanStreamMessage> {
  const body = res.body
  if (!body) return

  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let nl = buffer.indexOf('\n')
      while (nl !== -1) {
        const line = buffer.slice(0, nl).trim()
        buffer = buffer.slice(nl + 1)
        nl = buffer.indexOf('\n')
        if (line) yield JSON.parse(line) as PlanStreamMessage
      }
    }
    // The route terminates every message with '\n', so this is belt-and-braces
    // rather than a path we rely on. It costs nothing and a dropped final
    // message would be invisible.
    const tail = buffer.trim()
    if (tail) yield JSON.parse(tail) as PlanStreamMessage
  } finally {
    // Releases the connection for an early `break`; a no-op once `done`.
    try { await reader.cancel() } catch { /* already closed */ }
  }
}
