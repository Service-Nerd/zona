# MARATHON-MAINT-LABEL-01 — measurement brief

**Status: NOT SHIPPED. The ruling's mechanism does not exist, and implementing it
as written is a provable no-op.**

Detector: `npx tsx scripts/measure-marathon-maint-label.ts` (self-checking — it
asserts plans generated, because a grid that refuses everything prints a clean
table). Grid: 3 levels × 4 day-counts × 5 volumes × 3 race dates, marathon and HM,
both goals, `planStart` pinned. 675 plans.

---

## What the board ruled (batch sitting 2026-09-13, item 2)

> CORRECT WITH AMENDMENT. A time-target marathon must not be classified
> `maintenance` **solely** because the §24 peak-LR specificity floor is
> unreachable under `LONG_RUN_CAP_MINUTES` … **This relabels ~100% of time-target
> marathons (maintenance → build).**

The stated arithmetic: §24 wants `0.75 × 42.2 = 31.7 km`;
`LONG_RUN_CAP_MINUTES.MARATHON = 210`; *"210 min ≈ 30.5 km at a 4:15 easy pace"*.

## Finding 1 — the 210-minute cap is not the blocker

At the easy pace the engine actually derives for this cohort (**6.26 min/km**),
210 minutes buys **33.5 km**, which is *above* the 31.7 km floor.

| input vol | peak week | peak LR | 210-min cap allows | §52 60%-of-week allows | profile |
|---|---|---|---|---|---|
| 50 km | 75 km | 26.5 km / 166 min | 33.5 km ✅ ≥ floor | 45.0 km ✅ | maintenance |
| 70 km | 75 km | 26.5 km / 166 min | 33.5 km ✅ ≥ floor | 45.0 km ✅ | maintenance |
| 90 km | 88 km | 30.5 km / 191 min | 33.5 km ✅ ≥ floor | 52.8 km ✅ | maintenance |
| 110 km | 109 km | 31.5 km / 197 min | 33.6 km ✅ ≥ floor | 65.4 km ✅ | maintenance |

Neither the time cap nor §52's share cap is binding anywhere in the high-volume
tail. The board's own worked example — *"a runner peaking at 80 km/wk with a
30.5 km long run, plainly building"* — appears in the grid at 90 km/wk, and its
long run is **191 min against a 210-min cap**: 19 minutes of headroom.

The actual limiter is **§45's week-on-week long-run growth cap**, which the
shipped note already names in as many words: *"week-on-week long-run cap (§45)
prevented reaching the ratio."*

## Finding 2 — the exclusion as ruled flips zero plans

Implemented exactly as specified (drop `lrFails` when the floor needs more minutes
than the cap allows **and** the long run is at its ceiling): **maintenance stayed
135/135.** The two sets are disjoint —

- plans whose long run **is** at the 210-min ceiling: 45/135, and **all 45 are
  beginners**, every one of whom also trips §46 or §23;
- plans failing **§24 alone**: 27/135, and **none** is at the ceiling (their long
  runs are 134–166 min, i.e. 64–79% of the cap).

A runner at 64% of their time ceiling is not being stopped by the cap. Reverted
rather than shipped, for the reason SESSION-KM-02's brief already recorded about
its own filed fix: *do not ship it — it reads like a fix and is not one.*

## Finding 3 — what actually drives the 100%

Attributed off the diagnosis half of `volume_constraint_note` only. ⚠️ A first
pass over-attributed to §52 because the *prescription* text ("run 5 days a week
instead of 4") contains "days a week"; the numbers below exclude it.

| trigger set | plans | share |
|---|---|---|
| §23 ratio + §24 long run | 39 | 28.9% |
| **§24 long run alone** | **27** | **20.0%** |
| §46 volume | 21 | 15.6% |
| §23 ratio | 18 | 13.3% |
| §46 + §24 | 9 | 6.7% |
| §23 + §46 | 6 | 4.4% |
| §52 structural | 15 | 11.1% |

So §24 is a contributing trigger on 56% of these plans but the **sole** trigger on
20%. Even a corrected exclusion (keyed on §45 rather than the time cap) reaches at
most those 27 — **20%, not ~100%**. The flat 100% rate is produced by §23, §46 and
§52 in combination, which is the pairing the chair's original deferral named and
the batch sitting set aside.

## Finding 4 — and for 20% of them, "maintenance" looks correct

The §24-alone plans are all `experienced`, 6 days, at 20–50 km/wk, with
`longest_recent_run_km` of 7–17.5 km. §45 stops them reaching 31.7 km because a
runner whose longest recent run is 17.5 km **cannot safely build to 31.7 km in the
weeks available**. That is a genuine readiness signal, not an artefact, and
"this plan holds your fitness rather than building toward a time goal" is a fair
description of it. Dropping the trigger for them would delete information rather
than stop inventing it.

Note also that §24's ratio is not obviously wrong: `0.75 × 42.2 = 31.7 km` is the
conventional ~32 km / 20-mile peak long run (Pfitzinger, Daniels). The floor is
mainstream; what is unusual is how few Zonna marathon runners can reach it.

The one case that does look like an artefact is the knife-edge: at **110 km/wk**
the peak long run is **31.5 km against a 31.65 km floor** — labelled maintenance
by **150 metres**.

---

## What the board is actually being asked

1. **The ruling's premise is void.** `LONG_RUN_CAP_MINUTES` does not block §24's
   floor at any measured volume. Does the amendment stand with §45 substituted as
   the blocker — and if so, is §45-blocked failure a *signal* (finding 4) rather
   than noise?
2. **Is the real complaint correctness or utility?** A 100% rate is uninformative,
   but findings 3–4 suggest most of those plans are labelled correctly. If the
   label is right and merely undiscriminating, the fix is a better *label*, not a
   looser trigger — which is a different item.
3. **The 150-metre case.** Should §24's floor carry a tolerance (e.g. one
   `DISTANCE_ROUNDING_PRECISION_KM` step) so a rounding artefact cannot decide a
   cohort? This is the only unambiguous defect the measurement found.
4. **HM was never examined.** 33.3% of time-target HMs are cap-blocked on the same
   mechanism, but HM's maintenance rate is **70% and varies**, so unlike
   marathon's flat 100% it still carries information. Filed as `HM-MAINT-LABEL-01`
   pending a ruling; deliberately not folded in here.

**Recommendation:** re-open item 2 with this brief. Do not ship the amendment as
written — it cannot change any plan, and shipping a no-op that reads like a fix is
worse than leaving the item open.
