# Design Board — 2026-11-20. `PLAN-NOTE-HEAVIER-WEEK-PLACEMENT-01` — the encoding

**Trigger:** hard — it authors week-level text on `PlanCalendar` (which renders none today) and a week mark on Today.
**Change:** the ramp warning (`meta.load_residual_note`, week `meta.load_residual_week`) gets its ruled home, week N.
**Tier:** FREE for the mark; the Today coach line follows that card's existing paid/trial gate.
Seats: Zhuo (chair), Silvanto, Sierra, Wroblewski, Collins.

**What this sitting rules, and what it does not.** §6ak (2026-10-28) ruled the home; the 2026-11-14 sitting fixed the
sequence — *"the week-N surface first, the rank second. Next sitting rules the encoding — what the calendar row shows,
where in the week header it sits, what Today does when that week is current."* **This is that sitting. The plan-level
tile's rank is NOT ruled here** — it is ruled after this ships, on a measurement, per §6ak.

---

## 📐 Analysis — the stated figures re-derived

Evidence: `scripts/board-evidence-design-sittings-2026-11-20.ts`, `NODE_ENV=production`, cohortGrid **stride 131**
(304 plans generated, 13 threw and are counted, not dropped) + production read-only.

| 2026-11-14 says (stride 23, 1,728 plans) | Today (stride 131, 304 plans) |
|---|---|
| 322 carriers (18.6%) | **58 carriers (19.1%)** — same rate on a different sample |
| `load_residual_week` set on 322 of 322 | set on **58 of 58** (by construction: the field is stamped with the note) |
| — | week N's phase: **build 36 · peak 12 · base 10**; **0 deloads**; never taper or race week; median position **39%** through the plan |
| — | **13 of 58** carriers' week N is also the plan's tune-up week (see `TUNE-UP-CALLOUT-INERT-01`) |
| — | **Production: 1 of 43 live plans carries it; its week N is in the future** |

The shown/displacing table (322 / 176 / 136; 182 / 40 / 0) belongs to the **rank** decision and was not re-run: this
sitting does not rule the rank.

**What exists to build on (read, not assumed):**
- `PlanCalendar` **`WeekCard`** (Now / Next / an expanded Later week): eyebrow `W{n} · dates` + `· deload` suffix in
  `--mute` (WALKRUN-WEEK-LEGIBILITY-01, 2026-11-16), then `week.label`. **`WeekStripCard`** (Later): eyebrow with
  `· taper` / `· deload` / `· peak` suffixes. No week-level prose on either.
- **Today**: a week-identity eyebrow through `weekIdentity` (race › deload › taper › phase) with an exceptional-week mark
  (PHASE-ON-TODAY-01: deload named in ink, hairline `--s-recov`), and a rule-based week coach line
  `getPlanCoachNote()` — rendered **only under `hasPaidAccess`** (`TodayScreen.tsx:1901`), and superseded by the AI
  daily note when one exists.

**What the evidence cannot show:** how the marks read at 320pt with a long eyebrow (`W9 · 3–9 Mar · peak · heavier`);
nothing has run on a device.

---

## 🔍 Settled-ground scan

| Row | Bearing |
|---|---|
| **§6ak** | The home is ruled: week N's calendar row, and Today when week N is current. Not reopened |
| **2026-11-14 placement sitting** | Sequence: surface first, rank second. **Binds** — no rank change here |
| **WALKRUN-WEEK-LEGIBILITY-01** | The `· deload` muted suffix on BOTH week renderings is the existing encoding for "this week is unusual". Reused, nothing invented |
| **PHASE-ON-TODAY-01** | Exceptional week: **ink on the words, hue on the mark, no new hue**; Collins lost a per-phase colour on Silvanto's *"six session hues and four phase hues are already spent"* |
| **RACE-NOTES-INERT-01** (line ~413) | A week note survives only if it says something the session does not. **This one does** — no session says the week exceeds the ramp cap |
| **Coaching Board 2026-10-28** (via §6ak) | *"A warned plan tells the runner."* Binds every tier → the free runner must be told somewhere, not only in a paid card |
| §6ae (cap 3 / 180 words) | Untouched: nothing here is added to the plan-level stack |

---

## The board

