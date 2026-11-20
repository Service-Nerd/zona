# Design Board — 2026-11-20. `PLAN-NOTE-MULTIWEEK-RAMP-01` — how more than one heavier week reads

**Trigger:** hard. It amends a ruling in this board's own register (`PLAN-NOTE-HEAVIER-WEEK-PLACEMENT-01`, this
morning) on a hand-off from the Coaching Board.
**Change:** the heavier-week encoding ruled this morning for one week (`meta.load_residual_week`) is applied to every
stamped week (`meta.load_residual_weeks: { week, scope }[]`), each with its own scope.
**Tier:** FREE for the mark and the WeekCard line; the Today coach line keeps its existing paid/trial gate.
Seats: Zhuo (chair), Silvanto, Sierra, Wroblewski, Collins.

**The hand-off, verbatim** (`docs/decisions/coaching-2026-11-20-plan-note-multiweek-ramp-01.md`): *"amend its
artifact 3 from 'no other week carries it' to 'exactly the stamped weeks carry it', and rule how more than one mark
reads on the strip and on Today."* The Coaching Board ruled **CORRECT**: every warned week is declared on that week,
each with its own scope, no cap on the count. **That meaning is not reopened here**; this sitting rules the encoding.

---

## 📐 Analysis — the figures re-derived, and the ones the encoding needs

Evidence: `scripts/board-evidence-design-plan-note-multiweek-ramp-01.ts` (read-only, in memory, no production read).
`NODE_ENV=production npx tsx scripts/board-evidence-design-plan-note-multiweek-ramp-01.ts 23 [achilles|knee]`.
cohortGrid stride 23, tier free, 1,728 plans, 76 threw (counted, not dropped). It simulates the Coaching Board's
stamp exactly as ruled: distinct weeks a `RAMP_RESIDUAL_CODES` check warns on (`ramp`, `week > 0`), scope
`non_long` where that week carries `INV-PLAN-INJURY-CAP-DELIVERED`.

