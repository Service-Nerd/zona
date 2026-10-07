// POSTRUN-JOURNEY-01 (Design Board 6ah, 2026-10-07) — the run read has a WORD budget.
//
// 🔴 THE BUDGET WAS IN THE WRONG UNIT, which is why a 76-word read was compliant.
// `sessionFeedback.ts` said "One paragraph only. TWO sentences, three at the absolute
// most. Never more." The founder's own read was THREE sentences and 76 words: it broke
// no rule, and one of its sentences ran to 38 words carrying an em dash and a colon.
//
// MEASURED across all 83 live `feedback_text` rows: mean 12 words, 77 of 83 at or under
// 20, and exactly ONE breaking the sentence rule. So the sentence cap holds almost
// perfectly and governs nothing that matters. ⚠️ Same class as §1 counting sessions
// where the claim was about minutes: a limit measured in the wrong unit is not a limit.
//
// ⚠️ A PROMPT INSTRUCTION IS NOT A MECHANISM. The model is asked for 40 words AND the
// result is checked, because this repo has shipped "the prompt says so" as enforcement
// before. The check does NOT truncate: a sliced sentence is worse than a long one, and
// the honest response to an over-long read is to notice it, not to maim it.

/** Founder, 2026-10-07: "go for 40 for now." */
export const POST_RUN_READ_MAX_WORDS = 40

/** Words, counted the way a reader would: runs of non-space separated by space. */
export function countWords(text: string): number {
  const t = text.trim()
  return t ? t.split(/\s+/).length : 0
}

export function isWithinReadBudget(text: string): boolean {
  return countWords(text) <= POST_RUN_READ_MAX_WORDS
}

/**
 * The sentence handed to the prompt builder, so the number lives in ONE place and the
 * instruction cannot drift from the check that enforces it.
 */
export function readBudgetInstruction(): string {
  return `One paragraph only. Hard limit ${POST_RUN_READ_MAX_WORDS} words — count them. ` +
    `Two sentences, three at the absolute most. Shorter is better; most good reads are under 20 words.`
}
