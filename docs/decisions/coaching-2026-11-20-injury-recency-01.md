# Coaching Board — 2026-11-20 — `INJURY-RECENCY-01`: what each recency answer DOES, per injury

Seats: Hutchinson (chair), Seiler, McMillan, Willy, Sims. Blagrove silent (hip's strength-side effect is
`STRENGTH-ENGINE-01`'s and not on this agenda).

**Trigger:** soft — what a recency answer changes is prescription. The Design Board half (the control) is **not**
run here; it is the hand-off.
**The deliverable the Design Board sent back (2026-11-16):** *a per-injury mapping from the three buckets (current /
within a year / longer ago) to the caps each one governs — four rules, not one shared rule (Willy) — measured the way
the chip measurement was.* Plus the question that sitting found: **do the four include Achilles?**

**The board's constraint, unchanged:** it does not invent caps. So a bucket may only map onto an engine state that
**already exists** — every candidate below is a *substitution* of the chip the wizard sends, which keeps the
measurement read-only and the numbers ratified.

---

## 📐 Analysis, before any seat spoke

### Which rules each chip actually reaches (read from code)

| chip as sent | rules that read it |
|---|---|
| `Knee`, `Shin splints` | §12/§2 injury volume cap (`hasVolumeCappedInjuryHistory`, `INJURY_WEEKLY_INCREASE_CAP_PCT` 5), §90 delivered levers (`DELIVERED_CAP_INJURIES`), beginner hill-stride swap (`HILL_RESTRICTING_INJURIES`), plus every *any-injury* gate |
| `Back` | §9 Am. 3 long-run time cap (`LONG_RUN_CAP_MINUTES_BY_INJURY.back` 120), plus any-injury gates |
| `Plantar fasciitis` | long-run time cap (`plantar_fasciitis` 120), hill swap, delivered cap, plus any-injury gates |
| `Achilles` | hill swap, delivered cap, plus any-injury gates |
| `Hip` | **any-injury gates only** (e.g. ADR-021's early-onset exclusion `ruleEngine.ts:7308`, §47's step-back pass `:5115`, `:4843`) |

That last row is what makes per-cap measurement possible without code: **`Back → Hip`** lifts back's long-run cap
and keeps every any-injury gate; **`Plantar fasciitis → Calf`** lifts plantar's long-run cap and keeps its hill swap
and delivered cap (`calf` is in both lists and not in the long-run table).

### The table, re-derived on today's engine (`npx tsx scripts/board-evidence-injury-recency-01.ts`)

Marathon, plan start pinned 2026-12-07, longest recent run = 0.45 × weekly. Peak = delivered weekly km; LR = longest
long run; hill = beginner hill-stride weeks.

| case | none | Knee / Shin | Back | Plantar | Achilles | Hip | Back→Hip | Plantar→Calf |
|---|---|---|---|---|---|---|---|---|
| 20 km/wk · intermediate | 62 · 29.5 | **38 · 22.5** | 52 · **17** | 52 · **17** | = none | = none | = none | = none |
| 20 km/wk · beginner | 52 · 26 · 6 hill | **33 · 19 · 0** | 51 · **15** · 6 | 51 · **15** · **0** | **0 hill** | = none | = none | 52 · 26 · **0** |
| 40 km/wk · intermediate | 66 · 29.5 | = none | 58 · **17** | 58 · **17** | = none | = none | = none | = none |
| 40 km/wk · beginner | 53 · 26 · 6 hill | 52 · 26 · **0** | 51 · **15** · 6 | 51 · **15** · **0** | **0 hill** | = none | = none | 53 · 26 · **0** |

Half marathon: the same shape at smaller magnitudes (Knee/Shin peak 47→30 at 20 km/wk intermediate; Back/Plantar LR
15.5→14.5 beginner; Achilles/Plantar/Knee/Shin remove 7 hill weeks for beginners). Full output in the script.

**Against the 2026-11-14 table, both figures:** Knee/Shin at marathon 20 km/wk intermediate, item *peak 53→32, LR
25.5→19*, today **62→38, 29.5→22.5** (different longest-run input; direction and proportion hold). Back/Plantar, item
*LR 25.5→14.5*, today **29.5→17**. 🔴 **The item's *"at 40 km/week Back and Plantar additionally flip build →
maintenance"* does NOT reproduce** in either 40 km/wk case measured here (all `build`). The inputs differ (longest
run), so this is *not reproduced*, not *false*.

