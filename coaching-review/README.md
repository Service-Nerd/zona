# Coaching Reviews

This folder holds the output of each coaching review round and the backlog of fixes derived from it. The reviews are how Zona's training engine gets smarter over time — generate plans, have a senior coach review them, fix what's wrong, regenerate, repeat.

## Folder structure

```
docs/coaching-reviews/
├── README.md                  ← this file
├── CLAUDE_CODE_PROMPT.md      ← driver prompt for executing a review's backlog
├── YYYY-MM-DD/                ← one folder per review round, dated
│   ├── review.md              ← coach's written review
│   ├── backlog.md             ← actionable tasks scoped to this round
│   └── post-fix-diff.md       ← summary of what changed after fixes (generated)
```

Each round is fully self-contained. Backlog item IDs are scoped to the round (e.g. `2026-04-27/H-01`), so there's no global numbering to maintain.

## The loop

```
1. GENERATE   → run scripts/generate-coaching-review.ts to produce three test plans
2. REVIEW     → senior coach reviews the plans, writes review.md
3. TRIAGE     → translate review into backlog.md (paste-ready snippets per item)
4. EXECUTE    → Claude Code works through the backlog (CLAUDE_CODE_PROMPT.md)
5. VERIFY     → regenerate plans, diff against original, write post-fix-diff.md
6. NEXT       → start a new dated folder for the next round
```

Steps 1–3 are human-driven (with AI assistance). Steps 4–5 are Claude Code in the repo.

## Running a new review round

1. **Create the folder.** `mkdir docs/coaching-reviews/YYYY-MM-DD` using today's date.
2. **Generate fresh plans.** `ts-node scripts/generate-coaching-review.ts` against the three canonical test cases (`docs/coaching-reviews/cases/01-5k-beginner.md` etc.).
3. **Get the review.** Paste the generated plans plus the case files to a senior coach (human or AI playing one). Save the response as `YYYY-MM-DD/review.md`.
4. **Build the backlog.** Translate review recommendations into `YYYY-MM-DD/backlog.md` using the structure of previous rounds as a template. Each item needs: ID, priority, source case, files, acceptance criteria, paste-ready snippets.
5. **Run Claude Code.** Open `CLAUDE_CODE_PROMPT.md`, set the `REVIEW_DATE` at the top, paste into Claude Code from repo root.
6. **Verify.** Claude Code writes `YYYY-MM-DD/post-fix-diff.md` summarising what changed.
7. **Commit.** All four files (review, backlog, post-fix-diff, plus code changes) go in together.

## Backlog item conventions

Every item in `backlog.md` follows the same structure so Claude Code can work through them mechanically:

```markdown
### [PRIORITY-NN] — One-line title
**Source:** Which case(s) surfaced this.
**Files:** Suggested files to touch.
**Problem:** What's wrong.
**Acceptance criteria:** Bulleted, testable.
**Principle to add:** Markdown block ready to paste into CoachingPrinciples.md.
**Invariant snippet:** TypeScript ready to paste into invariants.ts.
```

Priorities are `[HIGH]`, `[MEDIUM]`, `[LOW]`. IDs within a round restart at 01 per priority (H-01, H-02, ..., M-01, M-02, ...).

## Why this structure

- **Repeatable.** Every round looks the same. No improvisation per round.
- **Diffable.** Reviews and backlogs are markdown in git. Easy to compare round 1 vs round 3 and see whether the engine is actually improving.
- **Scoped IDs.** No global counter to maintain, no collisions across rounds.
- **Self-documenting.** Folder names are dates. Anyone looking at this folder six months from now can tell what happened when.

## When to start a new round

After significant engine changes (typically after each backlog has been fully worked through), or roughly monthly during active development. Don't squeeze multiple review rounds into one folder — the dated folder is the unit of work.
