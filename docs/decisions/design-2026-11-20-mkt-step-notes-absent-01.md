# Design Board — `MKT-STEP-NOTES-ABSENT-01`: published plan pages and step notes

**Date:** 2026-11-20 · **Board:** Design Board (Zhuo chair, Silvanto, Sierra, Wroblewski, Collins)
**Trigger:** backlog item, soft trigger (would change what a reader of `/plans/*` sees)
**Change as filed:** "a published plan page shows no step instructions at all"; `stepParts` returns
action + target and never `step.note`, so the step notes reach no published page.
**Tier:** n/a (marketing surface); step notes themselves are FREE (`feature-registry.md`, `SESSION-STEP-LEGIBILITY-01` row).

## Analysis, before any seat spoke

### The item's figures, re-derived

| Item says | Re-measured 2026-11-20 | Verdict |
|---|---|---|
| step notes "reach no published page" | **42 step notes render today**, on 9 of 10 pages, every note on each page's exemplar session (42 of 42 found in the server-rendered `SessionSteps` markup) | **FALSE since 2026-11-05.** The filing text was inherited from `SESSION-STEP-LEGIBILITY-01`'s 2026-10-06 "what this does not settle" line (*"the website shows no notes at all"*), which was true then. `SITE-SESSION-STEPS-01` mounted the app's `SessionSteps` as a one-exemplar band a month later, and `SessionSteps` renders `row.note` (`components/shared/SessionSteps.tsx:98`) |
| "the 85.7% coverage `SESSION-STEP-LEGIBILITY-01` delivered" | 85.7% (5,152 of 6,014) was the share of steps whose note was **never rendered before** that fix, not a coverage figure | Misquoted; harmless to the question |
| "amended its own budget 26.0 → 16.7 notes per plan" | 26.0 → 16.7 are **phone screens** per page (`SITE-SESSION-STEPS-01` re-sit), not notes, and the ruling was `SITE-SESSION-STEPS-01`'s, not `SESSION-STEP-LEGIBILITY-01`'s | Misquoted; the hazard it points at is real and is the settled ground below |
| "notes are named PAID-adjacent richness"; may want the SLT | Step notes are catalogue copy (no model call), registered **FREE**. The PAID line is `ai_coach_notes_new` (AI-written notes), which is not this | **No tier question exists**, so no SLT hand-off |

### What the week table carries today (the only place notes are absent)

Measured through the site's own entry point (`generateMarketingPlan`), all 10 published plans:

