# Contract — HrTrace and TabbedPhone

**Authority**: Prop interfaces and rendering contracts for the two shared components added by the
v3 design handoff. Any change to props must update this document in the same commit.

**Component:** `components/marketing/HrTrace.tsx`
**Component:** `components/marketing/TabbedPhone.tsx`
**Component:** `components/marketing/PhoneShell.tsx`

---

## HrTrace

```typescript
type Props = {
  phase: 0 | 1        // 0 = keen (amber breach), 1 = held
  drawn: boolean      // drives the stroke draw-in
  ticks?: boolean     // the 0/4/8 km row under the svg
  idSuffix?: string   // makes the clipPath id document-unique
}
```

⚠️ **THE PARENT OWNS `phase`.** The verdict number, Kit's sentence and the curve are three views of
one state; letting the trace own it desynchronises them.

⚠️ **THE DRAWN PATH AND THE COPY MUST AGREE, AND A TEST ENFORCES IT.** The card says "14 minutes
above your ceiling" and Kit's sentence names the same figure. `BREACH_MINUTES` in
`lib/marketing/heroTrace.ts` is the single source for both, and
`lib/marketing/hrTraceGeometry.test.ts` flattens the committed bezier, finds its crossings with the
ceiling numerically, and fails if the shaded span stops matching. **As delivered, the handoff's path
shaded 44.7% of the run — about 25 minutes — against copy that said 14.** The path was re-cut; the
test also asserts the original would fail.

⚠️ **NO `mini` VARIANT.** The handoff specifies one for a "four easy runs" strip that lives in the
exploration file, not the page spec. `SameWeekTwice` already makes that point on the same page with
real plan data. Re-add the variant with the strip, not before.

⚠️ `idSuffix` is not optional decoration. A duplicated `clipPath` id makes every later instance clip
against the first one's rect, and that failure is invisible until a second instance exists.

## TabbedPhone / PhoneShell

```typescript
type PhoneTab = 'Today' | 'Plan' | 'Coach' | 'Me'
// TabbedPhone
type Props = { initial?: PhoneTab }
// PhoneShell
type Props = { activeTab: PhoneTab; onTab?: (t: PhoneTab) => void; children: ReactNode }
```

- **Tab switching is the bottom nav.** The handoff draws a segmented control above the frame and
  says in as many words not to ship it: in the product, the nav is how you change tabs.
- `Me` is rendered and inert. The product has four tabs and a mockup that hides one is a mockup of a
  different app; it has no screen here, so selecting it would show Today under a "Me" nav.
- `PhoneShell` supplies the frame, notch, status bar and nav. `PhoneFrame` (Today only, server
  component) and `TabbedPhone` (three screens, client) both render through it, so there is **one
  device in the codebase, not two**.
- Passing `onTab` makes the nav real buttons and drops `aria-hidden`: a control a visitor can press
  is not decoration.
- **Every distance and duration goes through `lib/format` (ADR-015).** The handoff writes "8 km" and
  "2 h 05"; the product renders "8km" and "2h 05". `lib/marketing/realComponents.test.ts` exists
  because that exact drift shipped once.
