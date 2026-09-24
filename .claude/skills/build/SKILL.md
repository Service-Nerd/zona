---
name: build
description: "The standard build procedure for Zonna. Analysis before code, then SLC delivery, then the records. Sequences every other skill and hook so nothing has to be remembered: settled-ground scan, reuse and consumer checks across app AND website, board routing, regression tests, and /ship. Triggers: let's build, build phase, start the build, implement this, time to build, build it."
---

# Build — Zonna's standard procedure

## Your role

**Senior application developer, twenty years.** You know this application completely: the
engine, the app, the marketing site, the design system, the patterns, and why each of them
is the way it is. You also hold **architect authority** — you agree a new pattern or you
refuse one, and either way it is written down.

You do not start typing code because a task sounds clear. **Analysis first, every time.**

---

## ⚠️ Why this procedure exists

Every hook in this repo fires at one of two moments: **the instant you edit a file**, or
**the instant you commit**. Both are reactive — by the time the design guard fires you
have already decided to edit doctrine, and by the time `ship-record-check` fires the code
is written.

**Nothing has ever fired before a decision.** This skill is that step, and it is the only
one. Everything below is sequencing machinery that already exists; the value is that the
order is written down once instead of being remembered each time.

---

## Where this build came from — declare it first

**A build that cannot name its input should not start.** One line:

| Input | Then |
|---|---|
| **A backlog item** | Name the ID. Confirm it carries a board tag (backlog § Filing rule) |
| **A board ruling** | Name the board and the sitting. The ruling's artifacts are your acceptance criteria |
| **An RCA from `/zona-debug`** | ⚠️ **Debug runs BEFORE build, not inside it.** If there is no RCA yet, stop and run `/zona-debug` |
| **A standalone `frontend-design` pass** | Name the design. `frontend-design` runs on its own merit; this consumes its output |
| **A founder instruction** | Quote it. If it implies a board question, route it in analysis |

**No input named → no build.** That is how unscoped work happens.

---

# PHASE 1 — ANALYSIS

**Produces a written block. A review that ends in prose has done nothing, and "we analysed
it" is unfalsifiable unless it is on the page.**

### 1. What is actually changing
One sentence. If it takes three, it is three changes and they get analysed separately.

### 2. Settled ground
- `docs/canonical/design-rulings.md` — anything UI or website
- `docs/canonical/coaching-rulings.md` — anything the engine prescribes
- `docs/canonical/ownership-map.md` — **who owns this decision**

**Name the rows this touches, contradicts, or would reverse.** "Nothing touched" is valid
after scanning and invalid before.

### 3. Reuse before writing — DRY
**Find the existing function first.** This repo's most expensive defects are duplicates
that drifted, and they all have names:

| | |
|---|---|
| `--s-long` declared in three places and **unreachable for every generated plan** | PLAN-LONGRUN-COLOUR-01 |
| The tier order written **three** times; the test asserted its own copy | TIER-OWNER-01 |
| Fourteen hand-written copies of one Anthropic call | OPS-AI-OWNER-01 |
| The deload cadence expression in **five** places in one file | DELOAD-OWNER-01 |
| `sumWeeklyKm`'s logic written out by hand in six places, with a **second incompatible answer** in fourteen more | SESSION-KM-01/02 |

**If you adapt an existing function, state the blast radius.** Every current caller is now
your responsibility.

### 4. 🔴 The consumer check — app AND website, every time
**Where is this output consumed?** Not "where is it defined" — where is it *read*.

⚠️ **This is the step that catches the class the founder named: a number on the website
that is also in the app.** Check both surfaces. Always. A value can be authored, ratified,
documented, guarded by an invariant and still be inert (`configConsumer.test.ts` exists for
exactly this), and a marketing page can promise something the app no longer renders.

Name every consumer, or write **"none"** and be sure.

### 5. Upstream and downstream impact
Each named or explicitly **"none"**. Upstream: what feeds this. Downstream: what breaks if
the shape changes — components, tests, docs, contracts (`docs/contracts/`), the marketing
site, the OG image, notifications.

### 6. Route the questions — in analysis, not after
| Question | Goes to |
|---|---|
| Changes what the engine prescribes, or any outcome/physiology claim on **any** surface | **`/coaching-board`** |
| Significant UI or UX change, a new screen/component/marketing section, design doctrine | **`/design-board`** |
| FREE/PAID, pricing, build cost, roadmap order | **`/slt-review`** |
| Is this allowed? Does it violate an invariant? | **`zona-architectural-principles`** |
| Anything touching UI craft | **`frontend-design`** — invoked here, and it also runs standalone |
| Locked brand strings, voice, tone | **The founder** |

⚠️ **The guards fire on the file, which is too late.** A coaching question that never
touches `CoachingPrinciples.md` will not trip the hook. **Route it here.**

### 7. New pattern?
Use an agreed one from `ui-patterns.md`. If none fits, **you agree it as architect** and it
lands in `ui-patterns.md` with the *why* — not as a one-off in a component.

### 8. Negative impact and mitigation
Any risk, named, with its mitigation. **"None" is a claim and must be true.**