**The substitution result is the finding:** in every cell measured, `Back→Hip` and `Plantar→Calf`'s long-run arm are
**identical to `none`** — the any-injury gates move nothing in these cells. So "lift the long-run cap" and "remove the
chip" coincide here; they would diverge only for an ADR-021-ready runner (not in this table — *not measured*).

**Live** (production, 43 plans, 36 with `generator_input`, **15 with any chip**): knee 6 · plantar fasciitis 4 · hip 4 ·
achilles 3 · shin splints 3 · back 1 — **identical to 2026-11-14**.

**Settled-ground scan:** SLT 2026-10-28 (*per injury, with a measurement; if nothing changes, it is not collected*;
FREE; per-chip toggle on the existing step). Coaching 2026-11-14 (CORRECT: collect, three buckets; **Willy, binding:
absent or skipped defaults to CURRENT**; Hip → removal by 2026-12-12 unless it earns an effect). Design 2026-11-16
(cannot rule; four may be five). §9 Am. 3 / `LONG-RUN-CAP-INJURY-VALUE-01` (the 120-min cap stays ratified as is;
*"back and plantar are still treated identically"*). §12, §90, §28 Am. 1 / Am. 2 (hill swap).

**What the evidence can and cannot show.** It shows exactly what each existing cap does per chip. It cannot show any
outcome by recency: Zonna holds no injury outcomes, and the literature supporting *previous injury* as a risk factor
mostly defines it within the preceding 12 months, with much less on older history.

---

