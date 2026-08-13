---
name: ship
description: Move a shipped feature from docs/releases/backlog.md to docs/canonical/feature-registry.md. Invoke after a commit that ships a tracked backlog item. The user can also invoke /ship explicitly with an item ID or short name.
---

# /ship — Move a backlog item to the shipped registry

## Job

Atomically transfer a backlog entry to `feature-registry.md`. Source of truth flips: backlog (forward work) → feature-registry (shipped log). An item lives in exactly one of the two.

## Pre-ship silent-failure gate (MANDATORY)

Before moving ANY item to the registry, apply this gate. It exists because AI
enrichment silently fell back to rule copy for ~4 months (a Zod v4
`z.record(enum,…)` exhaustiveness change failed `EnrichedPlanSchema`; the failure
was invisible because (a) the fallback is silent by design — ADR-006, and (b) the
one success-path test used a fixture that omitted the field that actually broke).
The lesson: **a feature that fails silently must be provably tested on its success
path with a realistic input, and its failure must be visible to a human.**

A feature does NOT ship (do not move it to the registry) until every applicable
box is checked:

1. **Silent fallback / silent catch?** If the feature has ANY path that swallows
   a failure and returns a degraded-but-valid result (`try/catch` → original,
   `.safeParse()` → fallback, `?? default`, empty-on-error):
   - **Success-path test with a production-shaped fixture.** There must be a test
     that exercises the *happy* path with input shaped like what the real producer
     emits — not a minimal stub. A model/enricher that returns partial-week
     `sessions` must be tested with a partial-week `sessions` object. Asserting
     only the failure paths, or asserting success with an unrealistic fixture,
     does NOT satisfy this. (This is the exact hole that hid the enrichment bug.)
   - **The failure is human-visible.** Per N-015, a recorded ops event alone is
     insufficient — nobody was reading it. There must be a surfaced signal that a
     *sustained* failure rate would trip: a health probe, a dashboard counter, or
     an alert. "It logs to `ops_events`" is not enough on its own.

2. **Parse / validate boundary on external or model output?** (Zod schema over an
   API response, model output, Gist JSON, webhook payload.) There must be a
   round-trip test that feeds a **captured real sample** through the schema and
   asserts it is accepted. Schemas are contracts with an external producer; test
   them against the producer's real shape, not a hand-tuned one.

3. **Two subsystems compose over the same data?** If feature B mutates a field
   that feature A branches on (e.g. the enricher rewrites session labels, and
   plan invariants classify sessions *by* those labels), there must be a test of
   the **composed** path — run A's output through B, then re-check A's guarantees.
   Each subsystem being correct in isolation does not make the composition
   correct. Classification must key off structural fields, never a display string
   another subsystem is allowed to rewrite (D-17). This is how the shakeout
   invariant silently reverted enriched plans for months.

4. **Touched a validation dependency or its version?** (`zod`, a schema lib, a
   parser.) Re-run the boundary tests in §2 with real samples — minor-version
   bumps can silently change validation semantics (this is exactly what the Zod 3→4
   bump did to `z.record`). Note it in the ship description.

5. **Fixed-keyset record over an enum?** Use `z.partialRecord(<enum>, …)`, never
   `z.record(<enum>, …)` (exhaustive under Zod v4). The pre-commit hook blocks the
   bad pattern mechanically; if you hit that block, this is why.

6. **New way to classify or branch on a "kind" of thing?** (session kind — long
   run / shakeout / hard; tier; source; plan kind.) Before adding it, check whether
   a canonical owner already exists and USE it — do not add a parallel classifier.
   For sessions that is `lib/plan/sessionRole.ts` (`isLongRun` / `isShakeout` /
   `coachingSessionType`), governed by INV-CLASS in the architecture skill. Two
   production bugs came from parallel classifiers drifting from the generator's
   actual output (`session.type === 'long'` was silently dead; `label.includes(...)`
   silently broke under the enricher). Classify by a **structural** signal the
   producer stamps, never by a display string another layer can rewrite, and when
   you add a classifier, list the surfaces that consume it and check the impact on
   each. The pre-commit hook blocks label-based session classification mechanically.

If any applicable box cannot be checked, the item stays in the backlog with a note
naming the missing guard. A silently-failing feature is not "shipped" — it is
"deployed and unverified."

## When to invoke

1. **Auto** — after a `git commit` that ships a tracked backlog item, the post-commit hook reminds you to check. Inspect the commit (message + diff) and decide: did this commit complete a backlog entry?
2. **Manual** — user invokes `/ship <id-or-name>` to move a specific entry.

If the commit was a partial step (e.g. infra for a multi-commit feature, a bug fix, a refactor), do NOT invoke `/ship`. Only ship when the user-visible feature is actually delivered.

## Procedure

1. **Identify the item.** If user supplied an ID/name, find it in `backlog.md`. Otherwise, infer from the commit: scan `backlog.md` Now/Next/Later sections for entries matching the commit's intent. If ambiguous, ask the user — do not guess.

2. **Confirm tier.** Every shipped feature must be tagged FREE / PAID / TIER-DIVERGENT / FREE (infra) / PAID (infra). If the backlog entry already lists a tier, use it. If not, ask the user before proceeding.

3. **Remove from backlog.** Delete the entry's row/bullet from `backlog.md`. If it was the only item in a sub-section, leave the heading; do not delete structural elements.

4. **Append to feature-registry.** Add a row to the **end** of the "Shipped Features" table in `docs/canonical/feature-registry.md` with this format:

   ```
   | <Feature name> | <Tier> | <YYYY-MM-DD> | <One-line factual description: what it does, key files/tables, gotchas if any> |
   ```

   - **Date** is the commit date (today, unless backfilling).
   - **Description** is one line, factual, no marketing voice. Mention the file/route/table where the feature lives. Note any silent-fallback or admin-only quirks.
   - Replace any "Release: R23" / "GTM-08" / similar IDs with the date — the registry is chronological, not release-coded.

5. **Verify.** Re-read both files to confirm: backlog entry gone, registry entry present, no markdown table corruption, no stray separators.

6. **Report.** One line back to the user: `Shipped: <feature> → registry. Removed from backlog.`

## Edge cases

- **Multi-commit features.** If shipping requires multiple commits and only the final one completes the user-visible feature, only invoke `/ship` on the final commit. The earlier commits are infrastructure — leave the backlog entry alone until the feature lands.
- **Partial ships.** If a backlog item splits into "Phase 1 complete, Phase 2 deferred", split the entry: register Phase 1 as shipped, leave Phase 2 in backlog with a note.
- **Backfilling.** If asked to record something already shipped (no current commit), use the actual ship date if known, otherwise use today and flag it: `(backfilled YYYY-MM-DD)`.
- **No matching backlog entry.** If a feature ships that was never in the backlog, append to the registry directly with a note: "Not in backlog — emergent / hotfix / scoped mid-flight."
- **Reverting a ship.** If a feature is reverted (rolled back), move the entry back from registry to backlog with a status note. Do NOT silently delete from the registry.

## What this skill does NOT do

- It does not run tests, builds, or deploys. It is a documentation move only.
- It does not write commit messages or push branches.
- It does not update CLAUDE.md, ADRs, or contracts. Those updates remain the engineer's responsibility per CLAUDE.md rules.
