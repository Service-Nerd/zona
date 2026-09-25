# 2026-09-25 — the sheet that gained a second cross, and the gate that could not see it

**Reported by the founder, on the device:** *"Log manually still has 2 crosses for close."*
Both top-right.

## What happened

`SHEET-CLOSE-OWNER-01` (`081029eb`) moved the close affordance into `Sheet`, because six
sheets hand-rolled three different exits — a bottom full-width "Close", a top-right cross,
and nothing at all. The intent was **one way out of every sheet**.

`ManualRunModal` already drew its own top-right cross. It was never removed. So from that
deploy until `d85c699f` (~21:00 the same day), the app's most-used modal had **two crosses,
both top-right, overlapping** — and the item was reported as shipped.

## Why the gate missed it

`sheetClose.test.ts` shipped in the same commit with an arm reading:

```ts
if (/ariaLabel="Close"/.test(src)) offenders.push(`${f} renders its own close cross`)
```

**That predicate was never wrong.** It matches the duplicate exactly. It was pointed at
`CONSUMERS` — four hand-typed paths, chosen because their filenames say "Sheet".
`app/dashboard/DashboardClient.tsx` renders **four of the app's nine sheets** and was not
among them.

> **A check is its POPULATION as much as its predicate.**

## The class, and how often it recurred

This is now a catalogue entry in `/zona-debug`: *the checker's population excludes the cases
at risk.* It happened **four times on 2026-09-25**, all in checks written that same week:

| # | Check | The set it was pointed at |
|---|---|---|
| 1 | `sheetClose.test.ts` | a hand-written list of four filenames |
| 2 | `buttonGeometry` 44px floor arm | only controls **already on** the design system — not the population that violates a floor. 18 hand-rolled controls were under 44px, smallest **18px** |
| 3 | `buttonGeometry` baseline | keyed `file:line`; one inserted line re-keyed everything below and it printed `moved: 0` — **145 of 145 orphaned** while the arm stayed green |
| 4 | `buttonOwnership` filled-control arm | anchored `color:` before the quote, so a CTA with a **conditional** (disabled-state) colour was invisible. Nine live CTAs at 3.68:1 |

**It is the inverse of "checker reads a different source from the producer."** There the value
is wrong. Here the value is right and the set is short — which is worse, because a short set
produces a green tick, and a green tick is quoted as evidence.

## Fix

- Duplicate cross removed (`d85c699f`).
- `CONSUMERS` **derived** by walking for files that import *and* render `Sheet`.
- A new arm asserts the derived set is non-trivial **and contains `DashboardClient` by name** —
  because an empty derived list passes every other arm in the file.
- **Falsified both ways:** restoring the duplicate cross turns the arm red; so does restoring
  a sticky "Close" bar. Each mutation was verified to have landed before its result was read.

## Verification, stated honestly

Production was checked directly: the live bundle at `www.zonna.run` carries `SWITCH-PRIMITIVE-01`'s
marker (so the deploy is current) and no longer contains the modal's own cross. **What could not be
verified from here: anything on a device.** The founder's client may hold a cached bundle, and the
discriminator offered was the Run-notification toggle's shape, which shipped later than the fix.
