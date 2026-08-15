---
name: zona-debug
description: "Standard pipeline for bug analysis, investigation, root-cause analysis, fix recommendation, and blast-radius assessment in Zonna. Routes to the Coaching Board or SLT only when the fix changes prescription or tier. Triggers: bug, defect, broken, wrong value, not working, doesn't fire, silently, investigate, root cause, RCA, why is this happening, regression, it shows X but should show Y."
---

# Zonna Bug Pipeline

One approach, every time. The symptoms and repro steps change; the method does not.

---

## The input — say it however you like

**A sentence is enough.** "The push says 6km but the card says 5.7." "Coach screen is
blank for the trial user." "Push stopped arriving after Tuesday."

Nobody remembers a template mid-bug, and a standard that depends on remembering one
is the same failure mode as every other process in this repo. **Filling in the fields
is the assistant's job, not the reporter's.**

So: take whatever was said, and restate it as the grid below — inferring what's
implied, marking what's genuinely unknown. Show it back in the first response so a
wrong inference gets corrected in one line rather than after an hour of investigation.

| Field | From a bare sentence |
|---|---|
| **Symptom** | usually stated |
| **Surfaces** | often implied ("the push", "the card") — name every surface that shows this value, including ones not mentioned; disagreement between them is the strongest signal available |
| **Expected / Actual** | often only Actual is given. **Do not assume the reported side is the wrong one** — that's Step 2 |
| **Repro** | assume "not reproduced" unless stated. Normal here |
| **Since** | usually unknown. Worth establishing for silent classes — `git log -S` on the owner is often faster than asking |
| **Hint** | whatever they volunteered |

Only ask a question back when the answer would **change what you investigate first**.
Otherwise state the assumption and proceed — a wrong assumption surfaces in seconds,
a blocked question costs the whole exchange.

---

## Step 0 — Triage. Match the depth to the bug.

Running a full RCA on a typo is how a standard gets abandoned. Pick one and say
which:

| Tier | What it looks like | Depth |
|---|---|---|
| **Trivial** | Wrong copy, a missing null guard, a one-line display slip with no shared owner | Fix it. State the tier and skip to Exit criteria. |
| **Contained** | One surface, one owner, no doctrine or tier implications | Steps 1–3, 5, 7. Skip formal RCA. |
| **Systemic** | Multiple surfaces disagree, silent failure, shared owner, data/schema, or anything touching what the engine prescribes | Full pipeline. |

**Escalate a tier** if the investigation finds a shared owner or a silent path.
Today's "expanded card shows 5.7km" looked Trivial and was Systemic — the same
line also served a wrong number to every miles user.

---

## Step 1 — Is the bug still real?

Verify against the code before investigating. Reported bugs and backlog entries
both go stale.

PUSH-UNITS-01 was picked up for a fix and was already fixed — the entry described
a state that a later sweep had superseded. That is an hour lost to a bug that no
longer existed.

Output: *confirmed present at `<file:line>`* or *not reproducible — here is what
the code actually does now*.

---

## Step 2 — Which behaviour is correct?

**Do not assume the reported side is the wrong one.**

The 6km/5.7km bug had three surfaces showing `6km` and one showing `5.7km`. The
majority was right — `formatDistance` rounds planned distances by design (ADR-015).
The naive fix would have made the correct surfaces match the broken one.

Establish correctness from doctrine, in this order:

1. `docs/canonical/CoachingPrinciples.md` — if it touches prescription
2. `docs/architecture/ADR-*.md` — the ADR that owns this behaviour
3. `docs/canonical/plan-invariants.md` — the mechanical checks
4. The single owner's own source comment (`lib/format.ts`, `lib/plan/sessionRole.ts`)
5. `docs/contracts/` — if it crosses an API or prop boundary

If doctrine is silent, say so — that is itself a finding, and may mean the real
defect is an unwritten principle.

---

## Step 3 — Localise

Three techniques, in this order. They work *because* of this codebase's
singularity doctrine — that architecture is a diagnostic asset, not just a rule.

**3a. Start at the single owner, then enumerate mechanisms.**
Don't grep for the wrong value. Open the owner of the correct behaviour, read the
rule, then ask: *what are the only ways this codebase can produce the wrong
output?* That list is usually two or three items, and grepping them corners the
bug fast.