## 🔍 Conflict scan
Touches **§12/§2** (knee/shin volume cap), **§9 Am. 3** (back/plantar long-run cap — lifting it for one bucket does not
change its value, so `LONG-RUN-CAP-INJURY-VALUE-01`'s *"stays ratified as is"* holds), **§28 Am. 2** (hill swap),
**§90** (delivered cap), **ADR-021** (any-injury exclusion — kept in every mapping). The 2026-11-14 ruling's
*"for four chips"* is **narrowed** below; that is recorded as an amendment of that ruling, not a contradiction.

---

### 🏃 Alex Hutchinson (Chair)
*"The evidence base for 'previous injury predicts injury' is real and it is mostly a twelve-month window. So 'within a
year' is current. That is not a cap we invented, it is the definition the literature uses. Beyond a year the evidence
thins, and the question becomes per tissue, which is what Willy asked for."*

### 🩹 Rich Willy
*"Per tissue, then. **Shin**: a bone-stress history is the strongest single predictor of the next one and it does not
expire at twelve months; longer ago stays current. **Knee**: the 5% weekly cap is exactly the lever for patellofemoral
and tendon load, and I have nothing that tells me a year is enough; longer ago stays current. **Back**: the 120-minute
long-run cap is a time-on-feet guess with the thinnest basis of any cap we hold; for a back that has been quiet for
more than a year, I will lift that one cap and nothing else. **Plantar**: lift the long-run cap on the same reasoning,
but keep the hill swap and the delivered cap, because the fascia is loaded hardest uphill and recurrence is common.
**Achilles**: its only effect is the beginner hill swap. I will not relax a tendon guard on a date, so no answer
changes it — which by the SLT's rule means we do not ask. And my default stands: absent or skipped is current."*

### 🎯 Greg McMillan — partial dissent
*"I accept shin. On knee I dissent: a ten-year-old knee on a runner doing 20 a week costs them 24 km of peak and 7 km of
long run, and that is a different plan, not a cautious one. But I cannot give you evidence that a year is enough, so
I will not block. Record it. And one thing about meaning: the step already says 'still an issue', so the bucket has to
mean **when it last flared**, not when it started — otherwise 'longer ago' contradicts the chip."*

### ⚕️ Stacy Sims
*"Shin first: in women a prior bone-stress injury, often with low energy availability behind it, stays a risk long
after a year — keep it current. I agree with McMillan on meaning: 'last flare-up', and the runner should not be made
to re-explain an injury they have already told us about (my 11-14 condition, still binding)."*

### 📊 Stephen Seiler
*"No objection. Nothing here moves intensity distribution."*

---

### ⚡ Recorded disagreements
**McMillan vs Willy on Knee "longer ago".** McMillan: a decade-old knee should not cost 24 km of peak. Willy: no
evidence a year resolves acute-load sensitivity. **What would settle it:** recurrence data by time since last flare —
Zonna does not collect outcomes; the board will not pretend the literature answers it. Knee stays current.

## ⚖️ Ruling — **CORRECT WITH AMENDMENT** (amends the 2026-11-14 *"four chips"*)

**Meaning (coaching owns it):** the bucket answers *when did it last flare up*, not when it began. **Absent or
skipped = current** (Willy, 11-14, binding).

| chip | current | within a year | longer ago | collected? |
|---|---|---|---|---|
| **Back** | all caps | = current | **long-run time cap lifted** (≡ `Back→Hip`); any-injury gates kept | **YES** |
| **Plantar fasciitis** | all caps | = current | **long-run time cap lifted** (≡ `Plantar→Calf`); hill swap + delivered cap kept | **YES** |
| **Knee** | all caps | = current | = current *(McMillan dissent recorded)* | **NO — nothing changes** |
| **Shin splints** | all caps | = current | = current | **NO — nothing changes** |
| **Achilles** | all caps | = current | = current | **NO — the "fifth" is answered and written down** |
| Hip | — | — | — | out of scope (11-14 ruling: effect or removal by 2026-12-12) |

**Measured effect of the only answer that changes anything** (marathon): Back/Plantar long run **17 → 29.5 km**
(intermediate, 20 and 40 km/wk), **15 → 26 km** (beginner); peak **52 → 62** (int. 20), **58 → 66** (int. 40),
**51 → 52/53** (beginner). Half: beginner LR 14.5 → 15.5, intermediate 40 km/wk 16.5 → 17.5.

**Condition before the build ships:** `measure:fitness` on the back/plantar cohort with the lift applied must show no
`neverBuildsPct` rise and the delivered long-run step stays inside §45/§2 (a cap lifted on a cohort the corpus does
not hold is the class this repo has paid for repeatedly). Not run here.

### 📦 Required artifacts (with the build)
1. **Principle** — §9 Am. 3 gains a recency clause (the table above, the *last flare* meaning, the 12-month rationale,
   absent = current, and why Knee/Shin/Achilles do not vary).
2. **Numeric** — no new number. A declarative table in `GENERATION_CONFIG` naming which caps a `longer_ago` answer
   lifts (`back: ['long_run_time_cap'], plantar_fasciitis: ['long_run_time_cap']`), so the scope is config, not code.
3. **Invariant** — `INV-PLAN-INJURY-RECENCY-SCOPE` (error): a plan may lift an injury cap only where the input marks
   that chip `longer_ago` AND the table lists that cap; an absent recency must produce the `current` plan. Falsify by
   lifting the knee cap on `longer_ago`, and by treating absent as `longer_ago`.

### ↗️ Hand-offs
🧭 **Design Board** — the control, now with a success condition it can state: a per-chip answer on **Back** and
**Plantar fasciitis** only; two of three buckets are engine-identical, so whether to show three buckets or two is the
Design Board's call (McMillan's *"what a runner can answer standing in a kitchen"* argued for three). Sims's 11-14
copy condition binds. 👤 founder for the words.

## ⚠️ What this does not prove
That lifting the long-run cap for an old back or plantar history is safe — there are no outcomes; it is argued from
the weakness of the cap's own basis. ADR-021-ready runners (where `Back→Hip` and "chip removed" would differ) are not
in the table. The 11-14 maintenance flip at 40 km/wk was not reproduced with these inputs.
