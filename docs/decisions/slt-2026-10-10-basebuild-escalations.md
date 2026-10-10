# SLT — three base-build escalations, one sitting (2026-10-10)

Both boards escalated to this table on the same day. **Correctness and shape were settled
elsewhere and are not reopened here.** This note records what the SLT decided: funding,
sequencing, and one kill.

**Tier, all three: FREE.** Item 2 is an engine refusal with no gate; Item 3 inherits P-02's
tag; Item 1 is **access, not richness** — `CLAUDE.md` forbids gating it.

---

## 🔴 The registry check reshaped Item 1 before any seat spoke

**MAINT-06 already shipped this mechanism.** A one-time transition announcement on Today
keyed off `plan_kind`, seen-state persisted on the plan's own meta
(`maintenance_transition_seen`), an ongoing status card, and CA-03's goal ladder gated to
the §75 re-engagement window.

**So `BASEBUILD-HANDOVER-01` is not a new surface. It is MAINT-06's twin, never wired** —
and ADR-013 §36 names `user generates next race` in the same lifecycle MAINT-06 solved.
That is the *"hazard solved for one transition, named but not solved for its twin"* class
from the debug catalogue, verbatim. **It changed the item from "a new surface the founder
must decide" to "a `plan_kind` branch on a surface that already does this job."**

---

## Decisions

| Item | Decision |
|---|---|
| **1 — `BASEBUILD-HANDOVER-01`** | ✅ **BUILD**, reusing MAINT-06's mechanism with a `base_build` trigger. **FIRST** — it is the only item with a dated cost (100 and 107 days). → 🧭 Design Board for the surface, 🏃 Coaching Board for the warn-band copy. **The founder funds it; he does not need to design it.** |
| **2 — `BASEBUILD-ADJUST-MONOTONIC-01`** | ⏸️ **BLOCKED ON A MEASUREMENT, NOT ON A DECISION.** Export `peakKm`, re-measure, report segmented (Sims, binding). **This board will not refuse a correct correction on cost** — recorded so nobody re-litigates it. Implementation still needs the founder's sign-off. |
| **3 — `BASEBUILD-ADJUST-REBUILD-01`** | ✅ **BUILD, LAST.** Approved on marginal cost (a branch plus a derived key set on an existing sheet), **not** on user count. Shape not reopened. |

### ⛔ KILLED — "tell the two runners directly"

🔬 **Wood, using her kill mandate:** *"a message from the founder to two runners is not a
mechanism; it is a person remembering. It does not scale, it cannot be tested, and the third
runner gets nothing. **An intervention that depends on someone remembering is not an
intervention.**"* It also collides with the founder's standing *"zero contact with our
runners"*, so it is a decision he has effectively already taken. **Permanent.**

**Option (c), do nothing,** is also rejected: the only route left is the wizard, **which
archives the block the runner just completed.** That is the worst of the three.

---

## The seats

🧠 **Sutherland:** *"A plan that ends is not a neutral event — it is the most
psychologically loaded moment the product has."* Sheena goes 5 → 18.9 km/wk over fifteen
weeks; **for her that is the most successful thing she has ever done as a runner**, and on
19 Jan the app says nothing. *"That is where people quit, and they quit feeling foolish for
having tried."* On Item 2: **"a gate that rewards pessimism about yourself is not a safety
mechanism, it is a confession box."**

📦 **Fried:** build Item 1 small — *"it is not a programme, it is an afternoon"*. Build
Item 3 **because it is nearly free, not because two users need it** — *"if it were a new
sheet I would kill it at two users without blinking. It isn't."* On Item 2: **refuses to
price a correction on a figure I had declared unreliable.** *"Get `peakKm` exported, take
the real measurement, then it is a one-line decision. That is not a delay, it is the work."*

🏃 **Hutchinson** (carrying Item 2 up on the coaching hat): **§111 Amendment 2 is three
weeks old and did exactly this to the other half of the fraction** — +456 refusals, +19.6%
in the cohort ranked first, shipped by both boards on evidence of a 5.57× median true build
ratio and **zero genuine defects**. *"Declining to apply a correction because the truth is
expensive is not a coaching position — I said that then and it binds me now."* ⚠️ And a
product consequence for Item 1: **Tom's handover returns a prep-time warning, not a plan**,
so a card that does not carry the acknowledgment honestly is *"a cheerful door onto a
compressed block"*. **The copy is the Coaching Board's, not the builder's.**

🔬 **Wood:** Item 1 is **habit work, not motivation** — the block ending is a *context
change*, and MAINT-06's shape is right because *"it fires on the context, not on a
schedule, and it does not nag."* ⚠️ **Binding condition, inherited from MAINT-06:** the
announcement **suppresses the ongoing card until acknowledged.** Do not ship two cards
competing at the moment of highest uncertainty.

🧭 **Zhuo:** declines to rule here on what she ruled at the Design Board, in both
directions. Item 3's shape is settled — *"do not reopen it at this table."* **Item 1 goes
DOWN to her board**: *"the SLT has five seats and not one of us is a designer."* ⚠️ **And
the success condition is set NOW, before any design: a runner whose block ends either holds
a race plan or has explicitly declined one.** Not *"saw the card"* — *"otherwise we are
building a thing that feels like a handover."*

---

## ⚡ Conflicts

**Sutherland vs. Wood on Item 1's register** — honour fifteen weeks of work, or change the
context and celebrate nothing. **Genuine, unresolved, and the Design Board's to settle**; it
is the brand's own line between *"There it is. Don't ruin it."* and a fire emoji.

**Fried and Hutchinson are NOT in conflict on Item 2** — both refuse a proxy. That is a
blocked decision, not a disagreement, and recording it as one would be flattery.

**The brief's routing on Item 1 was wrong.** It came in as *"founder must decide a new
surface"*. Funding is the SLT's, the surface is the Design Board's, the copy is the Coaching
Board's.

---

## ⚠️ The seat that is not at this table

**Item 1 is a CHURN question** — what happens to a runner who hits a dead end after fifteen
successful weeks. **Traynor's commercial seat is stood down and nobody here priced that.**
Fried killed surface area; he did not price retention. **This item is exactly the kind of
evidence that would justify the recall**, and the trigger is unchanged.

## ⚠️ Risks to what is already built

**MAINT-06 is the risk, not the template's benefit.** Item 1 adds a second trigger to a
surface already branching on `plan_kind: 'maintenance'`, with seen-state written through
`savePlanForUser`. 🔴 **`markMaintenanceTransitionSeen` relies on `race_name` being
unchanged so the save does not archive the plan** — a base-build variant that gets that
wrong would **archive the runner's block while announcing it.** Also touches CA-03's
`nextGoalGateOpen`, which currently assumes "not maintenance" means "race".

**Nothing has ever run on a device.**