**✋ Silvanto.** *"This is the horizon mistake being corrected, so do it the way the product already marks an unusual
week. On the arc — the strips — a muted suffix, exactly `· deload`'s treatment: the runner scanning ahead sees which week
is the heavy one. On the card they are about to live in, Now or Next, one line of guidance under the label. Not amber:
`--warn` is the same hex as `--s-quality` and a quality session sits on most of these weeks, so an amber line would read
as a session colour. Ink-2, the weight of `week.label`."* No veto.

**📱 Wroblewski.** *"The eyebrow is the risk. A Later strip can already read `W9 · dates · peak`; add a fourth item and
it wraps at 320. Rule: when both apply, the heavier mark replaces `· peak` — it is the more specific statement about
that week. And the line on the WeekCard only renders on Now and Next and an expanded Later week — the strips stay
one line."*

**🎓 Sierra.** *"The line must be the instruction, not the statistic. The plan tile says 'rises about 18%, above the
10%'; inside week 7's own card the runner needs 'keep the easy days easy, move the long run rather than shorten it'.
That is the part that makes them better at the week. I'd keep a short mention on the plan for now — and the rank
sitting decides that, not us."*

**🎪 Collins.** *"Is 'heavier week' a real distinction or a label? The engine makes it — a named field on one week of
19% of plans — so it earns a mark. But one mark, one word, the same word the plan tile uses. Not a third vocabulary."*

**🧭 Zhuo (chair) — Today.** *"Today's job is today's session; a week fact belongs there only as context, and the
context slots already exist. The eyebrow is the all-tier surface — `weekIdentity` names the week, ranked below race,
deload and taper, above phase. The coach line is paid by an existing gate, so it cannot be the only place a free runner
is told; the eyebrow can. And the AI note must be told the fact, as it was told the deload, or it will contradict the
line it replaces."* Success condition, stated first: **every warned plan shows the mark on week N in both calendar
renderings and on Today while N is current, for every tier — asserted, not sampled.**

## ⚡ Recorded disagreements
- **Collins (drop the plan tile once week N carries it) vs Sierra (keep a short mention)** — unchanged from §6ak; it is
  the rank sitting's, and whether the week-N surfaces discharge *"a warned plan tells the runner"* is the **Coaching
  Board's** call, not this board's.

## ⛔ Veto check
Silvanto: none. He named `--warn`/`--s-quality` identity as the reason for ink, not as a veto.

## ⚖️ Ruling — **SHIP WITH AMENDMENT (5)**

1. **Calendar, both renderings:** a muted eyebrow suffix on week N, the `· deload` treatment, in `WeekCard` **and**
   `WeekStripCard`. When it would sit beside `· peak`, it **replaces** it. Must not wrap at 320pt.
2. **WeekCard only (Now / Next / expanded Later):** one line under `week.label`, `--ink-2`, the **action** half of the
   note, never the percentages. No colour, no icon, no card, no chip.
3. **Today, week N current:** the identity goes through `weekIdentity` (one owner), ranked race › deload › taper ›
   **heavier** › phase, words in ink, **no new hue** on the hairline. The paid coach line (`getPlanCoachNote`) carries
   the action ahead of the phase lines; the AI daily note is told the fact.
4. **One vocabulary:** the mark's word is the plan tile's label (`Heavier week`), not a new term.
5. **Mockups to the founder before build, and seen on a device or the simulator before merge** (Wroblewski's 2026-11-14
   block, carried).

**Copy is the founder's** (👤): the suffix word if shortened, the WeekCard line and the Today line. Condition on the
words: a week-N line never says *"In week N…"* inside week N's own card.

## 📦 Required artifacts (land with the build)
1. **Pattern** — `ui-patterns.md` § 10b *Week card*: *an exceptional week is marked on both renderings; guidance renders
   only on a card the runner can act on.*
2. **Constant** — the mark label and the Today identity rank through `weekIdentity` / one exported label, never a literal.
3. **Mechanical check** — a markup arm over generated warned plans: week N carries the mark in both renderings and on
   Today, for a FREE tier; no other week carries it; the WeekCard line contains no `%`. Falsified by un-wiring each.
4. **Register row** — below.

## ↗️ Routing
👤 Founder (copy, mockups). 🏃 Coaching Board — **only for the later rank sitting**: whether the week-N surfaces
discharge its 2026-10-28 binding. No SLT question.

## ⚠️ What this ruling does not settle
- The plan-level tile's rank (deliberately; next sitting, on a measurement).
- How the eyebrow reads in the hand. Not felt.
- Production reach today is **1 plan**; the engine says ~19% of new plans.
