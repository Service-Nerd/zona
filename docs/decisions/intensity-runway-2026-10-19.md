# Coaching Board — the §1 yield for every build plan (INTENSITY-RUNWAY-01), 2026-10-19

**Input:** `/zona-debug` RCA of `ENVELOPE-CLOCK-01`; founder: *"Yes build"* (option 2: fix the clock, fix the engine,
gate the runway axis).

**Measured:** with every date pinned and only the runway varied, build-profile plans breached §1's plan-wide quality
ceiling at exactly 16 and 21 weeks (100K: 17 and 13 of 201 sampled), 8–11 weeks (HM, almost all 3-day) and 11 weeks
(marathon); always by one session; never at a neighbouring length. 0 of 29 checkable live plans affected.

**Conflict scan:** §1 (Amendment 1 exempts maintenance only; Amendment 2 raised 100K to 15%), §90 Amendment 1 /
COMPLIANCE-FIX-3 (the injury-only yield: convert, same duration, §9 clamp, latest-first, never race week,
`quality_downgraded`), §98 and §95 (the other two §1 yields), §22/§25 (race-specific), §26 (race week), §102.

**Seats.** Seiler: the ceiling binds and the breach is one session; use the existing converter. McMillan: latest-first
takes a time-chasing runner's sharpening; take the earliest, least specific session. Hutchinson (chair): agreed; never a
race-specific session or a time trial; injured runners keep the ruled latest-first. Willy: removing load is never the
risky direction. Sims: the 3-day HM cohort keeps its race-specific work. Blagrove: silent.

**Ruling: CORRECT WITH AMENDMENT.** §1 Amendment 3: the producer's yield applies to every build-profile plan;
`QUALITY_YIELD_ORDER` (injured `latest`, everyone else `earliest`, never race week / time trial / race-pace /
race-specific row). Checked by `INV-PLAN-INTENSITY-DISTRIBUTION`, held at every runway by `intensityRunway.test.ts`.

**Build findings (folded in, recorded here because they change behaviour):**
1. The injured yield said it used the check's count and did not (time trials counted as quality, race sessions out of the
   denominator), so it converted sessions the check never asked for. One count now serves both (`planQualityCounts`).
   Marathon envelope: 6 of 371 injured cases changed, 5 with fewer violations; fit 89.9% → 90.7%.
2. The new yield runs on a §89-gated plan only after §98's ladder has had its turn (it skips early-onset plans; the
   ladder's ungated rung still reaches it), or the ladder never acts.
3. Cohort review: BINGE-WEEK cleared at marathon 15 and 25 km/wk, clean +1.5pp at 25; one injured 15 km/wk 16-week
   finish runner moved from a race plan to §111's base-build refusal (still served a plan through §118's door). The
   old over-conversion had been keeping them under the base ceiling by accident.
4. Two guards written mid-build (a §53 variety skip, an overload-copy skip) were removed: they patched symptoms of the
   wrong count and nothing in any generated population could wake them once the count was right.