### 9. Issues found during analysis
Anything discovered here that is **not significant becomes part of this build.**
Significant → its own item, filed in the backlog with a board tag, before proceeding.

---

## The analysis block — mandatory output

```
## Analysis — [what]

**Input:** backlog item / board ruling / RCA / design / founder instruction — named
**Change:** [one sentence]

**Settled ground:** [rows named, or "none touched — scanned"]
**Reuse:** [existing function reused or adapted, + blast radius] / [new, and why nothing fits]
**Consumers:** [every read site — APP and WEBSITE] / "none"
**Upstream:** […] **Downstream:** […]
**Routing:** Coaching Board / Design Board / SLT / none — and why
**New pattern:** [agreed + where it lands] / none
**Risks → mitigation:** […] / none
**Issues found:** [folded into this build] / [filed separately]
**Acceptance:** [how we will know it worked]
```

**Stop here and let the founder read it if the build is anything but trivial.**

---

# PHASE 2 — BUILD

### SLC, non-negotiable
| | |
|---|---|
| **Simple** | One job. Nothing beyond what was asked |
| **Lovable** | Actually good. Names a pattern from `ui-patterns.md` |
| **Complete** | **All states**: loading, empty, error, data, edge. A screen without its empty state is not shipped |

### Testable, or documented as not
**Every value you change gets a test, or an explicit "not mechanically checkable
because…".** An unenforceable rule is a known risk, not an oversight.

### Regression
**Prove the old behaviour still holds.** Run the affected suites. If you changed a
producer, run everything that consumes it.

⚠️ **Falsify any new check before trusting it green.** Break the thing it guards and watch
it go red. This repo has shipped a green tick with nothing behind it more than once:
`--section-gap`, a `flexShrink` that could never fire, two inert gates, and a hollow
inset-border check.

### Defects found mid-build
- **Not significant** → fix it in this build
- **Significant** → **stop.** `/zona-debug` for the RCA, then decide whether it joins this
  build or becomes its own item. *"Include it in the build"* must not become *"fix it
  without understanding it."*

### Backlog during the build
**Anything discovered updates `backlog.md` now, not later.** A note you intend to write up
afterwards is a note that does not exist.

---

# PHASE 3 — LAND

1. **Commit.** `feat(SCOPE):` / `fix(SCOPE):` — the scope names the item, because
   `ship-record-check.py` reads the subject's scope and never the body.
2. **The post-commit hooks fire**: `backlog-touch`, `fix-test-check`, `ship-record-check`,
   `state-block-check`. **Read them. They are not decoration.**
3. **`/ship`** — and read its **§ THE DOCUMENTS** table, which names **eleven** surfaces, not
   the three this line used to imply. Measured 2026-09-22: `/ship` instructed on three documents
   while `audit-docs.sh` checked eight, so the rest were only ever caught after the fact.
4. **`./scripts/audit-docs.sh`** — **run it, never answer "are the docs up to date?" from
   memory.** It has been answered from memory repeatedly and been wrong every time.
4b. **HANDING A VERIFICATION STEP TO THE FOUNDER? IT IS UNTESTED CODE.** Prove the predicate
   returns a DIFFERENT answer in the two states before sending it — `npm run distinguish --
   --before <A> --after <B> --predicate '<cmd with {}>'` when both artifacts are on disk.
   ⚠️ **Express it as the boolean it will actually be evaluated as**: `grep -c x {}` gives 2 vs 3
   and looks fine where `grep -q x {} && echo t || echo f` gives **t vs t**, which was the real
   defect. On 2026-09-24 a predicate handed over to prove a migration had applied returned the
   same answer either way — because the new function named the table in its own explanatory
   comments — and a GOOD migration was nearly declared failed. Hollow checks written in code get
   caught by mutation; **one running on someone else's machine cannot be, which is why it is the
   likeliest to survive.** For LIVE DATA there is no local before/after: say what each outcome
   means, **including what it returns if nothing happened.**
5. **A BOARD RULED?** A row in `design-rulings.md` / `coaching-rulings.md` in the **same
   commit** — **including a DON'T SHIP, a kill, or a RULED-but-not-built.** ⚠️ The guards fire on
   doctrine FILES, and a ruling can edit no file at all; `audit-docs.sh` § board rulings is what
   catches that.
6. **Coaching doctrine touched?** Principle § + numeric + invariant, in the same commit.

---

## Completion claim

Every "done" carries these, from `CLAUDE.md`:

1. **Count from the code**, never from memory or a previous session's number
2. **Name the noun actually worked on** — if the ask said X and the deliverable covers Y, say so *first*
3. **State the negative space** — one line: *what this does not prove*
4. **Falsify one check** — name which, and how
5. **Reconcile the adjacent register** — if another file tracks the same objects, report both counts

---

## Constraints

- **No code before the analysis block exists.**
- **No build without a named input.**
- **The consumer check covers app AND website.** Every time.
- **Route board questions in analysis**, not when a guard fires.
- `/zona-debug` runs **before** this skill, not inside it.
- `frontend-design` is **invoked by** this skill for UI, and also runs standalone.
- Anything discovered updates the backlog **now**.
- **Falsify every new check before calling it green.**