> Distance wrong on screen → open `lib/format.ts` → the only routes to a decimal
> are `exact: true` or bypassing the formatter → grep both → found.

Owners worth knowing: `lib/format.ts` (all display strings + pace),
`lib/plan/sessionRole.ts` (session classification, INV-CLASS),
`lib/plan/generationConfig.ts` (every coaching numeric),
`lib/plan/invariants.ts` (plan validity), `lib/brand.ts` (brand + pricing).

**3b. Ground truth without reproduction.**
Most of this app's logic lives in pure `lib/` modules with no I/O — deliberately.
When you cannot reach the UI (auth, device, native), reduce the bug to the pure
function and assert against it. That is a real verification, not a substitute one.

> Couldn't open the expanded card behind auth → proved the fix numerically:
> `formatDistance(5.7,'km') === '6km'`, `formatDistance(5.7,'mi') === '4mi'`.

State plainly which parts you verified and which you could not.

**3c. Compare the claim to the computation.**
A specific check, not "read carefully": **does what this code *says* match what it
*computed*?**

> The reframe labelled its cohort `coachingSessionType()` ("long") while filtering
> the pool on raw `.type`. Same object, two different definitions.
> `windowWeeks: 4` sat next to a 56-day window for the same reason.

---

## Step 4 — RCA: why did it survive?

Not "what is broken" — **why did nobody notice?** In this codebase the answer is
almost always *it failed silently*.

Run the catalogue below. Name the class, or say it's a new one (and add it).

### The Zonna silent-failure catalogue

Every entry is a real incident. Almost none presented as a crash.

| Class | Tell | Precedent |
|---|---|---|
| **Unapplied migration** | Feature dead since a date; column missing | `avg_temp_c`, `calories_kcal` — ingest broken for weeks. Check `.claude/state/applied-migrations.txt` |
| **Silent fallback** | Output looks plausible but is the degraded path | Zod v4 `z.record` exhaustiveness → AI enrichment fell back to rule copy for **~4 months** (ADR-006 makes this silent *by design*) |
| **Unchecked response** | Writes vanish, no error | `authedFetch` resolves on 4xx/5xx — callers must read `res.ok` |
| **Wrong Supabase client** | Works on web, silently fails on native | Cookie client has no session on native → RLS blocks the write. Bearer-authed routes need the service-role client |
| **Label-based classification** | Breaks only after AI enrichment runs | Shakeout/long-run matched on a display string the enricher rewrites (D-17). Classify via `sessionRole.ts` |
| **Parallel classifier drift** | One path fires, another doesn't | `type === 'long'` was dead everywhere — the generator emits `type:'easy'` + `role` |
| **Config wiped by tooling** | Worked, then quietly stopped after a sync | `npx cap sync ios` rewrites `packageClassList` and drops local plugins. Always `npm run sync:ios` |
| **Two-writer split** | Two sources disagree about the same state | `session_overrides` (drag UI) vs `plan_json` (engine) |
| **Shadowed identifier** | Type check passes, output is garbage | A local `dist` shadowed by a helper named `dist` — valid identifier, invisible to tsc. After any rename, grep the old name's consumers |
| **Claim/computation mismatch** | Copy asserts something the data doesn't support | Reframe printed "your long runs" over short-run data |

**Search discipline:** a negative grep is not proof of absence. Twice in one
session a wrong-directory search produced a confident false "this doesn't exist"
(CA-08; the Strava webhook at `app/api/webhooks/strava/`). Confirm the path before
concluding something is missing.

---

## Step 5 — Fix options + blast radius

Give **at least two options** where they exist (minimal vs correct), then the
blast radius. The blast radius is the part most often skipped and most often
expensive.

Walk all eight dimensions. Say "none" explicitly — a silent dimension reads as
unchecked.

