# `RefusalView` — contract

**Component:** `components/shared/RefusalView.tsx`

What a runner sees when the engine will not build
the plan they asked for.

⚠️ **Written 2026-10-10 because `PREP-ACK-NO-WRITER-01` changed this component's prop
interface and it had no contract at all** (it was in `CONTRACT-COVERAGE-03`'s declared
debt). `CLAUDE.md`: *"when changing any API route or component prop interface, update
`docs/contracts/` in the same commit."*

## What renders here

**Three things, and the distinction is the whole component.**

| State | Means | Source |
|---|---|---|
| **Refusal** (HTTP 422) | A deliberate coaching decision (§44 / §52 / §55 / §111 / §113). Reads as a calm *"not yet"* | `REFUSAL-SCREEN-01` |
| **Fault** (500, network drop) | **Us** failing. Keeps the honest *"something went wrong"* | `REFUSAL-SCREEN-01` |
| **Acknowledgeable warning** | A `warn`-tier refusal the runner may **consent** to | §44 / §52, `PREP-ACK-NO-WRITER-01` |

Conflating the first two was `REFUSAL-SCREEN-01`: a coaching decision presented as a crash.

## Prop interface

```typescript
interface RefusalViewProps {
  isRefusal: boolean           // 422 → true. Drives voice, not layout.
  message: string | null       // server-authored. Never assembled here.
  alternatives: string[]       // server-authored, ORDERED by the server.
  offer: RefusalOffer | null   // §118 base-build offer. Rides a BASE-VOLUME refusal only.
  offerFailed: boolean
  onAccept: () => void         // takes the §118 offer
  onAdjust: () => void         // back to the wizard. Present in EVERY branch.
  ackLabel?: string | null     // §44/§52 consent label, server-authored (ACK_LABEL)
  onAcknowledge?: () => void   // step two: resend with the ACK_FIELD flag
}
```

## Invariants

1. 🔴 **EVERY string is authored server-side and this component only renders them.**
   `message` and `alternatives` come from `lib/plan/inputs.ts`; `offer` from
   `lib/plan/baseBuildCopy.ts`; `ackLabel` from `lib/plan/warnAcknowledgement.ts`.
   **A client-side template would be free to break a Coaching Board condition for the
   runner least able to absorb it** — the §118 non-clearing variant must say nothing
   about a race, and §44's warning must name what gets compressed (Sims, binding).
2. 🔴 **No CTA branch terminates without `onAdjust`.** `ux-principles` bars dead ends and
   a CTA with no visible alternative is a dark pattern. **Derived, not counted:**
   `refusalOffer.markup.test.ts` asserts the number of adjust affordances equals the
   number of CTA branches, so adding a fourth branch without a way back fails the build.
3. 🔴 **An acknowledgeable warning and a §118 offer never coexist.** The offer rides a
   base-volume refusal; the warning rides §44/§52. Different errors, and `showAck`
   requires `!showOffer`.
4. ⚠️ **In the ACK branch the consent is SECONDARY and adjust is PRIMARY** — inverting the
   offer branch, deliberately. 🏃 Hutchinson, binding: the acknowledgment is a **distinct
   prior step** and a warn-band runner must not reach a plan in one tap. In the offer
   branch the offer **is** our recommendation, so it leads; here consenting to a
   compressed block is the runner **overriding** us, so the thing we advise leads.
   ⚠️ **This inversion was applied from the Coaching Board's condition and has NOT been
   ratified by the Design Board** — flagged on `PREP-ACK-NO-WRITER-01`.
5. **Not a modal.** P-15 names it explicitly; `CLAUDE.md` bars popups outright.
6. **A `block`-tier refusal must never grow a consent affordance.** §111, §113 and every
   `block` tier are not negotiable. Enforced by `warnKindOf`'s negative arms.

## Consumers

- `app/dashboard/GeneratePlanScreen.tsx` — the only real one.
- `app/refusal-preview/` — renders **this** component in every state, deliberately. A
  fixture rendering a second copy of the markup would drift and prove nothing.

## Gates

`lib/plan/refusalOffer.markup.test.ts` (11 arms) · `lib/plan/warnAcknowledgement.test.ts`
(7 arms, composition) · `components/ui/buttonGeometry.test.ts` (both new controls clear
the 44px floor at 44 and 47px).