| | Coaching Board said (same sample) | **healthy** | `achilles` | `knee` |
|---|---|---|---|---|
| warned plans | 322 / 444 / 258 | **322** | **444** | **258** |
| marks per warned plan | 1: 228 · 2: 84 · 3: 10 (healthy) | **1: 228 · 2: 84 · 3: 10** | 1: 312 · 2: 103 · 3: 25 · **4+: 4** | 1: 221 · 2: 30 · 3: 7 |
| stamped weeks (per warned plan) | 426 / 322 (McMillan's 1.3) | **426 (1.32)** | 610 (1.37) | 302 (1.17) |
| plans with two stamped weeks **back to back** (Now and Next both carry the line) | not measured | **6 (1.9%)** | 20 (4.5%), two of them a run of **4** | 10 (3.9%) |
| plans whose stamped weeks carry **both scopes** | not measured | **0** | **66 (14.9%)** | **25 (9.7%)** |
| stamped week is a **peak** week (suffix replaces `· peak`) | — | 89 of 426 | 178 of 610 | 139 of 302 |
| stamped week is also the **tune-up** week | 13 of 58 (week N only, stride 131) | **81 of 426** | 118 of 610 | 43 of 302 |
| stamped week is a deload, taper, race week, or the plan's first week | 0 deloads (morning) | **0** | **0** | **0** |

**What moved:** nothing the Coaching Board stated; its 228/84/10 and 1.3 reproduce exactly. **Three facts are new and
each binds the encoding:**
1. **Scope is per week, not per plan, and the healthy grid cannot show it.** 0 mixed-scope plans on cohortGrid (it does
   not vary injury) against 14.9% on Achilles and 9.7% on knee. A check run only on the healthy grid cannot falsify
   "stamp the plan's scope on every week".
2. **Back-to-back marks are rare but real:** 1.9–4.5% of warned plans put a line on both the Now and Next cards.
3. **The tune-up collision is per stamped week, not per week N:** 81 of 426 stamped weeks also carry
   `tune_up_callout`. This morning's `TUNE-UP-CALLOUT-INERT-01` precedence names *"a `load_residual_week` week"*, which
   would let the tune-up line render on the other 2+ stamped weeks of a multi-week plan. (The Coaching Board's §32
   Am.1 removes the collision in the engine; until that builds, the precedence must cover every stamped week.)

**Production:** the stamp does not exist yet. The Coaching Board measured 1 of 43 live plans carrying
`load_residual_week` (week N in the future), and the warned-week set is not stored, so multi-week production reach is
**not measurable** and was not re-run here.

**What the evidence cannot show:** how two or three muted suffixes read in a Later list at 320pt, or two guidance
lines on consecutive cards, in the hand. Nothing has run on a device. Foundation-block plans and multi-injury
histories are not reached (the grid pins `plan_start`; overlays are single).

---

## 🔍 Settled-ground scan

| Row | Bearing |
|---|---|
| **`PLAN-NOTE-HEAVIER-WEEK-PLACEMENT-01`** (this morning, SHIP WITH AMENDMENT (5)) | **Amended, not reversed.** Surfaces, treatment, `weekIdentity` rank, one vocabulary and the mockup/device conditions all stand. Artifact 3's *"no other week carries it"* is replaced. Its *"week N"* reads as *"each stamped week"* throughout |
| **`TUNE-UP-CALLOUT-INERT-01`** (this morning) | **Amended in one clause**: the precedence and its check name *every stamped week*, not *"a `load_residual_week` week"*. Still conditional on the SLT |
| **§6ak / 2026-11-14 sequence** | The plan-tile rank stays deferred. Not touched |
| **WALKRUN-WEEK-LEGIBILITY-01** | The muted suffix is a week's identity and already renders on **past** strips (`· deload` on a past `WeekStripCard`). The heavier mark follows it |
| **PHASE-ON-TODAY-01** | Ink on the words, no new hue. Only one week is current, so Today never shows more than one mark: unchanged |
| **RACE-NOTES-INERT-01** | Each stamped week's line says something its sessions do not. Passes per week |
| Coaching Board, this afternoon (multi-week) | Binds: every warned week declared, own scope, no cap; the plan tile *"must not read as the only one"* (words 👤) |
| Token layer | No token added or changed. `--mute` for the suffix, `--ink-2` for the line, as ruled |

---

## The board

**📱 Wroblewski.** *"The question I came in with was a Later list striped with marks. Measured, the healthy maximum is
three, the Achilles tail is four on four plans in 444, and a deload suffix already appears on 13% of weeks without
anyone calling it noise. Each strip carries its own suffix; no grouping, no count, no 'and 2 more'. The two-line case is
the one to look at: on 1.9 to 4.5% of plans the Now and the Next card both carry a sentence. That is acceptable because
they are two cards about two weeks, but it is the state the mockup must show, at 320, with the longest eyebrow, and on
the simulator before merge."*

**🎓 Sierra.** *"Each line is that week's instruction, so it repeats when the week repeats the condition. Do not shorten
the Next card's line to dodge the repetition: the Next card is where the runner plans the week. And the scope must be
the week's own: on fifteen percent of Achilles plans one heavy week is the injury ceiling and the other is ordinary
growth. Telling the runner the injury set a ceiling on a week where it didn't is a false statement, not a style
choice."*

**✋ Silvanto.** *"Nothing changes in the treatment. One mark per week, the same mark, muted, on both renderings, past
and future, because it is the week's identity like `· deload`, and the guidance line only where the runner can still
act: Now, Next, an expanded Later week. A past heavy week keeps its word and loses its sentence. No count, no summary
chip, no new colour."* No veto.

**🎪 Collins.** *"The taxonomy question, since it is my seat: does 'heavier' still distinguish if it can sit on four
weeks? Yes. 1.32 marked weeks per warned plan, on 19% of plans, never on a deload, taper or race week. It is rarer than
deload. What I will not accept is two readings of the same word: the tile today says 'Week 9 rises about 28%' while the
calendar marks weeks 4, 9 and 13. Either the tile admits the others or the calendar looks like it disagrees with it.
The Coaching Board already said so; the words are the founder's, and the mockup must show the tile next to a three-mark
calendar so he sees the disagreement before he writes them."*

**🧭 Zhuo (chair).** *"Success condition, stated first: for every warned plan, at every tier, the set of weeks rendering
the mark equals the set stamped, each line carries its week's scope, and Today shows the mark whenever a stamped week is
current. Asserted on an injury overlay as well as the healthy grid, because the healthy grid has zero mixed-scope plans
and cannot make the scope arm go red. On the owner: three surfaces now ask 'is this week stamped, and with what scope'.
One accessor answers it from `load_residual_weeks`; `weekIdentity`, both calendar renderings and the coach line read it.
Nobody re-derives a week from `load_residual_week`, and nobody reads scope off the note's text. The one live plan
carrying only the old field keeps its plan tile and gets no week mark, which is the live-plan policy and no regression:
the week mark has never shipped."*

## ⚡ Recorded disagreements

None on the ruling. Wroblewski's two-line state is a mockup condition, not a dissent.

## ⛔ Veto check

Silvanto: none. No palette or type change.

## ⚖️ Ruling — **SHIP WITH AMENDMENT (6)** · NOT BUILT

Amends `PLAN-NOTE-HEAVIER-WEEK-PLACEMENT-01` (this morning). Everything not named here stands.

1. **Every stamped week carries its own mark.** The muted eyebrow suffix on each week in `meta.load_residual_weeks`,
   in `WeekCard` **and** `WeekStripCard`, **past and future** (it is the week's identity, as `· deload` is). Replaces
   `· peak` on that week. No grouping, no count, no summary chip, no cap.
2. **The guidance line is per week and per scope.** One `--ink-2` line on each stamped week's `WeekCard` while it is
   Now, Next or an expanded Later week; never on a strip, never on a past week. The sentence is chosen by **that
   week's** scope from the approved copy (healthy / injury, `founder-2026-11-20-copy-approvals.md`). When Now and Next
   are both stamped, both carry their line; no shortening.
3. **Today:** unchanged in form. The mark appears whenever the current week is stamped (any of them), through
   `weekIdentity`, ranked race › deload › taper › heavier › phase. The paid coach line uses the current week's scope
   sentence; the AI daily note is told the current week's fact and scope.
4. **One owner for the stamp.** A single accessor returns `{ scope } | null` for a week from `load_residual_weeks`. Every
   surface reads it. No surface reads `load_residual_week` to place a mark, and no surface infers scope from the note
   string. Stored plans with only `load_residual_week` get no week mark (live-plan policy; their tile is unchanged).
5. **Tune-up precedence covers every stamped week** (amends `TUNE-UP-CALLOUT-INERT-01` row 3 and its check): the
   tune-up line never renders on any stamped week. Moot once §32 Am.1 builds; required until it does.
6. **Mockups to the founder before build** (the list below), **simulator or device before merge**. One set covers this
   ruling and the morning's; they are not yet produced.

**Plan-level tile:** rank still **NOT RULED** (§6ak, after this ships, on a measurement). Its sentence must not read as
the only heavy week when the calendar marks more than one (Coaching Board, binding); the words are 👤 the founder's and
no multi-week tile sentence has been approved yet.

## 🖼️ Mockups required before build — exact screens and states

Each at **320pt and 390pt**, real eyebrow strings (longest date range in the plan), approved copy, no placeholder text.

| # | Screen | State | What it must show |
|---|---|---|---|
| M1 | Plan | Healthy plan, **3 stamped weeks**, none current; one stamped week is a **peak** week | Next card stamped (eyebrow suffix + healthy line); two Later strips with the suffix, one replacing `· peak`; the plan tile at today's rank **with its current single-week sentence**, so the founder sees the disagreement Collins named |
| M2 | Plan | Achilles plan, **mixed scope**, Now **and** Next both stamped (back to back) | Now card with the **injury-scope** line, Next card with the **healthy** line, both visible in one scroll; the two-line state Wroblewski asked for |
| M3 | Plan | A stamped Later week **expanded** | The expanded WeekCard with its line; the collapsed strips around it with suffix only |
| M4 | Plan | A stamped week in the **past** (expanded past strip) | Suffix present, **no** line |
| M5 | Plan | A stamped week that is also the **tune-up** week | Heavier line only; no tune-up line |
| M6 | Today | Stamped week current, **FREE** tier, injury scope | Eyebrow `Heavier week` in ink, phase hairline with no new hue; no coach line |
| M7 | Today | Same week, **PAID/trial** tier | Coach line with the injury-scope sentence ahead of the phase lines |
| M8 | Plan | **Single-mark** plan (control) | Identical to the morning ruling; confirms nothing changed for the 70% case |

## 📦 Required artifacts (land with the build, in one commit with the morning's)

1. **Pattern:** `ui-patterns.md` § 10b *Week card*: *"an exceptional week is marked on every week it applies to, on
   both renderings, past and future; guidance renders only on a card the runner can act on, in that week's own
   scope; a lower-precedence week line (tune-up) yields on any marked week."*
2. **Constant / owner:** the per-week stamp accessor (in `lib/plan/loadResidualNote.ts`, beside the producer) and the
   single exported label feeding `weekIdentity`. No literal in a component.
3. **Mechanical check** (replaces the morning's artifact 3): a markup arm over generated warned plans, FREE tier, on
   the **healthy grid and an Achilles overlay**: the set of weeks rendering the mark **equals** the stamped set in both
   renderings; each WeekCard line's sentence matches its week's scope; Today shows the mark for each stamped week when
   current; no `%` in any line; no tune-up line on a stamped week. **Falsified three ways:** render from
   `load_residual_week` only (red on the 29% multi-week plans), apply one scope to every week (red only on the Achilles
   overlay: 66 mixed-scope plans; the healthy grid has 0), drop the tune-up precedence (red on 81 healthy stamped weeks).
4. **Register row:** below.

## ↗️ Routing

👤 **Founder:** the mockups (M1–M8), and the plan-tile sentence for a multi-week plan (Coaching Board's binding). 💼
**SLT:** unchanged (tune-up surface already handed off). 🏃 **Coaching Board:** nothing new; the rank sitting's question
stands as handed off this morning.

## 🚨 MUST/NEVER check

No colour, no new token, no icon, no modal, no em dash in the lines (approved copy carries none), no `%` on week
surfaces. FREE runner told on every stamped week through the calendar and Today eyebrow.

## ⚠️ What this ruling does not settle

- The plan-tile rank and its multi-week sentence.
- How three or four suffixes and two consecutive lines read in the hand. Not felt.
- Production reach: not measurable until the stamp ships. Rates are cohortGrid stride 23 plus two single-injury
  overlays, not a runner population; foundation-block and multi-injury plans not reached.