| # | Dimension | Ask |
|---|---|---|
| 1 | **Shared owner** | If fixing at a single owner, **list every consumer**. Changing `formatDistance` moves four surfaces at once |
| 2 | **Coupled computation** | Does anything else derive from the same fetch, window, or variable? *Widening the reframe RPE window to 56d would have divided an 8-week `completed` by a 4-week `scheduled` and silently inflated the completion ratio* |
| 3 | **Prescription** | Does this change what the engine tells a runner to do? → Coaching Board |
| 4 | **Tier / gate** | Does it change what FREE vs PAID users see? → SLT, and `feature-registry.md` |
| 5 | **Contracts** | API route or component prop changed? → update `docs/contracts/` in the same commit |
| 6 | **Data / schema** | Migration needed? → append to the ledger, or it becomes catalogue class #1 |
| 7 | **AI surfaces** | Prompt builder touched? → reframe golden cases (A–D), and note that suite is a **manual** comparison |
| 8 | **Native** | Needs `npm run sync:ios`, a TestFlight build, or a real device to verify? Say so rather than claiming verification you can't do |

---

## Step 6 — Governance routing

**The default is neither. Most bug fixes need no board.** A gate that fires on
everything gets ignored — that is the same reasoning that keeps the coaching hook
off `ruleEngine.ts`.

**Coaching Board (`/coaching-board`)** — only when the fix **changes what the engine
prescribes**. A defect fix that *restores documented intent* is explicitly exempt:
state the exemption in one line and proceed.

> Restoring intent → exempt. Choosing new intent → convene.

**SLT (`/slt-review`)** — only when the fix is really a product decision: it changes
tier, changes scope materially, or the question is "should we fix this at all
versus ship something else".

**Neither** — everything else. Say "no governance required" and why, in one line.

---

## Step 7 — Exit criteria

A fix is not done until all of these are true or explicitly waived with a reason:

1. **A regression test that fails before and passes after.** For a silent bug this
   is the whole defence — the bug had no symptom, so only a test can hold it shut.
2. **Fixed at the single owner**, not locally. Five copies of the pace formatter
   existed because each was fixed where it was found.
3. **Blast-radius dimensions addressed**, each named.
4. **Docs updated in the same commit** — contracts, `plan-invariants.md`,
   `feature-registry.md`, backlog entry if one exists.
5. **Verification stated honestly** — what you proved, and what you could not.
   "Not visually confirmed, sits behind auth" is a complete answer. Claiming
   verification you didn't do is worse than the bug.
6. **Incident write-up** if it was Systemic and silent — `docs/incidents/<date>-<slug>/`.
   If it's a new failure class, **add it to the catalogue above in the same commit**.
   That loop is what stops this skill decaying into generic advice.

---

## Output format

```
## Bug: [one line]

**Read as:** [the grid, filled in from whatever was said — with `?` where genuinely
unknown and (assumed) on anything inferred, so a wrong read gets corrected in one line]

**Triage:** Trivial / Contained / Systemic — [why]
**Still real:** confirmed at `file:line` / not reproducible — [what the code does now]
**Correct behaviour:** [what it should be, and the doctrine that says so]

### 🔍 Root cause
[The mechanism, at file:line. Then: why it survived — catalogue class, or "new class: X"]

### 🛠 Fix options
1. **Minimal** — [what, and what it leaves unfixed]
2. **Correct** — [what, and why it's worth more]
   **Recommendation:** [which, and why]

### 💥 Blast radius
1. Shared owner — [consumers, or none]
2. Coupled computation — …
3. Prescription — …
4. Tier/gate — …
5. Contracts — …
6. Data/schema — …
7. AI surfaces — …
8. Native — …

### ⚖️ Governance
Coaching Board: [required / exempt — reason] · SLT: [required / not]

### ✅ Exit criteria
[Test that fails-before/passes-after · single owner · docs · what was and wasn't verified]
```

---

## Constraints

- **Two options minimum** when a minimal and a correct fix genuinely differ. Silently
  choosing the minimal one hides a decision that is the user's to make.
- **Never claim verification you did not perform.** Name the gap instead.
- **Don't fix locally** what has a single owner.
- **A passing type check is not evidence** — shadowed identifiers and label-based
  classification both pass tsc while being wrong.
- **Say "no governance required"** out loud rather than omitting the section.
- On-device classes (APNs delivery, HealthKit background wake, Capacitor plugin
  registration) **cannot be diagnosed from here**. Say so and recommend
  instrumentation plus a TestFlight build rather than guessing.
