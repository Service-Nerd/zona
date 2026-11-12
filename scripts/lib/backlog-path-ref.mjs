// OPS-VERIFY-CI-LOCAL-DIVERGE-01 — the path verdict for `backlog-verify.mjs`, in its own module.
//
// 🔴 IT LIVES HERE SO A TEST CAN REACH IT. `backlog-verify.mjs` is a SCRIPT: importing it runs
// the whole 43-second verification and calls `process.exit`, which kills the vitest worker
// ("process.exit unexpectedly called"). Same reason `lib/ops/testDurationRules.ts` exists, and
// the same mistake made first — I exported the function from the script and the test could not
// load it.
//
/**
 * THE VERDICT FOR ONE PATH AN ITEM NAMES — pure, and **deliberately given no way to ask the
 * filesystem.**
 *
 * 🔴 THAT ABSENCE IS THE GUARANTEE, NOT A STYLE CHOICE. Every input here comes from git, so the
 * answer is the same on the machine that wrote the item and in a fresh CI checkout. The defect
 * this replaces was one `existsSync` call: it passed locally over a file that had never been
 * committed, and failed every CI job. A function that cannot see the local disk cannot diverge
 * from CI, and its SIGNATURE is what proves that rather than a comment.
 *
 * Exported so `lib/ops/backlogPathRef.test.ts` can exercise every combination in milliseconds —
 * the script itself takes 43 seconds, so running it twice to test it was never affordable.
 */
export function classifyPathRef({ tracked, ignored, basenameTracked, declaredDead }) {
  if (tracked) return 'tracked'
  if (ignored) return 'artefact'
  if (basenameTracked) return 'moved'
  if (declaredDead) return 'declared'
  return 'dead'
}
