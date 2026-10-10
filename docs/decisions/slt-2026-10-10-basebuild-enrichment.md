# SLT — should a `base_build` plan be AI-enriched? (2026-10-10)

**Routed up by** `/zona-debug` → `/build` while shipping `BASEBUILD-SCHEMA-CEREMONY-01`.
**Seats:** Sutherland, Fried, Hutchinson *(coaching chair)*, Wood, Zhuo *(design chair)*.
⚠️ **No seat prices this.** Traynor's commercial seat was stood down 2026-09-22 and the
recall trigger (revenue, a measurable trial-to-paid rate, a redeemed-code funnel, or
meaningful installs) has not fired. Nobody at this table asks what it does to conversion.

---

## The mechanism

`app/api/generate-plan/route.ts:179-181` returns a base build **before `enrich()` at line
535**, for every tier. Not a gate, not a bug, not a decision anyone took: it is where the
early return landed when `accept_base_build` was correctly moved ahead of generation.

**Live, read-only:** 2 runners hold a `base_build` plan; **one is PAID** (`3df045d5`). Both
end their block in January, both race 24 Apr 2027.

---

## 🔍 Settled ground — this is MAINT-02, one plan kind over

| | Maintenance block | Base build |
|---|---|---|
| Structure | MAINT-01, **FREE** | §118, **FREE (it is the door)** |
| AI voice | MAINT-02, **PAID**, gate `maintenance_coaching` | **no gate exists** |
| Enforced | `maintenance-block/route.ts:169` | nowhere |
| `/pricing` row | `pricing.ts:174` | none |

`lib/plan/maintenance.ts:1` already reads *"FREE — infrastructure (AI coaching voice is
PAID, gated by `maintenance_coaching`)"*. **MAINT-01 shipped the structure and MAINT-02
wired the voice as a separate tier-tagged decision. §118 shipped the structure and that
second sitting never happened.** That is the whole finding.

---

## Ruling

**Tier: the PLAN stays FREE** (registry `P-15` and `§118`, both *"FREE (it is the door)"*).
**The VOICE is PAID**, behind a new `base_build_coaching` gate in `PAID_ONLY_ONGOING`.

**BUILD DIFFERENTLY — three separable pieces:**

1. ✅ **SHIPPED (`833d5f14`), no tier question.** Stamp `meta.enrichment` so the cohort is
   countable. A metric that cannot see a cohort is a defect under every tier answer.
2. 🔻 **Founder.** The `base_build_coaching` gate, enforced at the early return, reusing
   `enrich()`. ⚠️ Obliges a `/pricing` row — `pricing.test.ts` fails the build otherwise.
3. 🔻 **Founder + Coaching Board.** The content of that voice.

### Conditions carried from the sitting

- 🔴 **Wood, binding: piece 2 must not ship before `BASEBUILD-HANDOVER-01`.** *"If you ship
  voice and not the handover, you have decorated a plan that still drops the runner off a
  cliff in January."* She supports voice as PAID parity and explicitly **not** as the fix
  for the dropout risk — voice is motivation; the handover is a context change.
- ⚠️ **Zhuo, gating:** state the observable success condition first — *a base-build runner
  can tell what this week is for* — and **read what the rule engine already writes** across
  those fifteen weeks before writing a prompt. If the rule copy answers it, the voice is a
  preference.
- ⚠️ **Hutchinson:** tier is the SLT's, **content is not**. Fifteen weeks of easy running is
  the hardest thing in this product to write honestly about, and an enricher given a thin
  week will produce padding — which on an easy week actively undermines the instruction.
  The Coaching Board rules before a line ships.
- 🔴 **Hutchinson corrected the submission.** It characterised the cohort as *"the runners
  least able to self-coach"*. **Unmeasured:** 20 refusal events, 10 distinct runners,
  `training_age` from `<6mo` to `5yr+` — one refused at 0 km/week with five years of
  running behind them. **Do not build a tier argument on it.**

### Recorded disagreement, not synthesised

**Sutherland vs Fried on the FREE cohort.** Sutherland: the moment after a refusal is the
highest-stakes moment the product has, and *"silence there doesn't read as restraint, it
reads as indifference"*. Fried: keep the free door functional and undecorated — *"the door
being free is the point, and the door working is not the same as the door being
decorated"*. **Unresolved and deliberately left so** — it only bites once there is a second
free base-build runner. There is currently one, and they are paid.

## 🚨 MUST/NEVER

No violations. *"Gate richness, never gate access"* is **honoured**: the plan is access and
stays FREE, the voice is richness and becomes PAID.

## ⚠️ Risks

`enrich()` is shared with the race path, so reusing it puts every race plan in the blast
radius of any prompt change — the argument for a sibling enricher, which is what MAINT-02
chose. `P-15` and `§118` keep their FREE tags. **No stored plan is touched:** the live-plan
policy means neither existing base-build runner gets voice retroactively without founder
sign-off, so a YES affects only plans generated from then on.
