# Claude Code Driver — Coaching Review Backlog Executor

This is the reusable driver prompt for executing any coaching review backlog. It is parameterised by `REVIEW_DATE` so the same prompt works every round.

## How to use

1. Set `REVIEW_DATE` below to the dated folder for this round (e.g. `2026-04-27`).
2. Paste the entire prompt below the "BEGIN PROMPT" line into Claude Code from repo root.

---

## REVIEW_DATE

```
2026-04-27
```

(Update this and only this when running a new round.)

---

## BEGIN PROMPT (paste everything below into Claude Code)

You are working on the Zona coaching engine. A senior coach review identified bugs and coaching errors in three generated plans. Your job is to apply all fixes and verify them.

The review round you are working on is **2026-04-27**. All paths below reference that folder.

**Read these first, in order:**
1. `docs/coaching-reviews/README.md` — context on how this loop works
2. `docs/coaching-reviews/2026-04-27/review.md` — full coach review
3. `docs/coaching-reviews/2026-04-27/backlog.md` — structured tasks with paste-ready snippets
4. `docs/canonical/CoachingPrinciples.md` — the constitution you'll be amending
5. `lib/plan/invariants.ts` — where mechanical checks live
6. `scripts/generate-coaching-review.ts` — the script that regenerates the three test cases

**Workflow per backlog item:**

1. Read the item in `backlog.md` in full, including the paste-ready snippets.
2. Locate the relevant source files. The backlog suggests files but the repo may have moved things — verify before editing.
3. Apply the change in this order:
   a. Amend `docs/canonical/CoachingPrinciples.md` with the new principle.
   b. Promote any numerics to `GENERATION_CONFIG` (e.g. `PEAK_LR_RATIO_HM = 0.85`).
   c. Add the invariant to `lib/plan/invariants.ts` and wire it into the invariant suite.
   d. Modify the generator code so the invariant passes.
4. Run `npm test` (or the project's test command). All invariants must pass.
5. Re-run `ts-node scripts/generate-coaching-review.ts` and inspect the diff for the affected case(s). Confirm the fix appears in the generated plan.
6. Commit with message: `fix(engine): [2026-04-27/BACKLOG-ID] one-line summary` (e.g. `fix(engine): [2026-04-27/H-01] respect days_cannot_train in race week`).

**Order of work:**

Work all [HIGH] items in ID order (H-01 through H-10), then **STOP and report**:
- Which items you completed.
- Which (if any) you couldn't complete and why.
- The diff summary of all three regenerated plans vs the original review.
- Any judgment calls you made where the backlog snippet didn't quite fit the repo structure.

**Wait for human approval before proceeding to [MEDIUM] and [LOW] items.**

After approval, work [MEDIUM] (M-01 through M-05), then [LOW] (L-01, L-02). Same commit and verification protocol per item.

**Hard rules:**

- Do NOT skip the invariant step. Every coaching principle change needs a mechanical check or it will regress.
- Do NOT modify the case input files or the original review/backlog markdown. They are the historical record of this round.
- If a backlog snippet uses TypeScript that doesn't match the project's existing patterns (naming, module structure, error types), adapt it to match — but preserve the logic exactly.
- If you find an invariant that should fail on the current generator output but doesn't (i.e. the bug is more subtle than expected), surface that immediately rather than weakening the invariant.
- If a backlog item turns out to be wrong on inspection of the actual codebase (e.g. the bug doesn't exist, or the fix would break something), do NOT silently skip it. Report and pause.

**Final deliverable: post-fix-diff.md**

After the [LOW] block is complete (or after [HIGH] if work is paused there), write a summary to `docs/coaching-reviews/2026-04-27/post-fix-diff.md` containing:

- One section per backlog item: ID, status (`done` / `partial` / `skipped` / `blocked`), 1–3 sentence summary of what changed, link to commit hash.
- A "Generated plan diffs" section: for each of the three cases, list the concrete changes in the regenerated plan (e.g. "Case 02 W9 renamed from 'Long VO2max' to '10K-pace intervals', pace target updated to 4:55/km").
- A "Discovered while working" section: anything you noticed that wasn't in the backlog but should feed into the next review round (e.g. "Goal-pace calculation appears to round down — may be related to H-03 but worth a deeper look").

This file is the input to the next review round. The next reviewer will diff it against new generator output to see whether the engine actually improved.

**Verification at the end of [HIGH] block:**

```bash
npm test
ts-node scripts/generate-coaching-review.ts > docs/coaching-reviews/2026-04-27/regenerated-output.md
diff docs/coaching-reviews/2026-04-27/review.md docs/coaching-reviews/2026-04-27/regenerated-output.md | head -200
```

Report the diff highlights against the expected outcomes listed at the end of `backlog.md`.

Begin with H-01.

## END PROMPT
