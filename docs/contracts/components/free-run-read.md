# Contract — FreeRunReadCard

**Authority**: This document defines the free post-run read card's props. Any change must update this
document in the same commit; `lib/contracts/componentContracts.test.ts` compares the two prop-for-prop,
both directions.

**Component:** `components/shared/FreeRunRead.tsx`
**Owner of the content:** `lib/coaching/freeRunRead.ts → freeRunRead(row, plannedType)`

```typescript
interface FreeRunReadCardProps {
  /** `freeRunRead(...)`. The component never derives a number itself. */
  read: FreeRunRead
  /** Routes to the paywall. Never called from the `no_hr` state, which offers nothing to buy. */
  onUpgrade: () => void
  /** The linked activity's columns have not resolved yet. Outranks `absent`. */
  loading?: boolean
  /** Somebody ELSE'S run, shown before this runner has one. See § The example below. */
  example?: { eyebrow: string; next: string } | null
}
```

## Rules (SLT + Design Board 2026-11-12, `ACT-FREE-TEASE-01` / `ACT-FIRSTRUN-01`)

- **The number is `--fs-metric` (26px) / 800 / tabular-nums**, with its words beneath it, and the
  CTA's floor is `TAP_TARGET_MIN_PX` as a **bare identifier**. Both were corrected by gates rather
  than by review: `--fs-metric-lg` (38px) is outside the app's declared type scale, and both
  `'44px'` and a template literal are refused — by the inline-44 ratchet and by
  `buttonGeometry.test.ts`'s constant resolver respectively.
- **One number, never four.** The band is whichever one the run spent itself in, decided by
  `runEffortKind` — so there is no new threshold — except that the three structurally hard kinds
  (`hard`, `split`, `planned`) quote the **hard** share: for a run that was meant to be hard, the
  easy share is a true number about nothing.
- **No evaluative word, ever.** Binding condition from the SLT: the split is a measurement, the
  advice is an interpretation. Checked against a word list in `freeRunRead.test.ts`, because a
  condition on copy is the least durable thing in a codebase.
- **No rail.** P-01's moss/amber pair would state the verdict in colour. ⚠️ A *neutral* rail was the
  first answer and renders invisible at 375px (`var(--line)` on a `var(--line)` border), so it was
  a device carrying nothing; the **absence** is what reads as "no verdict".
- **All five states ship together**: `measured` · `no_hr` · `absent` (renders nothing at all) ·
  `loading` · paid, which is unchanged and is the existing read cluster.

## The tier line

The zone split of a runner's **own** run is FREE. The read, the verdict, the advice, the weekly
score and the reshape stay PAID (`activity_intelligence`, unchanged). 📐 The four columns are
written at **ingest** by `lib/health/adapter.ts`, the Strava webhook and `link-activity` for every
tier — measured 2026-11-12: free/trial runners hold 146 activities, **122 carrying the split** — so
this card costs no computation and no model call.

## `absent` vs `loading` — a tri-state the CALLER holds

`freeRunRead(null)` answers `absent` both for *"the read has not returned"* and *"there is no run
linked"*. The card cannot tell them apart, so the caller must: `PostRunScreen` keeps
`zoneRow: RunEffortRow | null | undefined`, resolves `undefined → null` in a `finally` on every exit
including a thrown read, and passes `loading={zoneRow === undefined}`. **Without that the card
shimmers for ever on an unlinked session.**

## The example (`ACT-FIRSTRUN-01`)

Passing `example` is the **only** way this card shows data that is not the viewer's own, and the
shape of the API is what keeps that honest.

- The declaration **replaces the eyebrow** — it is the first thing read, never small print beneath
  the card.
- The withheld line is replaced by `example.next`, and **the paywall link does not render**: a
  runner in onboarding is inside a full-access trial, so there is nothing to unlock and a buy link
  there would be the calendar-triggered upgrade prompt the SLT banned, dressed as a sample.
- Data comes from `DEMO_FIRST_READ` in `lib/marketing/demoSurfaces.ts`, **by reference**, so the app
  and the marketing site describe the same runner on the same day (standing rule: *marketing stills
  must be the REAL components*).

## Call sites

| Where | Mode |
|---|---|
| `PostRunScreen` (`app/dashboard/DashboardClient.tsx`), `!hasPaidAccess` | live, with `onUpgrade` → `openUpgrade('post_run')` |
| `OrientationScreen` (`components/dashboard/OrientationScreen.tsx`) | `example` |
| `/post-run-preview` | every state, for looking at |

**Checks:** `lib/coaching/freeRunRead.test.ts` (13 arms) ·
`components/shared/freeRunRead.markup.test.ts` (23 arms). 12 mutations red.
⚠️ **Not seen on a device**, and `OrientationScreen` is in no harness, so the card's placement in
that screen rests on its own measured height plus that screen's existing `overflowY: auto`.
