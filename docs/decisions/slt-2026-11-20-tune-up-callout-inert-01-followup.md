# SLT — 2026-11-20 (follow-up). `TUNE-UP-CALLOUT-INERT-01`: is one line worth the surface, and is any result-entry follow-up tier-gated?

**Sitting:** SLT, one sitting, the hand-off named by this morning's Design Board
(`design-2026-11-20-tune-up-callout-inert-01.md`, **settled ground, not re-ruled**: one `--ink-2` line on the tune-up
week's WeekCard while Now/Next/expanded Later; never on a strip or Today; the heavier-week line wins the slot).
**Copy is settled too** (`founder-2026-11-20-copy-approvals.md`): *"Optional: a parkrun this week. Run it as a check, not
a race."*, shipping only if this sitting approves the surface.
Seats: Sutherland, Fried, Hutchinson (coaching chair), Wood, Zhuo (design chair).
⚠️ **Traynor's commercial seat is stood down and revenue is still zero, so nobody prices churn or conversion here.**
Stated, not silent.

**Registry check:** no shipped row renders the tune-up. `feature-registry.md` mentions `tune_up_callout` only as a
schema field (AI-DEPTH-07) and as the sibling left open by `RACE-NOTES-INERT-01`. Not a rebuild.

---

## 📐 Evidence (re-derived today, read-only)

Command: `NODE_ENV=production npx tsx scripts/board-evidence-tune-up-callout-inert-01-followup.ts 131 both`
(production SELECTs; tier by `getUserTier`, the route's own resolver) plus a one-off read of `v_metric_users`.

| Figure | Item / morning note | Today |
|---|---|---|
| Live plans carrying the callout | 33 of 43 | **33 of 43** ✅ |
| Callout week still ahead | 20 ahead, 13 past | **20 future, 13 past** ✅ |
| Owner tier, all 33 carriers | not measured | **16 paid · 16 free · 1 trial** (all accounts; includes internal) |
| Owner tier, the 20 whose week is still ahead | not measured | **16 paid · 3 free · 1 trial** |
| Metric users (`v_metric_users`, excludes internal/admin) | not measured | **22 carriers, 18 with the week still ahead** |
| Engine reach | 304 of 304 (stride 131) | **304 of 304** ✅ — every plan ≥ `TUNE_UP_MIN_PLAN_WEEKS` |

**What exists for a result today (read from source, not run on a device):**
- **The run itself lands for every tier.** `/api/health/ingest` stores the row for all tiers and gates only the
  analysis (`activity_intelligence`, PAID) — `app/api/health/ingest/route.ts:118–119`.
- **Rewriting paces from a result is PAID.** `BenchmarkUpdateScreen` → `/api/recalibrate-zones`, gated
  `dynamic_reshape_r20` (`route.ts:39–41`), per ADR-014. Whether a FREE runner may apply a result once is
  **`TT-FREE-BENCHMARK-01`, deadlocked 2026-09-20 (Fried (a) vs Wood (b))** — settled ground, not reopened here.

**What the evidence cannot show:** whether anyone runs the parkrun; whether a runner who sees the line behaves
differently from one who does not (no outcome data); anything in the hand. Nothing has run on a device.

---

## 🧠 Rory Sutherland
*"The real problem §32 names is not 'the runner lacks a benchmark'. It is the runner who sees a parkrun on Saturday and
races it, off their own bat, in the wrong week. You do not stop that with a rule; you stop it by giving them permission
in the right week, with a frame. One line that says 'yes, this week, as a check' is cheaper than any prohibition we
could write. I'd have wanted it to ask for the result back — but the run lands in the log anyway, so the loop already
closes without us adding a form."*

## 📦 Jason Fried
*"Two options cost about the same: render one line on a card that already exists, or retire a field and amend a
principle and an invariant to admit nobody reads them. Thirty-three plans carry it and every new long plan will. Build
the line. What I will not fund is a follow-up: a result form, a CTA, an 'enter your time' chip. That is a second feature
hiding inside a sentence. The line offers, the runner decides, done."*

## 🏃 Alex Hutchinson
*"Two things, and the second matters more. First, where the engine stamps it is the Coaching Board's: the morning sat
noted thirteen of fifty-eight warned plans put the offer in the warned week, and I re-ran it — 13 of 58 again, and on
18 of 304 plans the tune-up week carries a ramp violation. I carry that down; I will not improvise it here. Second, on
result entry: the approved line says **run it as a check, not a race**. A deliberately sub-maximal effort is the wrong
input to a VDOT recalibration — it would read low and slow every forward pace. So wiring this line to 'Update paces' is
not a tier question first, it is a correctness one, and the answer is no. If anyone wants to propose it, it goes to my
board before it comes back here."*

## 🔬 Wendy Wood
*"I asked this of the time trial and I ask it here: what does the runner learn when they act on it? If the line implied
the app will use their result, a free runner who runs it and watches nothing move learns that the app does not respond
to them — that was my TT-FREE argument and it binds here. The approved copy promises nothing back, and it arrives as a
context cue on the week they are in, which is the only kind of nudge I trust. Build it with no follow-up. With a
follow-up I would vote to kill."*

## 🧭 Julie Zhuo
*"The design is ruled; I am not re-ruling it. The commercial point is sequencing: this line and the heavier-week line
share one slot and one precedence constant. Building them separately builds the slot twice. The success condition
stands as the Design Board wrote it: on a long plan, visible on its week while Now or Next, silent everywhere else.
Tier is FREE — it is rule-engine copy on the plan, and the heavier-week line in the same slot is FREE."*

---

## ⚡ Conflicts
- **Sutherland (ask for the result back) vs Fried + Wood (no follow-up).** Resolved by evidence, not synthesis: the run
  already lands in the log for every tier, so no form is needed for the loop to close, and Hutchinson's correctness
  point removes the only thing a form would feed. Sutherland withdrew.
- No other genuine split.

## ✅ Recommendation — **BUILD (FREE), the line only; NO result-entry follow-up**
1. **Worth the surface: yes.** One line, the Design Board's placement and encoding, the founder's copy. **FREE** —
   rule-engine copy, gate richness never access.
2. **Result-entry follow-up: none is built under this item.** Not a tier call first: the line asks for a *check, not a
   race*, which is not a valid recalibration input (Hutchinson). The existing paths are unchanged — the run lands for
   every tier; rewriting paces stays PAID (ADR-014, `dynamic_reshape_r20`); a free one-time apply remains
   `TT-FREE-BENCHMARK-01`'s open deadlock. The line carries no CTA, chip or link.
3. **Sequencing:** build in the same change as `PLAN-NOTE-HEAVIER-WEEK-PLACEMENT-01` (one slot, one precedence
   constant), or after it — never before it.
4. **Gated on the Coaching Board** for which week the engine stamps (13 of 58 warned plans; 18 of 304 tune-up weeks
   ramp-flagged). Build waits for that ruling.

## ↗️ Hand-offs
- 🏃 **Coaching Board** — question (a) only: should the engine stamp a tune-up on a ramp-flagged week. Question (b)
  (amend §32 / the invariant if the surface is declined) **is not triggered**: the surface is approved. ⚠️ §32's
  sentence *"UI consumers render this"* stays false until the build ships.

## 🚨 MUST/NEVER check
- No modal, no badge, no streak, no gamification. ✅
- Copy from `founder-2026-11-20-copy-approvals.md`, no em dash. ✅
- No new paid gate, so `lib/marketing/pricing.test.ts` is untouched. ✅
- No AI, so no AIMark. ✅

## ⚠️ Risks to existing features
- `PlanCalendar` WeekCard: shares the guidance slot with the heavier-week line (precedence already ruled).
- `INV-PLAN-TUNE-UP-CALLOUT`: unchanged by this ruling; the Coaching Board's answer to (a) may amend it.
- No schema change, no migration, no write path.

## ⚠️ What this does not prove
- Not that runners will do the tune-up or that it reduces self-scheduled racing. No outcome data exists.
- The tier split counts all accounts (16 paid includes internal/admin); the metric-user figure is the honest one (22).
- The 13 live plans whose tune-up week has passed get nothing from a build.
- Nothing seen on a device.
