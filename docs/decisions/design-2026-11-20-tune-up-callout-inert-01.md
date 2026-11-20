# Design Board — 2026-11-20. `TUNE-UP-CALLOUT-INERT-01` — where an optional mid-build suggestion sits

**Trigger:** hard — giving `week.tune_up_callout` a reader authors week-level text on `PlanCalendar`, which renders none.
Filed 🧭 DESIGN BOARD → 💼 SLT. **This sitting rules the design half only; whether it is worth the surface is the SLT's,
handed off, not sat.**
**Change:** decide where (or whether) the engine's tune-up race suggestion reaches the runner.
**Tier:** not ruled (SLT).
Seats: Zhuo (chair), Silvanto, Sierra, Wroblewski, Collins.

---

## 📐 Analysis — the stated figures re-derived

Evidence: `scripts/board-evidence-design-sittings-2026-11-20.ts` (production read-only + cohortGrid stride 131,
`NODE_ENV=production`, 304 plans), and `grep -rn tune_up_callout app components lib` (2026-11-20).

| Item says | Today |
|---|---|
| *"33 of 43 live plans carry it"* | **33 of 43** ✅. Of the 33, the callout week is **still ahead on 20**, already past on 13 |
| *"0 readers in `app/`, `components/` or the marketing site"* | **0** ✅ — the only hits are `lib/plan/schema.ts`, `invariants.ts` (`INV-PLAN-TUNE-UP-CALLOUT`), `ruleEngine.ts:7838` (the stamp), `generationConfig.ts` (a comment) and a harness fixture. The site lives under `app/`, so it is covered |
| stamped on the latest non-deload build week of a plan ≥ `TUNE_UP_MIN_PLAN_WEEKS` | engine: **304 of 304** generated plans carry it — near-universal on any plan long enough |
| — | 🔴 **13 of 58** engine plans that carry the ramp warning (`load_residual_week`) place the tune-up **in that same week**. Live: 1 plan carries both, not the same week |

**What the evidence cannot show:** whether runners would do a tune-up; whether a result could be fed back (Update Paces
exists; whether its use is tier-gated is the SLT's question). No device.

---

## 🔍 Settled-ground scan

| Row | Bearing |
|---|---|
| **RACE-NOTES-INERT-01** (line ~413) | A week note was **not** placed because it said a vaguer version of what the session says. 🔑 The test it set: *"it must then say something the session does not."* **This passes** — nothing else in the product suggests a tune-up race (the item says so; the grep agrees) |
| **One job per screen** (`screen-architecture.md`) | Plan owns *"this week's framing"*; Today is *"one screen, one session, one day"* — a suggestion to race this week is not today's session |
| **Calm guidance, not alerts; empty means calm** (`ux-principles.md`, CLAUDE.md UI Principles) | An optional suggestion must not look like an instruction or a warning |
| **`PLAN-NOTE-HEAVIER-WEEK-PLACEMENT-01`** (ruled today, `design-2026-11-20-plan-note-heavier-week-placement-01.md`) | Authors the WeekCard's one guidance line. **The same slot** is the only candidate here, so the two need a precedence |
| "Wow" as ornament — permanent kill | No badge, chip, trophy or race icon |

---

## The board

**🎓 Sierra.** *"A tune-up race is one of the few things in a plan that teaches the runner something about themselves
the app cannot: what race effort actually feels like, before race day. That is perceptual expertise. I want it to
survive — as an offer, not a task."*

**🎪 Collins.** *"Then admit what it is: a stamp. 304 of 304 plans. It is not a decision about this runner, it is a
rule that fires on every long plan. That is fine for an offer; it is not fine dressed as coaching insight. One line, plain,
on the week it applies to. And the copy is contradictory as written — 'drop a parkrun PB' then 'not a race effort'."*

**✋ Silvanto.** *"Horizon again: an offer for one week belongs on that week, and only when the runner can act on it — Now
or Next. Not on the strips: a warning travels to the arc, a suggestion does not. `--ink-2`, the same line the heavier
week uses, and never both on one card."*

**📱 Wroblewski.** *"One slot, so precedence. When the ramp warning and the tune-up land on the same week — thirteen in
fifty-eight on the engine — the warning wins and the offer does not render. Suggesting a race effort in the week the
engine flagged as over the ramp is a coaching contradiction I would not want to draw, and it is not mine to resolve."*

**🧭 Zhuo (chair).** *"Does an optional suggestion survive restraint at all? It does if it is the runner's to ignore and
the screen is no louder for it. One line, on a card already present, nowhere else, no Today. Success condition before
design: on a long plan, the offer is visible on its week while that week is Now or Next, and silent everywhere else.
Whether one line is worth building is the SLT's — and if they say no, the invariant that claims it is surfaced has to say
so, because a rule recorded as enforced on a field nobody reads is worse than no rule."*

## ⚡ Recorded disagreements
None on placement. Collins' "it is a stamp, not a decision" is recorded as a condition on the copy, not a dissent.

## ⛔ Veto check
Silvanto: none.

## ⚖️ Ruling — **SHIP WITH AMENDMENT (4), conditional on the SLT**

1. **Placement:** one line on the **WeekCard** of the tune-up week, only while that week is Now, Next or an expanded
   Later week. Not on `WeekStripCard`, not on Today, not in the plan-level rationale stack.
2. **Encoding:** the WeekCard guidance-line treatment ruled for the heavier week (`--ink-2`, no colour, icon, chip or
   card). It reads as an offer.
3. **Precedence:** the heavier-week line wins the slot; when both fall on one week the tune-up does not render.
   Whether the engine should stamp a tune-up on a ramp-flagged week at all → 🏃 Coaching Board (§32), handed off.
4. **Copy (👤 founder):** rewritten — the current string contradicts itself (*"PB"* vs *"not a race effort"*). Condition:
   it offers, never instructs.

**If the SLT declines the surface:** the field is retired or left unread **and** `INV-PLAN-TUNE-UP-CALLOUT` / §32's claim
are amended to say it is not surfaced (🏃 Coaching Board) — never left asserting an enforcement that reaches nobody.

## 📦 Required artifacts (land with the build, if the SLT approves)
1. **Pattern** — `ui-patterns.md` § 10b *Week card*: the guidance line, its precedence (warning › offer), and *offers do
   not travel to the strips*.
2. **Constant** — the precedence as one exported order beside the week-line owner; no literal in a component.
3. **Mechanical check** — markup arm over generated plans: the callout renders on its WeekCard when Now/Next, never on a
   strip or on Today, and never on a week carrying `load_residual_week`. Falsified by rendering it on the strip and by
   dropping the precedence.
4. **Register row** — below.

## ↗️ Routing
💼 **SLT — hand-off, not sat:** is one line worth the surface, and is any result-entry follow-up gated. 🏃 **Coaching
Board** — the 13-in-58 same-week coincidence, and §32's enforcement claim if the SLT declines. 👤 **Founder** — copy.

## ⚠️ What this ruling does not settle
- Worth-the-surface (SLT). Whether a runner can do anything with the result in-app.
- The 13 live plans whose callout week has already passed get nothing.
- Not seen on a device.
