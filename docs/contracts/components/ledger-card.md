# `LedgerCard` — contract

**Component:** `components/dashboard/LedgerCard.tsx`

"Weeks within the lines" — the discipline counter, and the **single render path of a FREE
feature**.

🔴 **Written 2026-11-08 (`CONTRACT-LEDGERCARD-01`) because the register's proxy gave the wrong
answer about it.** `audit-docs.sh`'s shared-component arm counts components with **≥2
importers**, standing in for *"shared, therefore worth a contract"*. When
`LEDGER-COACH-SITE-REMOVE-01` removed the Coach render site, this component fell to **one**
importer and dropped out of the population **while still being uncontracted** — so the register
went 61 → 60 and nothing was paid. ⚠️ **It deserved a contract MORE that day, not less:** it had
just become the only door to a feature whose reachability took four months to notice
(`LEDGER-REACH-01`). **This contract does not lower `UNCONTRACTED_BASELINE`**, because the
component is not in that population; saying otherwise is the register-over-counting failure this
repo records.

## Prop interface

```typescript
interface LedgerCardProps {
  ledger?: LedgerSnapshot | null
  surface: 'me' | 'coach'
}
```

## Invariants

1. 🔴 **`surface` is REQUIRED and must never gain a default.** It is the only thing that tells
   the two render sites apart in `ledger_view`, and **a default is how the second caller ships
   mislabelled.** `OPS-ARTIFACT-PLACEMENT-01` is an SLT decision parked on exactly this data, so
   an unattributed surface makes that decision harder, not easier (`LEDGER-REACH-01`).
2. 🔴 **The analytics event lives with the CARD, not with a caller.** `useTrackOnce('ledger_view',
   …)` is inside this component. It previously fired from `CoachScreen`, which would have left
   the Me surface silent once the card rendered in two places.
3. ⚠️ **It fires only on a RESOLVED snapshot.** The guard is `ledger != null`: *"rendered a
   spinner"* is not *"saw the ledger"*.
4. **`ledger` is an optimisation, not a mode.** Supplied, it is the parent's prefetched snapshot
   and the hook's fetch is skipped (`useDisciplineLedger(ledgerProp != null)`); absent, the card
   fetches for itself. **Both paths render the same thing** — there is no prop-only or hook-only
   branch.
5. 🔴 **The loading state is the same SHAPE as the resolved card**, so the surface does not
   reflow when the data lands: a 44px em-dash where the number goes, and the same 13px noun
   under it.
6. 🔴 **The unit never disappears, including at zero** (`LEDGER-ZERO-UNIT-01`, founder-found).
   The zero branch used to REPLACE *"weeks within the lines"* with *"This week starts the
   count."* — so the one state where a reader cannot infer the unit was the state where the unit
   was deleted, leaving a bare 44px `0`. The reassurance now sits **beneath** the noun, in a
   nested `<span>` with **no `fontSize`**, inheriting 13px: a second sized div would grow
   `TYPESCALE-APP-GATE-01`'s declared-size register for a copy fix.
7. **Resets silently.** No flames, no urgency, no celebration of milestones
   (`ui-patterns.md` Pattern 11, RestraintCard). ⚠️ `weeksWithinLines` **is a streak by
   mechanism** — a consecutive count that resets on break; what is deliberately absent is the
   packaging, corrected in both records by the SLT on 2026-10-02.
8. **The voice anchor closes the card** — `BRAND.voiceAnchor`, through `MICRO_LABELS.eyebrow`.
   Never a hardcoded brand string.

## What it does NOT render

📐 **It reads 2 of the snapshot's 4 fields** — `weeksWithinLines` and `currentWeekStatus`.
Measured 2026-11-08, so a reader does not go looking for the other two here:

| field | read here? | who reads it |
|---|---|---|
| `weeksWithinLines` | ✅ ×6 | the number, its colour, its opacity, and the zero branch |
| `currentWeekStatus` | ✅ ×1 | the `pending` `StatusBadge` only, and only above zero |
| `advancedThisWeek` | ❌ | `DashboardClient`, `SessionPopupInner`, and the session-complete OG card (`DOCTRINE-01`) |
| `tier` | ❌ | nothing, currently. The route returns it; **the tier decision is upstream** |

⚠️ **THERE ARE NO FREE-TIER CRITERIA IN THIS COMPONENT, and the item that asked for this
contract expected some.** The gating is in `app/api/discipline-ledger/route.ts`, which branches
on `tier === 'free'`. **A contract claiming tier criteria here would have been fiction** — the
exact failure `COMPONENT-CONTRACT-GATE-01` exists to stop (`session-card.md` once documented
seven props, none of which existed).

## Consumers

- `components/dashboard/MeScreen.tsx` — **the only importer.** ⚠️ `DashboardClient.tsx` names
  `LedgerCard` in a comment only; a `grep -rl` for the name reports it as a second importer and
  it is not one. The audit's arm greps the import FORM and is right.

## Gates

`components/shared/ledgerReach.test.ts` · `components/shared/momentWeight.test.ts` ·
`lib/coaching/disciplineLedger.test.ts` (the counter itself) ·
`lib/contracts/componentContracts.test.ts` (this contract vs the component's props).
