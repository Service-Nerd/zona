# Design Board — 2026-11-20. `BENCHMARK-DATE-REQUIRED-01`

**Trigger:** soft, qualifying — the wizard's benchmark step and the shared `BenchmarkFields` (also Update Paces) would
change what a runner must do. Filed 🧭 DESIGN BOARD → 👤 FOUNDER (copy). One sitting; the founder's half is a hand-off.
**Change:** a started benchmark may no longer leave the date blank by omission; a runner who cannot remember declares it.
**Tier:** FREE (the benchmark step is in every tier's wizard).
Seats: Zhuo (chair), Silvanto, Sierra, Wroblewski, Collins. Sitting run alongside `PROFILE-BIRTH-YEAR-REQUIRED-01`
(same shape, one field over) for consistency; two notes, two rulings.

---

## 📐 Analysis — every stated figure re-derived

Evidence: `scripts/board-evidence-design-sittings-2026-11-20.ts` (read-only SELECTs on production + an engine pass),
run 2026-11-20 with `NODE_ENV=production npx tsx scripts/board-evidence-design-sittings-2026-11-20.ts 131`, plus a
throwaway read-only query listing the dateless rows (deleted after use; output quoted below).

| Item says | Today |
|---|---|
| *"8 of 21 (23 when filed; re-measured 2026-11-17) live benchmark plans carry no date"* | **8 of 23** (43 live plans; 15 dated, ages 11–968 days). The numerator held; the denominator moved back to 23 |
| the date is optional inside an optional step (`benchmarkFromFields`: `v.date ? {benchmark_date} : {}`) | **Confirmed** — `lib/plan/benchmarkCheck.ts:98`; `BenchmarkFields.tsx:125` renders `<FieldLabel optional>When did you run this?</FieldLabel>` |
| the engine side is done (`INV-PLAN-VDOT-DISCOUNT-DATELESS`) | Not re-verified here — engine doctrine, not this board's |

**What the analysis found that the item does not say:**

1. 🔴 **Three exits carry a dateless benchmark past the step, and only one of them is the field.**
   - the field itself (optional label);
   - the footer's `Not sure, continue` (`GeneratePlanScreen.tsx:1878`) — it is `goNext()` and **keeps the answer**
     (S4), and it is disabled only when `benchmarkBlocked`, so a complete-but-undated benchmark walks through it;
   - 🔴 **the native estimate path** (`/api/wizard-benchmark-estimate`, CI-4): on *"Looks like a 10K in about 52:00.
     Close?"* the wizard fills type, distance, hours and minutes (`:886–891`) and **never a date**, although the
     estimate is computed from the runner's own recent runs, so its recency is known by construction. That exit
     never shows the date field at all.
2. **Which exit produced each of the 8 is not determinable from the stored plan.** All 8 are `type: race` with a
   whole-minute time except one (`0:25:20`); the estimate path leaves `secs` at 0, so it *could* explain seven, and a
   runner typing a round time explains them equally. **Not measured.** One of the 8 (`df2cc6e6`, a 14:00 10K,
   2026-06-26) is an internal test account.
3. The shared component means the change reaches **Update Paces** too (`BenchmarkFields` is *"THE benchmark entry"*,
   BENCHMARK-INPUT-01) — a consumer the item does not name.

**What the evidence cannot show:** how many of the 8 could have answered had they been asked properly; whether a
runner who skips a date knows roughly when they raced. No device has run this step today.

---

## 🔍 Settled-ground scan (pattern + token layers)

| Row | Bearing |
|---|---|
| **BENCHMARK-INPUT-01** (2026-10-16) | One benchmark entry, every value read back; no modal or confirmation step. **Binds:** the change lands in `BenchmarkFields`, both screens get it |
| **WIZARD-WEEKDAY-CONFIRM-01 (a)** — permanent kill | No confirm step / modal. A "are you sure?" on a blank date is pre-killed |
| **S4** — an optional step's primary is never the skip; affordance reads `Not sure, continue` | The benchmark **step** stays optional (no benchmark is fine). Untouched |
| **S3** — one CTA vocabulary | The footer buttons do not change label |
| **Injury-recency sitting (2026-11-14, line ~240)** | 🔑 Precedent that decides the bucket option below: this board **does not encode buckets whose meaning the Coaching Board has not stated** |
| Token layer | No token touched |

---

## The board

**🧭 Zhuo (chair).** *"Sims' sentence is about the engine pricing a blank, and the engine half is shipped: the blank is
now declared, not priced. What is left for us is narrower and it is real — the product cannot tell a runner who does
not know from a runner who never noticed the field. Success condition, stated before the design: after the build,
every dateless benchmark in a new plan is one the runner chose to leave undated, and the stored plan can say so. If
we cannot make that observable, we are shipping a mood."*

**📱 Wroblewski.** *"Count the exits. The item names one; there are three, and the worst is the one with no field on
screen. A required-date rule that gates the field and not `Not sure, continue` or the estimate confirm is a rule on
one door of three. The control is the one we already own — a date `TextField` — plus one in-field option beside it,
a chip, `I don't remember`. Not a second step, not a modal. On the estimate path the runner never types a date and
should not be asked one: we know when those runs were."*

**🎓 Sierra.** *"A runner who has to say 'I don't remember' learns something: that the date matters. A runner who
scrolls past an optional field learns it doesn't. That is the whole case for requiring it, and it is about the
runner, not the data."*

**✋ Silvanto.** *"No palette or type in play. One craft point: the existing note under the field — 'Older than a
month? We'll set your paces a little more conservatively.' — is the reason, and it must stay adjacent to the choice,
including when 'I don't remember' is selected, because that is the moment the runner most needs to know what it
costs them."* No veto.

**🎪 Collins.** Proposed **buckets** instead (*this month / 1–3 months / 3–6 months / longer*): *"nobody remembers a
date; everybody remembers roughly when."* 🧭 **Declined by the chair, on settled ground:** what a bucket *means* — which
date the engine prices it at — is §10 meaning, owned by the Coaching Board, and this board refused exactly that shape
on 2026-11-14 (injury recency) for want of bucket semantics. **Collins lost; recorded.** It is not killed: it returns
only with Coaching Board bucket semantics in hand.

---

## ⚡ Recorded disagreements

- **Collins vs the chair — buckets.** Collins: a coarse answer is more honest than either a date or a shrug. Chair: an
  encoding cannot precede its meaning. *Would move the chair:* a Coaching Board ruling stating what each bucket prices.

## ⛔ Veto check
Silvanto: none.

## ⚖️ Ruling — **SHIP WITH AMENDMENT (4)**

1. **A started benchmark requires a date OR an explicit `I don't remember`** — an in-field option beside the date
   field in `BenchmarkFields`, not a step, not a modal. The benchmark step as a whole stays optional.
2. **Every exit is gated, not the field.** `Not sure, continue` (which keeps the answer, S4) takes the same gate when a
   benchmark is started; a restored `zona_wizard_draft` cannot land past the step with an undated, undeclared
   benchmark; and **the estimate-confirm exit must not post a silently dateless benchmark** — it is either dated by the
   build from the runs it was computed on or posted as declared-unknown. *Which* date an estimate carries is §10
   meaning: → Coaching Board if the build wants anything other than "declared".
3. **The declaration is recorded** so the success condition is observable: a stored plan must distinguish
   "declared unknown" from "not asked" (contract change in `docs/contracts/` in the same commit), or the build states
   that the success condition is unmeasurable.
4. **Update Paces inherits it** through the shared component — named, not discovered.

**Copy is the founder's** (👤): the chip's label, and whether the existing *"Older than a month?"* note changes when
`I don't remember` is chosen. The board's condition on the words: they state the consequence, never reassure.

## 📦 Required artifacts (land with the build)

1. **Pattern** — `ui-patterns.md` § *Benchmark entry*: *a recency field is answered or declared, never left blank by
   omission; every exit from the step takes the same gate.*
2. **Constant** — the declared-unknown value in `lib/plan/benchmarkCheck.ts` (beside `BENCHMARK_PROBLEM_COPY`); never a
   literal in a component.
3. **Mechanical check** — `lib/plan/benchmarkCheck.test.ts` (+ a wizard exit arm): a started, undated, undeclared
   benchmark cannot proceed through **either** footer button, through draft restore, or through estimate confirm;
   falsified by un-gating each exit in turn.
4. **Register row** — below.

## ↗️ Routing
👤 **Founder** — copy (hand-off). 🏃 Coaching Board — only if the build dates the estimate path, or if buckets return.

## 🚨 MUST/NEVER
No modal (pre-killed). No em dash in the chip or note. No colour beyond existing `FieldReadback`/`FieldNote`.

## ⚠️ What this ruling does not settle
- It fixes no existing plan: the 8 live dateless plans stay dateless.
- Whether a required date *reduces* the dateless share, or only converts silence into `I don't remember`, is unknown
  until the declared flag exists and runners pass through it.
- Not seen on a device.
