# ADR-018 — A session carries the identity of the catalogue row that produced it

**Status**: Accepted
**Date**: 2026-08-20
**Related**: ADR-010 (session catalogue), ADR-006 (hybrid generation — why the enricher may rewrite labels), D-17 / INV-CLASS (never couple logic to a display string). Blocking prerequisite for **SC-08** (v2 session-structure schema) and therefore for SC-09, SC-10's rep half, CLASSIFY-STIMULUS-01 and SIZING-REALLOC-01.

---

## Context

The session catalogue (ADR-010) holds *what to do*: `intervals_classic` is "5 × 3 min at 5K pace, 3 min jog". A generated plan session holds *what this runner does this week*: a label, a distance, a duration, a pace band, an HR band, an RPE and up to three coach's notes.

**It did not hold any reference to the row it came from.** The rep structure was re-attached at display time by matching the session's **label** against the row's **name**:

```ts
// app/dashboard/DashboardClient.tsx — twice, independently duplicated
const catalogueRow = V1_SESSION_CATALOGUE.find(r => r.name === session.label) ?? null
```

Two things rewrite labels, both by design:

1. **§22 race-specific exposure.** For a time goal, second-half quality is renamed to `"{distance}-pace intervals"` / `"…-pace progression"`. Every race-pace session in every time-goal plan is renamed.
2. **The AI enricher** (ADR-006), whose whole job includes giving sessions voice. `EnrichedWeekSchema` permits it to write `label` and `coach_notes`.

So the join failed exactly where the plan was most personalised. Measured across four representative profiles:

| Plan | Quality sessions | Failed the join |
|---|---|---|
| 10K, 4 days, time goal | 6 | 2 |
| HM, 4 days, time goal | 7 | 2 |
| HM, 3 days, finish goal | 7 | 0 |
| **Marathon, 4 days, time goal** | 9 | **5** |
| **Total** | **29** | **9 (31%)** |

A runner on a marathon time-goal plan opened five of their nine quality sessions and saw a distance, a duration and a pace band, **with no indication of what to actually do**. Finish-goal plans were unaffected — which is why this survived: it is invisible unless you look at a time-goal plan, and it gets worse the more specific the plan becomes.

`ruleEngine.ts` already carried the comment *"future: surface catalogue_id when schema permits"*. The schema permitted it; nothing had forced the issue.

## Decision

**A generated session stamps `catalogue_id` at construction. The name match is retained only as a legacy fallback.**

1. **`Session.catalogue_id?: string`** — added to `types/plan.ts` and `SessionSchema`. Optional, so the change is **additive**: legacy plans and hand-authored gists remain valid.
2. **The generator stamps it** in `makeQualitySession` and `raceSpecificLongRunSession` — every path that consumes a catalogue row.
3. **`lib/plan/catalogueLink.ts → catalogueRowFor(session)` is the single owner of the join.** It reads the stamp first and falls back to the name match only when the stamp is absent. The two duplicated call sites in `DashboardClient.tsx` now both go through it.
4. **`INV-PLAN-CATALOGUE-LINK`** (error) fires when a quality session carries no `catalogue_id` *but still matches a row by name* — the signature of a dropped stamp.

**The enricher structurally cannot break this.** `EnrichedWeekSchema` exposes only `label` and `coach_notes`; there is no path by which model output reaches `catalogue_id`. This is the same property that makes `Session.role` durable, and it is the reason the fix is a stamped field rather than a smarter matcher.

## Consequences

- **31% → 0%** of quality sessions unresolved across the four profiles above. No prescription changes: the sessions are identical, they now carry their provenance.
- **Legacy plans keep working** via the name fallback. They retain the original limitation — an unstamped *and* renamed session still cannot resolve — which is unfixable for plans already generated and is why the fallback is marked legacy-only rather than as a peer strategy.
- **SC-08 is unblocked.** A v2 step schema is pointless while the session cannot identify its own row: a shared row cannot hold "4 × 1000 m" *and* be sized per runner. Identity first, structure second.
- **The invariant is the durable part.** Without it, a dropped stamp is masked by the fallback until someone renames the session — the same silent-failure shape as the original defect.

## Alternatives considered

- **Match on a normalised label** (strip the "{distance}-pace" prefix). Rejected: it encodes §22's renaming rules in a second place, and does nothing about the enricher.
- **Denormalise the structure onto the session.** Rejected here as premature — it is what SC-08 will decide, and it needs the identity link either way to migrate.
- **Have the enricher preserve labels.** Rejected: it removes something the enricher exists to do, to work around a missing field.