| | count |
|---|---|
| quality sessions in the week tables (9 race pages; the staged page has none) | **74** |
| …each already carrying one coaching sentence under its row (`coach_notes[0]`, the "how to" line) | **74 of 74** |
| derived steps in those sessions | **205** (matches `siteCeilingPace.test.ts`'s 205) |
| steps with a note | **184 (89.8%)**, **42 distinct strings**, mean **44.9 characters** |
| notes already rendered (the exemplar band) | **42** |
| notes a "note under every step" in the table would ADD | **142**, ~15.8 per page |

Method: `npx tsx scripts/board-evidence-mkt-step-notes-absent-01.ts` (read-only; renders `SessionSteps`
with `renderToStaticMarkup` exactly as `PlanPage.tsx`'s `SessionStructureBlock` props it) plus a
one-off count of `coach_notes[0]` over the same generated plans.

**Not measured:** the page height a 142-note table would add. No render was taken of that variant.
The 16.7-screen figure is the 2026-11-05 render of today's page and was not re-taken.

### Settled-ground scan

- **`SITE-SESSION-STEPS-01` re-sit (2026-11-05), SHIP WITH AMENDMENT (one exemplar)** — touched
  directly, and decisive. Built as "under every quality session" it measured **15.7 → 26.0 phone
  screens**; the amendment rendered **one** exemplar and kept *"the week table keeps the compact
  `MainSet` rows."* Sierra withdrew her own everywhere-prescription: *"the transfer happens on the
  FIRST one."* Notes under every table step are the same density on the same page.
- **`SESSION-STEP-LEGIBILITY-01`** — the note carries the step on the app's card; Wroblewski's
  binding *"nothing is truncated"*. Unaffected.
- **`SITE-ENGINE-EMDASH-01` (founder, 2026-11-05)** — a step note is a sentence; already in
  `engineCopyOnSite.test.ts`'s scope. Unaffected.
- Token layer: no token touched.

## The sitting

**🧭 Zhuo (chair).** The item asks a give-away question and a layout question. The measurement
answers the first out of existence: the notes are free, not AI, and are already on every page in
the one place this board decided they should be. What remains is *"should the table repeat them
142 more times,"* and that question was asked and answered on rendered evidence on 2026-11-05.
I want it recorded that the premise was a month stale when filed: its sentence was copied from a
2026-10-06 limits line.

**✋ Silvanto.** Nothing new to say beyond the November re-sit, which is the point. The table row
is 44px and already carries a how-to sentence; a note per step under it is the structure-card
inversion again, at lower amplitude: density, not disclosure. The exemplar is the disclosure.

**🎓 Sierra.** I gave this one up in November and the reason holds: a reader who has read one
session laid out with its notes can read the rest. The 42 distinct strings say the same thing
another way: across all nine plans there are only 42 things to say, and each page already says
its exemplar's share of them in full.

**📱 Wroblewski.** 142 extra lines of 44.9 characters at the 12–13px row type is new wrapping on
a phone that nobody has rendered. I would not rule a SHIP on that without a render, and I do not
need one to rule the other way, because the page that exists was rendered.

**🎪 Collins.** I'll take the other side for the record. The notes are the best writing on the
page (*"Hold back. This is the part…"*) and the table, where a reader actually lives, prints
`1600 m at 4:25–4:35 /km`. The voice is in the exemplar and the numbers are in the table, and the
thing a competitor cannot copy is the voice. If anything moves, I would move a note onto the
**work** step of each table session, not every step. I do not have a render to defend that with.

### ⚡ Recorded disagreement
Collins (one note per table session, on the work step, for voice) vs the room (the exemplar is the
voice; the table is for reading the arc). **Collins lost.** What would move the room: a render of
his narrower variant showing a phone-screen delta near the exemplar's +1.0, plus any evidence that
readers read the table row-by-row rather than scanning it (none exists; `SITE-SCROLL-DEPTH-01`
is still blocked on there being no site analytics).

### ⛔ Veto check
None. No palette or type change proposed.

## ⚖️ Ruling — DON'T SHIP (as filed), not permanent

The week table does **not** gain step notes. The premise was false on the day of filing: 42 step
notes already render, on every race page, through the app's own component, under a ruling made on
rendered evidence. **No SLT hand-off:** step notes are FREE catalogue copy; the PAID line is
`ai_coach_notes_new` and is not touched.

Not permanent: Collins' narrower variant (one note per table session, work step only) may return
**with a rendered phone-screen measurement**, which is the evidence this sitting did not have.

### 📦 Artifacts
None to build (DON'T SHIP). Register row below.

### ↗️ Routing
None. Not the Coaching Board (no prescription or claim changes), not the SLT (no tier question).

### 🚨 MUST/NEVER
No change proposed. Em dashes: notes are already in `engineCopyOnSite.test.ts`'s population.

### ⚠️ What this does not prove
- Nothing was rendered for the 142-note variant or for Collins' work-step variant; the DON'T SHIP
  rests on the false premise plus the 2026-11-05 render, not on a new one.
- **No check asserts the exemplar renders its notes.** `realComponents.test.ts` asserts the
  exemplar MOUNTS (and that there is one); the 42-of-42 here is a one-off count, so a change that
  dropped `row.note` from `SessionSteps` would leave the site's notes silently absent again
  (recorded as observed, not filed).
- Measured on generated plans at today's code; production pages revalidate daily and were not
  scraped.
