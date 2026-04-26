---
name: ship
description: Move a shipped feature from docs/releases/backlog.md to docs/canonical/feature-registry.md. Invoke after a commit that ships a tracked backlog item. The user can also invoke /ship explicitly with an item ID or short name.
---

# /ship — Move a backlog item to the shipped registry

## Job

Atomically transfer a backlog entry to `feature-registry.md`. Source of truth flips: backlog (forward work) → feature-registry (shipped log). An item lives in exactly one of the two.

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
