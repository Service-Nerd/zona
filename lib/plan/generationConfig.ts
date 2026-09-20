// FREE — infrastructure
// Single source of truth for every coaching numeric used by the plan generator
// and its downstream consumers. See docs/canonical/CoachingPrinciples.md for
// the principle behind each value, and docs/architecture/ADR-009-config-driven-generation.md
// for why this file exists.
//
// Authoring rule: every value in this file has a corresponding section in
// CoachingPrinciples.md. Adding a value without a principle is a defect.
// Changing a value without updating CoachingPrinciples.md is a defect.

export const GENERATION_CONFIG = {

  // ── Polarised training (CoachingPrinciples §1) ──────────────────────────────
  // Non-elites need protection from grey zone. Measured in MINUTES, not km, so
  // time-based plans honour the same ratios.
  // BASIS CORRECTED 2026-08-20 (Coaching Board CD-19). Read the three words
  // before using this table: SESSIONS, PLAN-WIDE, CEILING.
  //
  // Was: a share of MINUTES. That was wrong, and wrong by roughly a factor of
  // two. The 80/20 finding is a SESSION-COUNT observation — about four in five
  // *sessions* below the first ventilatory threshold. Measured by time the
  // ratio is far more skewed, typically 90/10 or beyond, because easy sessions
  // are long and hard ones are short. Applying a session-count ratio to a time
  // denominator inflates the target ~2x (Seiler, in his own territory).
  //
  // The consequence of the error: the traced 10K plan delivered 9.6% quality
  // BY MINUTES against a declared 25%, and that was read for four months as a
  // 15-point under-delivery. It was not. By sessions the same plan delivers
  // exactly 25% in every phase where quality is prescribed, and 17.0% plan-wide
  // once the deliberately all-easy base phase is included. **The engine was
  // right and the config was wrong.**
  //
  // CEILING, not target — this is the coaching content, not the number. A
  // target invites the engine to close a gap it can only close in base phase,
  // which §4/§5 make all-easy on purpose; and amateurs already drift upward
  // into Z3 without encouragement, which is the failure mode this product
  // exists to prevent. A ceiling is also robust to the underlying 80/20 work
  // having been derived largely from male cohorts (Sims).
  //
  // PLAN-WIDE, not per-week — a per-week ratio would forbid the second quality
  // session at any supported week length (2 of 5 = 40%) and contradict
  // QUALITY_SESSIONS_PER_WEEK_MAX above.
  //
  // §7's 48-hour spacing remains independently binding: a plan can satisfy this
  // ceiling and still stack its hard days, which is a different defect (Willy).
  //
  // ── 100K: 12 → 15, Coaching Board CD-21 (2026-08-20) ──────────────────────
  // The six values were authored under the MINUTES basis and carried across the
  // basis change unchanged — the same class of error as the original misfiling:
  // a number surviving a change to what it means.
  //
  // Seiler: under a TIME denominator ultra training genuinely looks far more
  // skewed than 10K training, and a descending ladder 25 -> 12 is defensible.
  // Under a SESSION denominator the two CONVERGE, because the ultra runner's
  // easy sessions are long, not numerous. The descending ladder is an artifact
  // of the old unit. He can ratify ~25% as a session share for road; nothing he
  // published supports 12% for 100K on that basis.
  //
  // The failing evidence: a 24-week 6-day 100K build plan runs base 0% /
  // build 12.5% / peak 33.3% / taper 15.8% = 12.2% plan-wide. Its peak is
  // 2 quality/week — EXACTLY what QUALITY_SESSIONS_PER_WEEK_MAX grants an
  // experienced runner. At 12% this table and §8 are arithmetically
  // incompatible and the engine obeys §8. Resolved by widening §1, not by
  // weakening §8: QUALITY_SESSIONS_PER_WEEK_MAX stays distance-blind.
  //
  // 15 clears every observed build-profile 100K plan (worst 14.7%) without
  // clearing them so widely the check stops binding.
  //
  // 50K's 15% is UNCHANGED and Seiler's dissent is recorded against it: he
  // holds it carries the same discredited basis. Hutchinson (chair) prevails —
  // no 50K build-profile plan fails it, and moving numerics with no failing
  // evidence is how this config drifted from the engine in the first place.
  // A 50K build-profile breach would reopen it.
  INTENSITY_DISTRIBUTION: {
    '5K':       { max_quality_session_pct: 25 },
    '10K':      { max_quality_session_pct: 25 },
    'HM':       { max_quality_session_pct: 20 },
    'MARATHON': { max_quality_session_pct: 18 },
    // 15 -> 17 (Coaching Board CB-INTENSITY-50K-01, 2026-09-09). §1 pre-registered
    // "a 50K build-profile breach reopens it"; INTENSITY-LONGDIST-LOWDAY-01 is that
    // breach (worst delivered build share 16.3%, 13/80). Resolved by the same
    // precedent that set 100K's 15%: at ultra distances §1 yields to §8's quality
    // dose rather than the reverse. Raised MINIMALLY to clear the observed worst
    // while still binding (Hutchinson); Seiler holds 17% is a conservative floor.
    '50K':      { max_quality_session_pct: 17 },
    '100K':     { max_quality_session_pct: 15 },
  },

  // §1 — WHICH weeks form the denominator above (Coaching Board
  // CB-FOUNDATION-DENOM-01, 2026-09-10). `false` = main-plan weeks only (n >= 1);
  // §57 foundation weeks are excluded.
  //
  // §57 states foundation weeks "are never part of the main plan's periodisation
  // arc", and §22's SC-05 closure already ruled that counting them toward
  // `totalWeeks` elsewhere in validatePlan was a defect. Including them here made
  // the ceiling looser the earlier a runner generated their plan — same block,
  // same quality sessions, different verdict — and spent weeks that §57's CB-1
  // ruling defines as "habit and routine, not adaptation" inside a ratio that
  // governs adaptation.
  //
  // A flag rather than a hard-coded filter because the board recorded a live
  // dissent axis (Seiler would revisit if a cohort's delivered distribution is
  // ever assessed across the block boundary) and because flipping it is the
  // cheapest way to re-measure the trade. Read by INV-PLAN-INTENSITY-DISTRIBUTION
  // — not decorative.
  INTENSITY_DISTRIBUTION_COUNTS_FOUNDATION_WEEKS: false,

  // §90 Amendment 1 (Coaching Board S1-INJURY-DENOMINATOR-01, 2026-09-15).
  //
  // When §2's injury cap trims a week far enough that §52b day-fitting removes
  // an EASY run, §1's session-count denominator falls while the quality count
  // holds — and the plan breaches its intensity ceiling with no intensity added.
  // Measured: the same runner at 15 km/week, 12 weeks to a marathon, goes 17.4%
  // clean to 20.5% breaching on `injury_history: ['knee']` alone.
  //
  // A FLAG, NOT A THRESHOLD, and deliberately so: the threshold already exists
  // one object up in INTENSITY_DISTRIBUTION. A second number declaring the same
  // ceiling is the §25 `race_pace_pct` failure — a ratified value sitting beside
  // a duplicate nobody reads.
  INJURY_QUALITY_YIELD_TO_INTENSITY_CEILING: true,

  // ── 10% rule + recovery cadence (CoachingPrinciples §2, §3) ─────────────────
  MAX_WEEKLY_VOLUME_INCREASE_PCT: 10,
  RETURNING_RUNNER_ALLOWANCE_PCT: 15,
  RETURNING_RUNNER_GRACE_WEEKS:    3,
  // RAMP-BOUNCEBACK-01 (Coaching Board 2026-09-06, Willy-led) — the post-deload
  // bounceback is BOUNDED for injury-history runners and left UNBOUNDED for
  // healthy runners. No new numeric: injury bouncebacks are bounded by the
  // existing INJURY_WEEKLY_INCREASE_CAP_PCT (§2); healthy bouncebacks keep §2's
  // exemption (return to pre-deload). The board provisionally proposed a
  // dedicated healthy bounceback cap (~20%), but measurement across a 144-plan
  // grid found it flipped +50pp of plans to "constrained by inputs" and raised
  // the maintenance rate +7.6pp for zero safety benefit — so the healthy cap was
  // NOT added. See §2's amendment and the bounceback split in ruleEngine.ts.
  // CoachingPrinciples §79 (returning-runner intensity re-entry, 2026-08-31,
  // Coaching Board / Willy). A returning experienced runner's aerobic engine and
  // skill return weeks ahead of their musculoskeletal readiness — they FEEL ready
  // for intervals and hills before the tissue is. So when the engine lifts (or the
  // user raises) intensity for a returning/low-volume runner, the highest
  // tissue-stress quality (VO2max intervals and hill reps — both category
  // 'vo2max') is withheld for this many opening weeks; tempo/threshold carry the
  // quality load first, mirroring §21's staged reintroduction.
  RETURNING_RUNNER_INTENSITY_REENTRY_WEEKS: 4,
  // CoachingPrinciples §50 (plausibility, amended 2026-08-06; asymmetry added
  // 2026-08-31) — the UPPER tolerance. A supplied max_hr more than this ABOVE
  // the Tanaka age estimate is treated as a sensor artifact and rejected; the
  // engine falls back to the estimate and says so. §55 rejects the
  // physiologically impossible; this rejects the physiologically possible but
  // almost certainly a stray reading.
  MAX_HR_PLAUSIBILITY_DEVIATION_PCT: 15,
  // CoachingPrinciples §50 (asymmetry, 2026-08-31, HR-MAX-01) — the LOWER
  // tolerance for a device-observed or unattributed max. A recorded max is a
  // *lower bound* on the true max: below the age estimate it is a floor (the
  // highest the device happened to catch), and says nothing about the ceiling.
  // So the low-side tolerance is 0 — any device/unattributed max below the
  // estimate is rejected in favour of Tanaka. Only an explicitly user-confirmed
  // max (max_hr_source: 'user_confirmed') is trusted below the estimate.
  MAX_HR_BELOW_ESTIMATE_TOLERANCE_PCT: 0,

  // CoachingPrinciples §40c (VOL-SHORTFALL-01) — a life-first constraint that
  // suppresses the peak week by at least this much is STATED, not absorbed.
  //
  // 10%, and the bounds are measured rather than chosen. Below it is rounding
  // and phase noise: an unconstrained plan tracks its own volume curve to within
  // ~1 km/week. Above it the runner is training a materially different plan from
  // the one the engine intended — a counterfactual sweep (same profile, cap vs
  // no cap) put the median loss at 18% and the worst at 27%, i.e. a 4-day HM
  // runner with a 45-minute weekday cap peaking at 49 km where the curve wanted
  // 66 km. 52% of capped plans had more than a quarter of their weekday easy
  // runs pinned exactly at the cap; the worst had all of them.
  //
  // Deliberately not lower. McMillan: firing at 5% is noise, and notes that fire
  // on noise get ignored — which costs more than the note gains.
  //
  // The constraint still WINS. This governs what the plan says, never what it
  // prescribes; the engine does not claw the volume back onto the weekend
  // (Seiler — that converts a manageable week into a two-hard-days week, the
  // pattern this product exists to prevent).
  VOLUME_SHORTFALL_NOTE_THRESHOLD_PCT: 10,

  // VOL-STRUCTURE-01 (§23/§52) — how far the peak phase may fall below the
  // plan's maximum before the plan is declared unable to progress.
  //
  // Measured, not chosen. Inversion distribution across realistic inputs:
  // min 1.3%, median 4.2%, p75 10.6%, max 15.6%. Below 10% is dominated by
  // ROUNDING — session distances round to DISTANCE_ROUNDING_PRECISION_KM and a
  // week holds 3-6 of them — and the invariant's own note already allows a
  // plateau (holding volume from build through peak is legitimate).
  //
  // Above it the plan genuinely does not progress: the traced 10K case
  // (49km base -> 43km peak) and the 50K case (94 -> 83) both sit at ~12%.
  //
  // Ungated, this flipped 45% of realistic plans to "maintenance" including a
  // 45 km/week runner on four days. Maintenance is for runners who cannot be
  // built, not for the engine's own rounding.
  PEAK_INVERSION_MATERIAL_PCT: 10,

  // CoachingPrinciples §78 — recalibration weeks prescribe a 5K time trial.
  // The session converts the deload week's midweek easy run (same distance, so
  // weekly volume is unchanged) into warm-up / 5K hard / cool-down. `min_slot_km`
  // is the shortest easy run that can honestly contain that structure — below
  // it, no conversion happens and the week is not listed as a recalibration week.
  RECALIBRATION_TIME_TRIAL: {
    distance_km: 5,
    min_slot_km: 7,   // 5K + ~1km warm-up + ~1km cool-down
  },

  // CoachingPrinciples §64 — "six-on / one-off is the upper limit for non-elite
  // runners; seven-on is overreaching dressed as commitment." A runner who
  // selects 7 available days still gets 6 training days and one rest day.
  MAX_TRAINING_DAYS_PER_WEEK: 6,

  RECOVERY_WEEK_FREQUENCY_STANDARD: 4,
  RECOVERY_WEEK_FREQUENCY_MASTERS:  3,
  MASTERS_AGE_THRESHOLD: 45,
  RECOVERY_WEEK_VOLUME_PCT: 70,

  // §2 Amendment 2 (COMPLIANCE-FIX-2, Coaching Board 2026-09-16) — the deload
  // depth for a runner §12's volume cap governs (knee / shin-splint history).
  //
  // WHY A SHALLOWER CUT RATHER THAN A FASTER CLIMB. RAMP-BOUNCEBACK-01
  // (2026-09-06) correctly stopped injured runners taking a +43% jump out of a
  // deload by binding the bounceback to the 5% injury cap. What nobody did was
  // the arithmetic on the way back UP:
  //
  //     0.70 x 1.05^3 = 0.81   (standard 4-week cadence) -> loses 19% per cycle
  //     0.70 x 1.05^2 = 0.77   (masters 3-week cadence)  -> loses 23% per cycle
  //
  // The cut is deeper than the cap can recover before the NEXT deload arrives, so
  // the curve RATCHETS DOWN geometrically. §2's own amendment text claims "the
  // return to pre-deload volume still happens, but gradually, over the weeks that
  // follow" -- that is arithmetically impossible, and D-21 makes it a defect in
  // the principle. Measured on knee/shin plans: 67.2% detrained at standard
  // cadence, 81.7% at masters.
  //
  // DERIVED: 85 is the shallowest cut §12's 5% cap can recover within one
  // standard cadence (0.85 x 1.05^3 = 0.98). Break-even at the masters cadence
  // would need a 19.5% weekly cap, which is far past anything safe for this
  // tissue -- so the CUT had to give, not the cap.
  //
  // MEASURED, and it DOMINATES rather than trading off. Against the board's own
  // blocking gate (do not re-create the spike RAMP-BOUNCEBACK-01 removed):
  //     detraining      74.4% -> 17.5%
  //     single-week rise p95  66.7% -> 34.1%   max 133% -> 78%
  // A shallower cut needs a smaller jump back, so it is SAFER on the original
  // concern too. The alternative of simply allowing a full return was measured
  // and REJECTED by that gate: INV-PLAN-BOUNCEBACK-BOUNDED 15.6% -> 88.9%.
  //
  // ⚠️ It does NOT eliminate detraining (17.5% remains). Something else
  // contributes and is not yet traced. Do not read this as solved.
  INJURY_RECOVERY_WEEK_VOLUME_PCT: 85,

  // §2 Amendment 3 (PLAN-FITNESS-01, Coaching Board 2026-09-17) — WILLY'S
  // CONDITION, MADE MECHANICAL.
  //
  // The injury bounceback may return to pre-deload volume ONLY while the injury
  // deload is shallow enough that the return is a modest rise. At the 85% cut it
  // is +17.6%; at the old 70% cut it would be **+43%**, which is the number Willy
  // vetoed in RAMP-BOUNCEBACK-01 and would veto again.
  //
  // Gated on the constant, not on a reviewer remembering: lower
  // INJURY_RECOVERY_WEEK_VOLUME_PCT below this and the exemption withdraws
  // itself, restoring Amendment 1's capped bounceback automatically.
  INJURY_BOUNCEBACK_MIN_DELOAD_PCT:       85,

  // §24 / §80 Amendment (PLAN-FITNESS-01, Coaching Board 2026-09-17).
  //
  // Where the specificity floor starts, as a share of its PEAK value, at the
  // beginning of the build phase — ramping to 100% by the end of build.
  //
  // WHY IT EXISTS. Both specificity floors were gated on `phase === 'peak'`, so
  // a finish-goal marathoner was asked for 29.5 km (§80: 42.2 x 0.70) only in the
  // last two or three weeks, starting from §9's share of ~11 km. §45 permits
  // +5 km/week, so the climb could not finish: M1, a FIRST MARATHON WITH A
  // 24-WEEK RUNWAY, no injury and no time cap, peaked at **21 km — 50% of race
  // distance** against a 30-32 km coaching norm.
  //
  // 60 is the share of the peak floor a build phase opens at. It is not tuned to
  // a chart: §9's own build share (30% of the week) already puts a typical build
  // long run near 60% of its peak value, so this starts the ramp where the long
  // run naturally already sits and then pulls it steadily up. Below ~50 the ramp
  // does nothing (§9's share already exceeds it); above ~70 it front-loads
  // long-run distance into early build, which is the load pattern §45 exists to
  // prevent.
  //
  // ⚠️ THIS CHANGES WHEN THE CLIMB STARTS, NEVER HOW FAST IT MAY GO. §45's
  // week-on-week progression cap runs afterwards and still clamps every step.
  SPECIFICITY_RAMP_START_PCT:             60,

  // §106 Amendment (COMPLIANCE-FIX-1, Coaching Board 2026-09-16) — how far a
  // PROGRESSIVE week may fall below the plan's own week 1 before the plan is
  // detraining the runner rather than building them.
  //
  // DERIVED, NOT CHOSEN. It is the complement of RECOVERY_WEEK_VOLUME_PCT above:
  // §3 sanctions a deload at 70% of the prior week, so a 30% drop is the largest
  // reduction this constitution anywhere calls legitimate. A base/build/peak week
  // that falls FURTHER than a sanctioned deload is not a training week. Tying the
  // two means the floor moves if §3's deload depth ever moves, rather than
  // drifting apart as two independently-chosen numbers.
  //
  // MEASURED ON THE RIGHT SET, which took three attempts and is the reason the
  // number is 30 and not 50. Decline is compared against base/build/peak weeks
  // only:
  //   · RACE WEEK excluded — it contains the race (§106's own masking bug, fixed
  //     the same day in COMPLIANCE-FIX-0).
  //   · DELOAD weeks excluded — §3 makes them low ON PURPOSE.
  //   · TAPER weeks excluded — §6 makes them low ON PURPOSE. Including the taper
  //     put the median at 47%; it is 35% without it, and M5's lowest week was a
  //     TAPER week while its actual defect was a build week.
  // Across all 15,973 sweep plans the median decline is 0% and p75 is 14%, so 30%
  // sits well into the tail and does not catch ordinary week-to-week variation.
  // At 30%: 2,425 plans (15.2%) breach — 2,046 carrying the "maintains your
  // fitness" claim and 379 saying nothing at all.
  MAX_DELIVERED_DECLINE_PCT: 30,

  // ── Phase structure (CoachingPrinciples §4, §5) ─────────────────────────────
  // Specificity rises as the race approaches.
  // §93 (Coaching Board CB-SPEC-01, 2026-09-07) — how many VO2max exposures the
  // PEAK phase may carry for a short-distance plan. CD-16 already fixed the
  // number in prose — "one build exposure ... plus peak's two: three spread
  // exposures" — but nothing enforced it: `preferredQualityCategory` returned
  // 'vo2max' for EVERY 10K peak week, and CD-16's arithmetic silently assumed
  // peak was two weeks long. Once §91 shortened base, peak grew to five weeks
  // and the same unbounded return produced FIVE consecutive VO2max sessions for
  // a 44-year-old — with zero race-pace work before the taper.
  PEAK_MAX_VO2MAX_SESSIONS: 2,

  SPECIFICITY_BY_PHASE: {
    base:  { general_pct: 100, specific_pct: 0 },
    build: { general_pct: 70,  specific_pct: 30 },
    peak:  { general_pct: 40,  specific_pct: 60 },
    taper: { general_pct: 30,  specific_pct: 70 },
  },

  // Phase distribution as % of total plan weeks. Taper is the remainder, set by
  // TAPER_BY_DISTANCE.days converted to weeks.
  // §5 — base 35%. CB-PHASE-01 ruled 35 -> 30 on 2026-09-04 and the change was
  // BUILT, MEASURED AND REVERTED before shipping. It is not a bad idea; it is
  // blocked behind RAMP-BOUNCEBACK-01.
  //
  // What the measurement found, on the §2 knee-injury archetype:
  //   base 35:  45 45 48 38* 48 49 53 46* 50 56 59   worst jump W5 +26%
  //   base 30:  45 45 48 38* 39 51 50 46* 53 56 60   worst jump W6 +31%
  //
  // The +26% at 35% is already far above §2's 17% injury cap. It passes only
  // because it is the week AFTER a deload, and §2 exempts a post-deload
  // bounceback from the cap (correctly — returning to a volume held two weeks
  // ago is not a spike). Shortening base moves the phase boundary, which
  // suppresses that bounceback and pushes the recovery into the FOLLOWING week,
  // where the same rise is no longer a bounceback and is no longer exempt.
  //
  // So the shorter base did not create the spike. It UN-MASKED one that the
  // exemption was already hiding — which means whether a 30% jump is legal
  // currently depends on where the phase boundary happens to fall. Fix that
  // first (RAMP-BOUNCEBACK-01), then re-take this ruling.
  PHASE_DISTRIBUTION: {
    base_pct:  35,
    build_pct: 35,
    peak_pct:  15,
  },

  // §89 (Coaching Board 2026-09-06) — EXPERIENCE-GATED QUALITY ONSET. A
  // demonstrably-ready runner (experienced intensity + real base + deep training
  // age + NOT returning/fresh/injured + `recent_quality_training: 'regular'`) does
  // not need the full base to rebuild an aerobic engine they already have. Their
  // base uses this SHORTER fraction so build (and quality) starts ~2 weeks sooner.
  // Base STAYS ALL-EASY — this is NOT the vetoed base-primer (§88), no quality is
  // added to base, it is simply shorter. Adds ZERO tonnage (peakKm unchanged,
  // §79). The 2-week floor is the existing `Math.max(2, …)` in computePhases
  // (Seiler's condition: keep a short polarised on-ramp). Beginners/returners/
  // injured runners keep base_pct=35, gated by `earlyQualityOnset`. Enforced by
  // INV-PLAN-EARLY-ONSET-GATED.
  EARLY_ONSET_BASE_PCT: 15,
  // §89 — the base phase never drops below this many weeks, however ready the
  // runner (Seiler's condition: keep a short polarised on-ramp). This was a
  // hardcoded `Math.max(2, …)` in computePhases; named here because the invariant
  // and the phase builder must agree on it (Configuration Singularity).
  MIN_BASE_WEEKS_FLOOR: 2,
  // §97 (CB-ONSET-03) — the on-ramp floor for the §89-GATED cohort only.
  // Everyone else keeps MIN_BASE_WEEKS_FLOOR (2). Seiler accepts one week for a
  // runner whose gate requires `recent_quality_training: 'regular'`; he refuses
  // zero, which is what this constant existing rather than being deleted means.
  MIN_ONRAMP_WEEKS_GATED: 1,
  // §97 Amendment (LONG-RUNWAY-EARNS-PLAN-01, Coaching Board 2026-09-16) — how
  // many weeks ANY plan may gain over `idealWeeks` when the calendar has surplus.
  //
  // RENAMED from MAX_ONSET_PLAN_EXTENSION_WEEKS. The headroom is no longer
  // onset-scoped: the board granted it on surplus rather than on §89's gate, and
  // a key whose name asserts a scope it no longer has is the decorative-config
  // failure running backwards — the name reads as governance and governs nothing.
  //
  // §1 is a CEILING the board has twice refused to spend, and this exists so an
  // extension can never be the thing that spends it.
  //
  // ⚠️ CORRECTED 2026-09-16 — the arithmetic this comment used to carry was
  // measured against the WRONG ideal. It read "the headroom is NOT uniform: 2
  // weeks for 5K/10K/HM but 4 for MARATHON/50K/100K", which is the gap against
  // `PLAN_SIGNATURES.ideal_weeks`. `calcPlanLength` has never read that field —
  // it reads `DISTANCE_CONFIGS.idealWeeks` in length.ts, which
  // `configConsumer.test.ts` already records as superseding it. Against the ideal
  // the code actually uses, the headroom is +2 at 10K/HM/MARATHON/50K/100K and
  // **+0 at 5K** (ideal 12, max 12).
  //
  // So this bound DOES NOT BIND AT ANY DISTANCE TODAY, and saying so is the point
  // (§34): it is a guard against a future `max_weeks` being raised, not an active
  // constraint, and nobody should read its green check as evidence it is doing
  // work. The §1 breach that motivated it (18.4%, 19/103) was real and was
  // measured on the GATED path, where `EARLY_ONSET_BASE_PCT` caps base at one
  // week so every gained week lands in build/peak. That mechanism is untouched:
  // the ungated extension leaves `base_pct` alone (Willy's binding condition), so
  // its weeks grow base proportionally and §1's denominator grows with them.
  MAX_PLAN_EXTENSION_WEEKS: 2,
  // §97 — the shortened on-ramp applies only at these distances.
  //
  // NOT arbitrary, and not "the founder races 10K". §1's ceiling DESCENDS with
  // distance (25% for 5K/10K, 20% HM, 18% MARATHON, 15% 50K, 12%→15% 100K),
  // while a shorter base moves every freed week into build/peak and pushes the
  // quality share UP. So the shortened on-ramp is affordable exactly where the
  // ceiling is loosest, and unaffordable where it is tightest — measured, a
  // marathon went to 18.4% against its 18% ceiling on one extra quality session
  // (19/103 vs 18/103).
  //
  // The load argument points the same way (Willy): a marathon's base phase
  // carries the long-run progression, so it is the phase least able to spare a
  // week. Long-distance runners keep MIN_BASE_WEEKS_FLOOR unchanged.
  ONSET_SHORT_ONRAMP_DISTANCES: ['5K', '10K', 'HM'] as const,
  // §97 Amendment 1 (INTENSITY-3DAY-01, 2026-09-09) — the distance list above
  // was the RIGHT axis, measured against an INCOMPLETE grid. Affordability of the
  // shortened on-ramp is a function of BOTH the ceiling (distance) AND the §1
  // DENOMINATOR (running sessions ≈ days_available × weeks). §97 controlled for
  // distance and never for days, because the property sweep samples axes
  // independently at random and never crossed `days_available: 3` with the full
  // §89 gate. Result: a 3-day 10K and a 4-day HM declaring `experienced` shipped
  // 27.3% / 21.2% quality against 25% / 20% ceilings — §1 breached in production.
  //
  // The shortened on-ramp drives ~1 quality session per running week in build+
  // peak, so it is affordable only where the distance ceiling permits AT LEAST
  // one quality session in a week the runner actually runs: ceiling_fraction ×
  // days_available ≥ this value. Below it, ~1 quality/week necessarily exceeds
  // the ceiling. Measured, this separates every breaching cell (10K@3d = 0.75,
  // HM@4d = 0.80) from every safe one (≥ 1.0) with no residual and no
  // over-denial of the 4-day-10K / 5-day-HM cases §97 already cleared. When the
  // gate denies, base falls back to §91's two-week floor (onset one week later,
  // still ~2 weeks sooner than a non-gated runner) — §89's benefit is trimmed,
  // never lost. §1 is a CEILING the board has twice refused to spend; the
  // on-ramp yields, not the ceiling (same disposition as the distance list).
  ONSET_SHORT_ONRAMP_MIN_WEEKLY_QUALITY_HEADROOM: 1,
  // §98 (Coaching Board CB-ONSET-YIELD-01, 2026-09-10) — how many rungs the §1
  // yield ladder may walk before falling back to the ungated plan.
  //
  // A SAFETY STOP, NOT A TUNING KNOB. The real bound is the ungated runner's
  // effective on-ramp (§91: base + §57 foundation weeks) — the ladder stops
  // there regardless of this value, because walking past it re-creates §91's
  // non-monotonic onset (measured: one runner finished LATER than if they had
  // never demonstrated readiness at all). This constant only stops an unbounded
  // loop if that comparison is ever wrong.
  //
  // Measured max rung actually needed across a 240-plan grid: 3 (13 plans
  // resolved at rung 1, 16 at rung 2, 4 at rung 3, 1 fell through to ungated).
  // 4 leaves one rung of headroom without letting a runaway loop regenerate a
  // plan a dozen times.
  ONSET_YIELD_MAX_RUNGS: 4,
  // §40b Amendment 2 (Coaching Board CB-TERRAIN-01, 2026-09-09) — the runner's
  // ENVIRONMENT terrain values for which the plan tells them to let effort/HR
  // lead and treat pace targets as a road reference. NOT a pace multiplier: §40b
  // forbids inventing a number the runner cannot act on, and trail pace swings too
  // far with grade/footing for a 3-way enum to price. `road` is the pace-anchor
  // baseline and gets no note. A coach could reasonably decide `mixed` should not
  // trigger it — hence config, not inline.
  TERRAIN_EFFORT_GOVERNS: ['trail', 'mixed'] as const,
  // §91 (Coaching Board CB-ONSET-02, 2026-09-07) — for a §89-gated runner, base
  // is capped in WEEKS, not only as a fraction. `EARLY_ONSET_BASE_PCT` is a
  // percentage, so a LONGER plan re-grew the base it was meant to shorten: a
  // 14-week plan gave base 3, a 12-week plan gave base 2. The runner who
  // entered their race earlier was punished for it. A demonstrated base does
  // not need more on-ramp because the race is further away.
  // §97 (Coaching Board CB-ONSET-03, 2026-09-07) — 2 -> 1. Seiler's on-ramp
  // floor, re-taken eight days after §89 set it, on the specific question of
  // whether "a short polarised on-ramp" means two weeks or one for a runner
  // whose gate REQUIRES `recent_quality_training: 'regular'`. For someone doing
  // intervals or tempo most weeks, a two-week cessation of intensity is
  // detraining, not on-ramping. Seiler accepts one; he refuses zero, and the
  // floor below still forbids it. Willy's condition of approval is that the
  // opening quality exposures are threshold-domain — see REENTRY_WEEKS_ONE_WEEK_ONRAMP.
  EARLY_ONSET_BASE_MAX_WEEKS: 1,
  // §97 — Willy's condition. A one-week on-ramp gives tissue very little
  // settling time before the first hard session, because week 1 of any plan is
  // a change of stimulus even when it is all easy (new volume curve, new days,
  // new structure). So quality may start in week 2, but the opening exposures
  // lead with tempo/threshold and VO2max/hills are withheld this long — reusing
  // §79's existing intensity re-entry rather than inventing a second mechanism.
  REENTRY_WEEKS_ONE_WEEK_ONRAMP: 2,
  // §96 (Coaching Board CB-HSR-01, 2026-09-07) — `hard_session_relationship:
  // 'overdo'` is a BRAKE. Measured across training_age x distance x injury, it
  // was byte-identical to 'neutral' in EVERY cell: four wizard options, one of
  // which could never change anything for any runner. Its label — "I overdo it.
  // Rein me in." — is the only one asking for protection rather than more work,
  // and it is the persona the whole product is built around ("You're trying
  // hard. That's the problem"). Two effects, both §1-safe and neither adding or
  // removing tonnage: it VETOES §89/§91 early quality onset, and it puts the
  // §24c Z2-ceiling cue on every easy run rather than only build long runs.
  OVERDO_IS_A_BRAKE: true,
  // §89 Lever A — a returning runner whose tissue is demonstrably conditioned
  // (`recent_quality_training: 'regular'`, injury-free) has the §2196 re-entry
  // withholding SHORTENED to this many weeks, not zeroed (Willy: one week of
  // tempo-first is cheap insurance; the VOLUME ramp caution is untouched).
  REENTRY_WEEKS_TISSUE_READY: 1,

  // ── Taper (CoachingPrinciples §6) ───────────────────────────────────────────
  // Maintain intensity, cut volume, never detrain.

  // ── Taper recalibration (CoachingPrinciples §68) ────────────────────────────
  // A taper is a reduction from what the body is adapted to — not from what was
  // planned. If the runner completed <TAPER_RECAL_VOLUME_THRESHOLD_PCT of their
  // intended peak, the written taper targets are proportionally too high. On
  // entering the taper phase, the engine re-anchors all taper week volumes to
  // the runner's functional peak (avg of top TAPER_RECAL_FUNCTIONAL_PEAK_WEEKS
  // actual weeks) using the same reduction % as the original plan.
  //
  // Only downward recalibration is applied (overperformance is handled by the
  // existing benchmark recalibration path). Race week is never touched.
  TAPER_RECAL_VOLUME_THRESHOLD_PCT:    85,  // recalibrate if actual < 85% of planned
  TAPER_RECAL_FUNCTIONAL_PEAK_WEEKS:    2,  // avg of top N actual weeks → protects against outliers
  TAPER_RECAL_MIN_WEEKS_DATA:           2,  // minimum data weeks required to fire

  TAPER_BY_DISTANCE: {
    '5K':       { days: 10, volume_reduction_pct: 35, keep_quality: true },
    '10K':      { days: 10, volume_reduction_pct: 35, keep_quality: true },
    'HM':       { days: 14, volume_reduction_pct: 45, keep_quality: true },
    'MARATHON': { days: 21, volume_reduction_pct: 55, keep_quality: true },
    '50K':      { days: 21, volume_reduction_pct: 55, keep_quality: true },
    '100K':     { days: 28, volume_reduction_pct: 60, keep_quality: true },
  },

  // CoachingPrinciples §6 (CD-5) — a low-volume runner has little accumulated
  // fatigue to shed, so the standard taper cut over-tapers them into detraining.
  // When peak weekly volume is below the threshold, the taper cut is scaled
  // shallower (they keep more of what little base they have). This scales the
  // DEPTH of the cut, not the NUMBER of taper weeks — the latter feeds plan
  // length and the race-date invariant, so it is left structural-stable.
  LOW_VOLUME_TAPER_THRESHOLD_KM:         40,
  LOW_VOLUME_TAPER_REDUCTION_FACTOR_PCT: 70,   // % of the standard cut for low-volume runners

  // CoachingPrinciples §6 Amendment 2 (Coaching Board TAPER-DEPTH-02,
  // 2026-09-15) — §6's cut is a percentage of the week the runner ACTUALLY DID,
  // not the week the volume curve intended.
  //
  // MEASURED, and the first diagnosis of this was wrong in a way worth recording.
  // The taper was blamed for "barely reducing". It does not: the taper curve is
  // correct (traced HM 65 -> 50 -> 36, marathon 50 -> 41 -> 32 -> 22, 100K
  // 90 -> 72 -> 54 -> 36) and the taper DELIVERS it — delivered/curve 0.99-1.02.
  // The PEAK phase delivers 0.70-0.90 of its curve (§23/CD-10: the long run pinned
  // at LONG_RUN_CAP_MINUTES, easy pinned by §9's ratio — accepted, the caps do not
  // move). So a taper week whose CURVE sits 23% below peak arrives 2% below the
  // peak the runner actually ran. Worst measured: an HM plan peaking at 45.5 km
  // with a first taper week of 44.5 km, against a configured 22.5% first step.
  //
  // On 504 plans, 86 (17.1%) carry a first taper week above 90% of the peak
  // phase. 74 are already honest — `volume_profile: 'maintenance'` with a
  // `volume_constraint_note`. **12 (2.4%) are classified `build` and say
  // nothing.** Those are what this re-anchor is for.
  //
  // Expressed in PERCENTAGE POINTS OF THE ANCHOR WEEK, not as a ratio of the
  // taper week, because the question is "how much of the promised cut
  // evaporated". Below the gate the shortfall is rounding across 3-6 sessions
  // and re-cutting it would be relabelling noise as coaching (NOISE-GATE-01).
  TAPER_DELIVERED_REANCHOR_MATERIAL_PCT: 5,

  // Race week volume — applied to the LAST week of every plan. Shakeouts only;
  // independent of TAPER_BY_DISTANCE.volume_reduction_pct (which governs the
  // full taper weeks BEFORE race week).
  RACE_WEEK_VOLUME_PCT: 18,

  // ── Post-race recovery (CoachingPrinciples §62) ─────────────────────────────
  // After a planned race, the engine reshapes remaining plan weeks with a
  // structured recovery curve before returning to quality training.
  //
  // quality_blackout_weeks: weeks after race where ALL quality/interval/tempo/
  //   long sessions are converted to easy recovery (no stimulus, full absorption).
  //   The body cannot distinguish genius from stupidity when this tired.
  //
  // volume_curve_pct: target weekly volume as % of plan peak weekly_km,
  //   week-by-week through the recovery window. Index 0 = race_week+1.
  //   Sessions beyond the curve resume normally; the AI adds coach notes on
  //   the first quality session back.
  //
  // Principle: volume drops sharply at week+1, recovers conservatively.
  // Quality sessions are the last thing to return — they require absorbed,
  // rested legs to do adaptive work. Returning too fast after a marathon
  // is how stress fractures happen. (CoachingPrinciples §62.)
  POST_RACE_RECOVERY_BY_DISTANCE: {
    '5K':       { quality_blackout_weeks: 1, volume_curve_pct: [30, 55] },
    '10K':      { quality_blackout_weeks: 1, volume_curve_pct: [30, 55] },
    'HM':       { quality_blackout_weeks: 1, volume_curve_pct: [25, 45, 65] },
    'MARATHON': { quality_blackout_weeks: 2, volume_curve_pct: [20, 35, 55, 70] },
    '50K':      { quality_blackout_weeks: 2, volume_curve_pct: [15, 30, 50, 65] },
    '100K':     { quality_blackout_weeks: 3, volume_curve_pct: [10, 25, 40, 55, 70] },
  } as const,

  // Strength sessions — flagged off until R21 ships full content.
  // When false: engine skips strength placement entirely (frees up day slots
  // for easy fillers, preventing "1 run/week" plans for low-volume runners).
  // When true: engine schedules 1–2 strength sessions per week per phase (legacy
  // behaviour). See backlog § R21 — Strength Sessions.
  STRENGTH_ENABLED: false,

  // ── Quality session sizing (CoachingPrinciples §8 — SC-10 / CD-14) ──────────
  //
  // STILL A FLAT SHARE, and that is now a RECORDED DEFECT rather than an
  // unexamined default. CD-14 ruled category-specific sizing correct; the
  // implementation was built, measured against the property sweep, and DID NOT
  // SHIP. What the sweep found is worth more than the number would have been.
  //
  // The defect it was meant to fix is real. Delivered MAIN SET on the traced
  // 12-week 10K (session minus the warm-up floor and cool-down):
  //
  //     vo2max     W9 30 min,  W10 32 min    <- the LARGEST sessions in the plan
  //     race pace  W6 22 min,  W7  26 min
  //
  // The coaching truth is the reverse — 25 minutes of threshold is a normal
  // session, 25 minutes of VO2max is a race — so the flat share INVERTS the
  // ordering. Tracked by INV-PLAN-MAIN-SET-ORDERING (warn), which is exactly the
  // §34 position: declared AND exercised, with the value open.
  //
  // WHY THE FIX DID NOT SHIP, and it is not a calibration problem. Sizing keys
  // off WEEKLY VOLUME, so the biggest sessions land in the biggest weeks whatever
  // their category — and VO2max is scheduled in peak, the biggest weeks of all.
  // A category percentage can only offset that by going low enough to drive
  // sessions under MIN_SESSION_DISTANCE_KM. Swept 13-17% for vo2max; 15% passed
  // the canonical 10K archetype and then failed at scale across 18,056 plans:
  // 187 ordering breaches, 220 sessions under the size floor, 37 peak inversions.
  //
  // ⚠️ CORRECTION (2026-08-20, same day). An earlier version of this comment
  // explained the peak inversions as "volume freed by shrinking the quality
  // session has nowhere to go, because the easy runs are already at their §9
  // ceiling, so it is LOST from the week". THAT WAS WRONG, and it was written
  // from reasoning rather than measurement.
  //
  // Measured: the §9 redistribution below (`easyKm = (weeklyKm - totalQualVol) /
  // (minRatio + easyCount)`) PRESERVES total weekly volume. Sweeping the quality
  // share 18% -> 15% -> 12% on a 5-day profile moved the week's delivered volume
  // by 0 km. Freed volume is not lost; it is redistributed, exactly as intended.
  //
  // The real shortfall mechanism is unrelated to quality sizing and is filed
  // separately as VOL-SHORTFALL-01: on constrained profiles the week cannot
  // reach its volume target at all, and `max_weekday_mins` is the usual binding
  // constraint. Isolated: same plan at max_weekday_mins 60 -> 43 km peak week,
  // at 90 or unset -> 46 km, the target. That is the runner's own life-first
  // constraint being honoured correctly; the defect is that the plan never says
  // so.
  //
  // WHAT SURVIVES THE CORRECTION: the decision to reject category sizing. It
  // rests on the 187 ordering breaches and 220 undersized sessions, which are
  // independent of why any §23 check tripped. The conclusion stands; the stated
  // mechanism for one class of failure did not.
  //
  // Quality session distance as % of weekly volume (single source — was hardcoded
  // 0.18 in multiple places before). When two quality sessions in a peak week,
  // the second is scaled down by SECONDARY_QUALITY_PCT_OF_PRIMARY.
  QUALITY_SESSION_PCT_OF_WEEKLY:    18,
  SECONDARY_QUALITY_PCT_OF_PRIMARY: 80,

  // VO2max main-set ceiling, in minutes (CoachingPrinciples §8, SC-10 / CD-14,
  // Coaching Board 2026-08-21). VO2max is the least sustainable work per minute,
  // so its main set is capped ABSOLUTELY — decoupled from weekly volume, which is
  // what let the flat 18% share inflate it to a p50 of 25 min and grow it into
  // peak (the worst place for accumulated fatigue). 20 min is ~6×3 or 5×4 at true
  // I-pace: a real dose, deliberately below elite tolerance because the user is
  // not an elite (Hutchinson), and set to protect the slowest-recovering runner
  // since the ceiling cannot yet be sex- or fitness-aware (Seiler/Sims). A ceiling
  // caps only the excess; a naturally-short VO2max session is untouched. Applies
  // to paced flat intervals, NOT effort-governed hills (lower impact, SC-09).
  VO2MAX_MAIN_SET_MAX_MINS:         20,

  // ── Effort-governed session sizing (§40b Amendment 2, Coaching Board 2026-09-04) ──
  //
  // An effort-governed row (`hill_reps`, `vert_hike_repeats`) prescribes steps whose
  // length is deliberately OPEN — "until ready" at the top of a climb, "to the bottom
  // of the hill" at the start. Those are real minutes the runner spends, and until
  // this ruling nothing priced them: the session was sized as distance ÷ easy pace,
  // which produced a stated 39 minutes for a session whose own reps alone need 24
  // inside a 20.1-minute main-set allocation. Incoherent in 258 of 428 `hill_reps`
  // placements (60.3%).
  //
  // ⚠️ THESE SIZE THE SESSION. THEY ARE NEVER PRESCRIBED TO THE RUNNER.
  // "Until ready" stays on the card — self-regulation against the gradient is the
  // whole reason the session works on a day when the legs are flat (McMillan), and
  // putting a stopwatch number in its place builds a different, worse session. This
  // follows the pattern already in `makeQualitySession`, which estimates hill
  // duration against easy pace and explicitly does not surface it as a target.
  //
  // NEITHER VALUE HAS LITERATURE BEHIND IT (Sims, recorded). Four practitioners
  // agreeing is better than one and is still not a measured number.
  //
  // 60s, not 45: the descent is already priced (a `mirror` step), so this is only the
  // pause at the top before trusting the legs downhill. The board chose the value on
  // ERROR ASYMMETRY rather than physiology — being 15s/rep long costs the runner
  // nothing, being 15s short costs them the number they planned their evening around,
  // and the under-statement has a sex-linked tail through under-fuelling (Sims).
  // Willy concurred on eccentric control; McMillan dissented at 45 and accepted the
  // asymmetry argument. Recorded in CoachingPrinciples §40b.
  EFFORT_GOVERNED_RECOVERY_SECS:    60,
  // 2, not 5: for most runners the 15-minute warm-up IS the run to the hill, so a
  // separate 5-minute approach double-counts it (McMillan, unopposed). This is the
  // gap between finishing the strides and starting rep one.
  EFFORT_GOVERNED_TRANSITION_MINS:  2,

  // VO2max WORK-minute band (SC-08 vo2max, Coaching Board 2026-08-21). Once the
  // flat VO2max rows are v2, the dose is time AT Z4-5 (work), not the main set
  // including recovery — full recovery is never shortened to fit reps (Willy/
  // Sims), so a main-set budget leaves no room for a rep progression. The rep
  // COUNT fills a target inside this band; below the floor it is not a VO2max
  // stimulus (Hutchinson/Sims, RED-S-adjacent), above the ceiling it steals from
  // tomorrow's easy volume (Seiler). Bounded at BOTH ends.
  VO2MAX_WORK_MIN_MINS:             12,
  VO2MAX_WORK_MAX_MINS:             18,
  // Target work minutes by fitness × phase — the count PROGRESSES by readiness
  // and block position, NOT by weekly volume (the SC-10 error the board refused
  // to re-import). Beginners get no VO2max (§8), so only intermediate/experienced.
  // NO `beginner` band, deliberately (§79, Coaching Board 2026-09-02). A true
  // beginner has QUALITY_SESSIONS_PER_WEEK_MAX = 0 and no eligible VO2max row,
  // so they never reach this table. A structurally-beginner runner arrives here
  // only via a LIFTED intensity (returning runner), at which point `intermediate`
  // is the correct band — an invented beginner band would be a number with no
  // principle behind it (INV-CFG). The `?? VO2MAX_WORK_MIN_MINS` fallback at the
  // read site is a genuine backstop, not the routine path: this table is indexed
  // by the INTENSITY level, never the structural one. Indexing it structurally is
  // what made a session selected at `intermediate` get sized at the floor.
  VO2MAX_WORK_TARGET_MINS: {
    intermediate: { build: 12, peak: 15 },
    experienced:  { build: 15, peak: 18 },
  } as Record<string, Record<string, number>>,

  // Threshold/race-pace WORK-minute band (Coaching Board 2026-09-03) — the
  // SC-08 vo2max pattern above, generalised to `category: 'threshold'` and
  // `'race_specific'` paced-rep rows. Found because `tenk_pace_intervals`
  // (4×1200m @ goal pace / 2min jog) was sized at the flat 18%-of-weekly
  // path — 25 min for content needing ~27.6 min, the same sizing-incoherence
  // class CD-14 already fixed for VO2max, just never extended past it.
  //
  // Threshold pace is sustainable far longer per minute than VO2max — Seiler's
  // correction during the board sitting — so this band sits meaningfully
  // higher than VO2MAX_WORK_*, matching classic 20-30 minute tempo/threshold
  // prescriptions rather than reusing VO2max's 12-18 minute band.
  THRESHOLD_WORK_MIN_MINS:          15,
  THRESHOLD_WORK_MAX_MINS:          30,
  THRESHOLD_WORK_TARGET_MINS: {
    // CB-BEGINNER-CATALOGUE-01 (2026-09-19) — the beginner rung. §8's config
    // block has said "light tempo only after week 4" since the original spec
    // while its own value made light tempo impossible; this is the dose that
    // sentence always implied. Set by the ladder's OWN step (each level is
    // roughly +20-25% on the one below, so beginner steps DOWN by the same),
    // and the board recorded that the evidence for these two numbers is
    // PROPORTIONALITY AND NOTHING ELSE — there is no external source for 14
    // any more than there is for 18.
    beginner:     { build: 14, peak: 17 },
    intermediate: { build: 18, peak: 22 },
    experienced:  { build: 22, peak: 26 },
  } as Record<string, Record<string, number>>,

  // Per-row work-dose override (CoachingPrinciples §85) — Coaching Board
  // CB-CAT-01, 2026-09-04.
  //
  // A row keyed here uses its OWN work-minute band instead of its category's.
  // Exists because Sims's amendment is correct and unavoidable: 22 minutes of
  // over-unders is not 22 minutes of steady threshold. Half an over-under's
  // work sits ABOVE threshold, so pricing it against `THRESHOLD_WORK_TARGET_MINS`
  // would prescribe the same minutes at a materially higher load and call that
  // equivalence a coaching decision when it is really an accounting accident.
  //
  // Keyed by row id, matching the existing precedent for `progressive_tempo`
  // (there is no structural signal in the v2 schema that says "this shape costs
  // more per minute", and inventing one to avoid naming a row would be a worse
  // lie than naming it). A row absent from this map uses its category band —
  // the default stays the rule, this is the exception list.
  // Roughly 80% of the steady-threshold band at every cell. Not a tuned number:
  // it is the ratio that keeps TOTAL physiological cost near a steady threshold
  // session once half the work moves above T, which is the equivalence the band
  // is supposed to express.
  SESSION_WORK_OVERRIDE_MINS: {
    tempo_over_under: {
      min: 12,
      max: 24,
      target: {
        intermediate: { build: 15, peak: 18 },
        experienced:  { build: 18, peak: 21 },
      },
    },
  } as Record<string, { min: number; max: number; target: Record<string, Record<string, number>> }>,

  // Deload placement policy (CoachingPrinciples §87) — Coaching Board
  // CB-DELOAD-01, 2026-09-04.
  //
  // §3 sets the CADENCE (every 4th week, masters every 3rd). This sets where
  // those weeks are allowed to LAND. The cadence was computed from absolute
  // week number and knew nothing about phase boundaries, so a deload fell on
  // the FIRST WEEK OF BUILD in 25% of measured plans — dropping volume 30-41%
  // at the moment the plan says the hard work begins, and pushing the first
  // quality session back a week.
  //
  // Not one of those placements was chosen; they were decided by where week 1
  // happened to fall relative to the phase split.
  DELOAD_PLACEMENT: {
    // A deload may not open a phase. Enforced by shifting the cadence EARLIER
    // and re-anchoring from there — never by deleting a recovery week.
    allow_on_phase_first_week: false,
    // The runner arrives fresh INTO a new block rather than being deloaded on
    // its opening week — the placement every seat called good practice.
    prefer_week_before_boundary: true,
    // Sims's amendment. A shift must not lengthen a loading block beyond what
    // the cadence already promised (recoveryFreq - 1 loading weeks). This is
    // why a naive +/-1 shift is unimplementable: moving a deload one week in
    // EITHER direction lengthens the block on the other side, so both are
    // rejected and nothing moves. Re-anchoring is what satisfies it.
    max_loading_weeks_over_cadence: 0,
    // §95 — a deload should not sit at phase position 2 either (one week of a
    // new stimulus, then recovery from it). A PREFERENCE, not a ceiling: §95
    // Amendment 1 (Coaching Board 2026-09-15) makes it yield to any ratified
    // ERROR the §87 placement does not also carry, because re-locating a deload
    // changes session composition (marathon [4,8,12] -> [2,6,10]: +1 hard, -3
    // running, §1 19.6% vs an 18% ceiling).
    avoid_phase_second_week: true,
    // HARD, and never traded for the preference above (Willy). The first
    // implementation produced back-to-back recovery weeks — [3,6] -> [3,4,7] —
    // because its count test degenerates at the masters cadence of 3, and 453
    // plans flipped to a do-nothing maintenance plan before it was reverted.
    allow_adjacent_deloads: false,
    // Willy's amendment, REVISED at ratification. Originally "count preserved
    // exactly" — written to stop recovery being traded away for earlier
    // intensity. Measured, re-anchoring never removes a deload and in ~10% of
    // plan shapes ADDS one, because the raw cadence was under-delivering what
    // §3 promises: an 8-week masters plan produced a single recovery week
    // ({3}) since week 6 fell in peak and week 9 did not exist. {2,5} is the
    // 3:1 cadence actually being honoured. So the rule is a DIRECTION, not an
    // equality — recovery may rise, never fall.
    recovery_weeks_may_decrease: false,
  },

  // Progressive tempo (continuous shape, not reps) — Coaching Board
  // 2026-09-03. `progressive_tempo`'s v1 description ("30 min Z2→Z3") has no
  // rep count to scale, so it doesn't use the WORK_MIN/MAX/TARGET band
  // pattern above — the board ruled its v2 structure is a fixed-length
  // continuous progression, sized by fitness × phase directly, same shape
  // as `VO2MAX_WORK_TARGET_MINS`/`THRESHOLD_WORK_TARGET_MINS` minus the
  // reps-count derivation those two need.
  PROGRESSIVE_TEMPO_MAIN_MINS: {
    // CB-BEGINNER-CATALOGUE-01 — see THRESHOLD_WORK_TARGET_MINS above for the
    // derivation and its stated weakness.
    // ⚠️ THE MISSING KEY WAS A RUNTIME CRASH, NOT A COMPILE ERROR. This object
    // is typed `Record<string, Record<string, number>>`, so `[...]['beginner']`
    // is `undefined` and TypeScript is silent. Measured 2026-09-19: lowering
    // `progressive_tempo` to beginner and opening the quality slot threw
    // `resolveMainSet: parameter "third_secs" has no value in this variant` on
    // EVERY beginner time-target plan. A fitness-keyed table with a missing
    // level is a live defect waiting for the level to become reachable.
    beginner:     { build: 18, peak: 21, taper: 15 },
    intermediate: { build: 24, peak: 28, taper: 20 },
    experienced:  { build: 28, peak: 32, taper: 24 },
  } as Record<string, Record<string, number>>,

  // Tolerance on the vo2max < race_specific <= threshold main-set ordering
  // (INV-PLAN-MAIN-SET-ORDERING, §8). GROUNDED IN THE SYSTEM'S OWN GRANULARITY,
  // not chosen to make a plan pass: session distances round to
  // DISTANCE_ROUNDING_PRECISION_KM (0.5 km), which at quality paces of roughly
  // 4:30-5:15/km is ~2.3-2.6 minutes, and the warm-up floor is a step function
  // on top of that. An ordering asserted finer than one rounding step is
  // asserting noise.
  //
  // Same reasoning as §83's INTENSITY_ORDERING_TOLERANCE_PCT — "two independent
  // derivations landing within a rounding width of each other is noise, not an
  // inversion" — and the same precedent for why a tolerance here is doctrine
  // rather than tuning-to-pass.
  //
  // Calibration check: the defect this invariant exists to catch was 32 min of
  // VO2max against 26 of race pace, a 6-minute inversion. That still fires. The
  // case this tolerance admits was 24 against 23.
  MAIN_SET_ORDERING_TOLERANCE_MINS: 3,

  // CoachingPrinciples §8 (CD-20 / SC-01, 2026-08-20) — a second quality session
  // requires at least this many training days in the week.
  //
  // DERIVED, not chosen. With the two constants above, quality consumes
  // 18% + (18% × 80%) = 32.4% of weekly volume. The remainder, 67.6%, must fit
  // into the long run plus the easy slots, and easy is capped at
  // longKm / LONG_RUN_MIN_RATIO_VS_EASY = 0.8 × long (§9 — the long run stays
  // the longest run of the week):
  //
  //   4 days → long + 1 easy  ≤ 1.8 × long. At a typical long run of ~0.32W
  //            that reaches ~0.58W against the 0.676W needed — a STRUCTURAL
  //            shortfall of ~8%, taken entirely out of the easy run. Observed:
  //            peak fell 57 → 53 km, below the build peak, tripping §23.
  //   5 days → long + 2 easy  ≤ 2.6 × long. Comfortable. Observed: 57 → 58 km.
  //
  // So on four days the week cannot carry two quality sessions without either
  // breaking §9 or under-delivering ~8% of its own volume — and the volume it
  // loses is the easy aerobic work that makes the hard work survivable (Willy),
  // and which carries a disproportionate share of the bone-loading stimulus for
  // peri/post-menopausal runners (Sims).
  //
  // It is also 3 of 4 sessions hard — 50% by session count, against a 25%
  // plan-wide ceiling (§1). The old hardcoded candidate-day list was blocking
  // this by accident; this is the rule that was missing underneath it.
  MIN_TRAINING_DAYS_FOR_SECOND_QUALITY: 5,

  // CoachingPrinciples §8 (CD-3) — quality PROGRESSES across the build. Intensity
  // is held (pace/HR/zone unchanged — §1 polarised); the session grows by
  // DURATION as the block advances. The multiplier is centred on 1.0 across
  // build+peak (early ~0.85×, late ~1.15×) so the plan's total intensity budget
  // is unchanged — a build that builds, without adding grey-zone load. Base and
  // taper are exempt (aerobic quality / volume-cut sharpening respectively).
  QUALITY_PROGRESSION_RANGE_PCT:    30,

  // ── Volume sequence initialisation ──────────────────────────────────────────
  // buildVolumeSequence clamps the starting volume to a band relative to peakKm:
  //   floor = peakKm × FLOOR_PCT/100  (prevents starting too low for the target)
  //   ceiling = peakKm × CEILING_PCT/100  (prevents starting too close to peak)
  BUILD_VOL_INIT_FLOOR_VS_PEAK:   35,
  BUILD_VOL_INIT_CEILING_VS_PEAK: 85,

  // ── §106 — PEAK WEEKLY VOLUME CEILING, AND THE FLOOR UNDER IT ─────────────
  // (Coaching Board MAINT-PROFILE-01, 2026-09-11)
  //
  // PEAK_KM_BY_LEVEL was 18 coaching numerics living in `lib/plan/length.ts`,
  // OUTSIDE this file. It therefore had no principle section, `configPrincipleSync`
  // could not see it, and the coaching-guard hook did not fire on edits to it —
  // while setting the single most consequential number in a plan. Moved here so
  // it is governed like every other coaching numeric (Hutchinson: "every other
  // numeric in this app has a section explaining what it is for, and that is
  // precisely the discipline that would have caught this").
  //
  // PEAK_FLOOR_VS_START_RATIO is the fix itself. The ceiling is VOLUME-BLIND: it
  // reads distance and fitness level and never asks what the runner already
  // runs. Measured 2026-09-11: a 100 km/week experienced marathoner was handed a
  // block starting at 76 km and peaking at 73 — below their own current volume,
  // in both directions. The engine then correctly failed §23 and labelled it
  // maintenance, so every honesty layer worked perfectly on a plan that should
  // never have been built.
  //
  // ⚠️ THIS IS A FLOOR ON THE CEILING, NEVER A SCALED TARGET (Willy's condition
  // of approval, and he would veto the general form). Self-reported weekly
  // volume is the least reliable number on the intake form, and scaling the
  // ceiling off it would turn an unverified self-report into permission to ADD
  // load. This adds none: `startKm` is already the runner's declared volume, and
  // all this does is refuse to build a curve whose top is below its own start.
  // §2's 10% rule, §45's long-run cap and §3's deload cadence stay fully binding.
  // §10/CD-6's `<6mo` over-claim cap still governs `startKm` before it is read.
  PEAK_KM_BY_LEVEL: {
    '5K':       { beginner: 28, intermediate: 38, experienced: 48 },
    '10K':      { beginner: 32, intermediate: 46, experienced: 56 },
    'HM':       { beginner: 38, intermediate: 52, experienced: 65 },
    'MARATHON': { beginner: 52, intermediate: 65, experienced: 80 },
    '50K':      { beginner: 62, intermediate: 80, experienced: 95 },
    '100K':     { beginner: 72, intermediate: 90, experienced: 110 },
  },
  PEAK_FLOOR_VS_START_RATIO: 1.0,

  // CoachingPrinciples §10 (CD-6) — a `training_age: '<6mo'` runner's declared
  // weekly volume is a self-reported wizard bucket midpoint, not measured. Cap
  // the starting volume regardless of the claim, so an over-stated figure can't
  // hand a genuine beginner an intermediate's load in week 1. Belt (this cap)
  // protects everyone; braces (verify against synced HealthKit volume) is the
  // device-only half — see backlog PV2-E.
  BEGINNER_WEEK1_VOLUME_CAP_KM: 30,

  // CoachingPrinciples §79 — a user-selected fitness level binds STRUCTURE
  // (peak km, week-1 volume floor, ramp, long-run caps) only when it is LOWER
  // than the engine's assessment. Upward it raises the intensity allowance
  // alone.
  //
  // The asymmetry is evidential, and it mirrors §50's max-HR guard exactly: a
  // runner declaring *less* than the data says is credible about their own
  // caution; a runner declaring *more* is claiming a tissue tolerance nothing
  // has demonstrated, and the plan would pay for it in tonnage. Before this
  // guard, a declared level set `peakKm`, which sets the week-1 floor at
  // BUILD_VOL_INIT_FLOOR_VS_PEAK — so a dropdown moved a 10K peak from 18 to
  // 35 km, and moved a `<6mo` novice's marathon peak from 42 to 55 km straight
  // through the BEGINNER_WEEK1_VOLUME_CAP_KM protection above.
  //
  // A flag rather than an inline condition so the rule is greppable and its
  // principle is one lookup away (INV-CFG-001).
  USER_DECLARED_LEVEL_BINDS_STRUCTURE_DOWNWARD_ONLY: true,

  // ── Wizard self-reported volume input (CoachingPrinciples §18) ──────────────
  // Bounds + step for the Ruler that collects current_weekly_km and
  // longest_recent_run_km. Coaching Board 2026-08-30 (CORRECT WITH AMENDMENT):
  // a continuous-but-STEPPED estimate replaces the old coarse bands, which were
  // introducing false midpoints (a 25km runner forced to a 30km bucket → an
  // over-stated starting load). STEP keeps the input honest (a self-report, not
  // false per-km precision). MAX is a sane ceiling for the day-job demographic;
  // the engine's caps (§2 +10%, §29 fresh-return, §18 beginner belt) still bind
  // whatever is entered. Not a target the engine fills — an input it tempers.
  WIZARD_VOLUME_RULER: {
    WEEKLY_KM_MIN:       0,
    WEEKLY_KM_MAX:       160,
    WEEKLY_KM_STEP:      5,
    WEEKLY_KM_ANCHOR:    30,   // resting thumb before the user sets a value
    LONGEST_RUN_KM_MIN:  0,
    LONGEST_RUN_KM_MAX:  60,
    LONGEST_RUN_KM_STEP: 1,
    LONGEST_RUN_KM_ANCHOR: 12,
  },

  // ── Distance display + minimum session distances ────────────────────────────
  // All session distances round to this precision before display.
  // 0.5 km = whole-number-ish (12.0, 14.5, 9.0) — clean, not nitpicky.
  DISTANCE_ROUNDING_PRECISION_KM: 0.5,

  // Floor distances per session type. Below these, the session is too short to
  // be coaching-meaningful. Engine clamps up.
  // CoachingPrinciples §52b (INPUT-FLOOR-01) — a training day must be able to
  // carry a real session.
  //
  // Where weekly volume divided by available days falls below this, the engine
  // uses FEWER days rather than emitting sessions too small to be
  // coaching-meaningful. 12km spread over seven days is seven jogs; the same
  // 12km over three days is a training week.
  //
  // 5km = MIN_SESSION_DISTANCE_KM.quality, the LARGEST session floor — a
  // training day must be able to carry the biggest thing that might land on it,
  // not the smallest.
  //
  // Set to 4 first (the easy floor) on the reasoning that a day only needs to
  // hold the least demanding session. Measurement disagreed: at 4 the quality
  // session still landed under its own 5km floor, and moving to 5 cleared a
  // further 114 sub-floor sessions and 20 long-run violations. The day has to
  // be sized for its worst case.
  //
  // Measured: sub-floor sessions run at 13% below 2 km/day, 7% at 2-3, and
  // ZERO at 3km/day and above. Held against weekly volume alone, or against race
  // distance alone, the signal is flat zero — the defect exists only in the
  // INTERACTION, which is why it was invisible to both axes for months.
  MIN_KM_PER_TRAINING_DAY: 5,

  // MIN_TRAINING_DAYS_VOLUME_FLOOR — the floor under `daysVolumeCanFill`.
  //
  // ⚠️ NOT A NEW COACHING DECISION. This value has been live since R23 as the
  // literal `3` in `Math.max(3, Math.floor(dayCountKm / MIN_KM_PER_TRAINING_DAY))`
  // (`ruleEngine.ts`), with its reasoning written directly above it: "never
  // below 3 days: at or under that, §52's low-day rule already owns the shape
  // and downgrades the plan to maintenance with its own note". Extracted here
  // under the Configuration Singularity — a coaching numeric living inline in
  // `lib/plan/*` is the `peakKmByLevel` failure this repo has already paid for,
  // where 18 numerics sat outside GENERATION_CONFIG and so had no principle,
  // no `configPrincipleSync` coverage and no coaching-guard hook on edits.
  //
  // It is named now because `INV-PLAN-WEEK-DELIVERS-DECLARED-DAYS` needs to
  // check against it. ⚠️ A CHECKER READING THE PRODUCER'S OWN CONSTANT IS
  // CORRECT HERE AND WOULD NOT BE IF IT SHARED THE PRODUCER'S PREDICATE:
  // DELOAD-OWNER-01's lesson is that a checker recomputing `weekN % freq === 0`
  // cannot catch the producer's copy being wrong. This shares the BOUND, not
  // the derivation — the defect being caught is a downstream pass ignoring a
  // floor that was correctly computed, so the floor is exactly the right thing
  // for both sides to agree on.
  MIN_TRAINING_DAYS_VOLUME_FLOOR: 3,

  // §113 (LONGEST-RUN-GATE-01, Coaching Board 2026-09-18) — the distances whose
  // long run cannot be improvised, and so where a readiness floor applies.
  // 21 km: a half is the shortest race whose long run the engine builds FROM the
  // runner's stated longest rather than from weekly volume alone. Below it,
  // §45's week-1 cap is never the binding constraint.
  //
  // ⚠️ THERE IS NO SECOND NUMBER HERE ON PURPOSE. The floor itself is
  // `MIN_SESSION_DISTANCE_KM.long` below, read through
  // `longRunReadiness.minLongestRunKm()`. The route used to hardcode its own
  // `5`; changing the engine's floor would have left the gate matching the old
  // value with nothing to notice.
  LONG_RUN_READINESS_MIN_RACE_KM: 21,

  MIN_SESSION_DISTANCE_KM: {
    long:               5,
    easy:               4,
    quality:            5,
    secondary_quality:  4,
  },

  // §113 Amendment 1 (Coaching Board 2026-09-18, CB-SUBFLOOR-ADMIT-01) — the
  // hard bottom of `sessionFloorsFor()`.
  //
  // MIN_SESSION_DISTANCE_KM is a floor on what is worth PRESCRIBING; this is the
  // floor on what is a SESSION at all. Between them sits the runner whose
  // longest run is 3 km, whom the engine refused rather than coached, because
  // the 5 km floor overrode §45's cap and turned a +10% step into +67%.
  //
  // 2 km, not lower: below it a "long run" is a walk to the shops, and §113
  // still refuses — that gate becomes runway-aware, it is not removed. A runner
  // under this value with any runway is genuinely not ready for a marathon
  // block and is told so, with an alternative that actually opens.
  MIN_SESSION_DISTANCE_ABSOLUTE_KM: 2,

  // ── Returning runner detection threshold ────────────────────────────────────
  // A user is detected as a "returning runner" when their training_age > 2 years
  // AND their current_weekly_km is below this fraction of peakKm. Below this
  // threshold the body has obvious headroom for the 15% allowance window.
  RETURNING_RUNNER_VOLUME_THRESHOLD_PCT: 50,  // % of peakKm

  // ── §115 fuelling practice threshold ────────────────────────────────────────
  // A session at or above this duration carries fuelling PRACTICE guidance
  // (Coaching Board 2026-09-19, LONG-SESSION-FUEL-01).
  //
  // 120 minutes, and the number is the defensible part: carbohydrate intake
  // during exercise has strong support beyond roughly two hours and thin
  // support below it, so a lower threshold would be Zonna overclaiming — the
  // failure mode Hutchinson's seat exists to catch. Measured before the
  // ruling: 69% of plans containing a 2h+ session said nothing about fuelling
  // on that session, and the never-run beginner marathoner gets SEVEN such
  // sessions (up to 3h28) with no mention anywhere in the plan.
  //
  // It governs a NOTE, never a quantity. Zonna holds no dietary data (ADR-011)
  // and prescribes no grams, calories or schedule.
  FUELLING_PRACTICE_MIN_SESSION_MINS: 120,

  // ── Compressed-plan detection threshold ─────────────────────────────────────
  // After buildVolumeSequence applies the 10% post-process cap, a plan is
  // considered "compressed" if peak-phase weeks never reach this fraction of
  // peakKm. Surfaced via plan.meta.compressed.
  PEAK_REACHED_THRESHOLD_PCT: 95,  // % of peakKm

  // ── Peak overload requirement (CoachingPrinciples §23) ─────────────────────
  // A plan that does not exceed PEAK_OVER_BASE_RATIO is downgraded to a
  // "maintenance" plan rather than presented as a "build". The constitution:
  // a build that does not produce overload is mislabelled.
  PEAK_OVER_BASE_RATIO: 1.10,            // peak weekly_km / W1 weekly_km
  PEAK_OVERLOAD_MIN_PLAN_WEEKS: 8,       // below this length, ratio not enforced

  // ── Base-build ceiling (CoachingPrinciples §111) ───────────────────────────
  // The MAXIMUM the delivered peak may exceed the runner's REAL current volume,
  // for marathon and ultra. Distinct from §23 above: §23 is a MINIMUM on
  // peak/WEEK1 (build enough); this is a MAXIMUM on peak/CURRENT (do not build
  // recklessly far off the base the runner actually has). Over the cap, the
  // engine refuses (BaseVolumeError) and names the base to reach, rather than
  // shipping the jump. 4.0 admits the charity cohort (M1 first-timer 15 km/wk →
  // peak 47 = 3.13x) and refuses the reckless case (5 km/wk → 9.4x); any cap
  // ≤ 3.13 would refuse M1. (Coaching Board MARATHON-VOLUME-GATE-01, 2026-09-18.)
  // ── GET-RUNNING PLAN (founder directive 2026-09-20) ────────────────────────
  //
  // What we offer the runner no marathon plan can serve. The board twice ruled
  // zero rejection unreachable by coaching and escalated "what do they get
  // instead" as a product decision; the founder made it.
  //
  // ⚠️ THESE ARE BOUNDS, NOT TARGETS, and the distinction is the design. A
  // marathon plan must reach a base by a date. This has no start line, so
  // imposing a target would invent a deadline the runner does not have and
  // then refuse them a second time for missing it — the exact failure this
  // plan exists to end. It builds for the weeks available and stops.

  /** Below this a "plan" is a gesture. Two §3 deload cycles. */
  GET_RUNNING_MIN_WEEKS: 8,

  /** 15, and the number is PHYSIOLOGICAL, not editorial (§118, amendment 1).
   *
   *  ⚠️ IT WAS 16, CHOSEN FOR LEGIBILITY — "a plan nobody can see the end of is
   *  not a plan" — AND IT WAS DOING LOAD-BEARING WORK NOBODY HAD CHECKED.
   *  16 weeks of §2's 10% under §3's four deloads compounds to a **4.17x total
   *  build**, above §111's `MAX_BASE_BUILD_RATIO` of 4.0.
   *
   *  ⚠️ AND THE RATIO IS A PROPERTY OF THE CURVE, NOT THE RUNNER. Every start
   *  lands on the same number — 2→8.3, 3→12.5, 5→20.8, 7→29.2 are all ~4.17x.
   *  The submission reported it as "a 7 km/week runner ends at 4.2x", which
   *  would have sent someone hunting for a per-runner cap. **It is the
   *  sixteenth week.** 15 weeks gives ~3.75x, inside 4.0 with room.
   *
   *  Willy: *"I will not have two total-build ceilings in one constitution
   *  differing by 0.17 because one of them was measured off a 16-week curve."* */
  GET_RUNNING_MAX_WEEKS: 15,

  // ── §117 — the finish-goal run-walk marathon (Coaching Board 2026-09-20) ───
  //
  // §111's door is a function of the PEAK, and the peak is a function of what
  // we are preparing the runner FOR. `minBase = ceil(peak / 4.0)`, and a
  // beginner marathon peak of 52 km/wk puts the door at 13 km/wk — but 52 is
  // the tonnage to RUN 42.2 km, not to FINISH it with walk breaks.
  //
  //     peak  ->  §111 door  ->  weeks needed from 4 km/wk (budget is 13)
  //       52         13                    14   REFUSED
  //       34          9                    10   admitted
  //       30          8                     9   admitted
  //
  // ⚠️ NOTHING IS LOOSENED. §2's ramp rate, §3's cadence and §111's ratio are
  // all untouched. The runner is prepared for a different, honestly-stated
  // outcome, and the door moves as a CONSEQUENCE of the lower target.
  //
  // ⚠️ AND THIS IS NOT NEW DOCTRINE. §80 (2026-08-06) already ratified that for
  // finish-goal marathons the peak long run is anchored on race DURATION and
  // that "run-walk counts" — "every finish-goal peak long run carries explicit
  // permission to walk". What never existed is the engine PRESCRIBING it. That
  // is a principle-to-behaviour gap, which is why the chair ruled it is not
  // §9's forbidden eleventh instrument.

  /** 34 — the TOP of the range Willy priced (S117-PEAK-VS-TIME-01, 2026-09-20).
   *
   *  ⚠️ HIS TWO NUMBERS CONTRADICTED AND THE RANGE WON. Amendment 1 gave both
   *  30-34 km/wk AND "repeated exposure to 3+ hours on feet". Measured on
   *  generated plans they trade directly against each other:
   *
   *      peak  door  longest run  time on feet  refusal (198-profile grid)
   *        32     8       16.5km         2h12       29.3%
   *        34     9       18.5km         2h28       29.3%   <- here
   *        36     9       20.0km         2h40       36.4%
   *        42    11       23.0km         3h04       36.4%
   *        52    13       26.0km         3h28       45.5%   (standard)
   *
   *  Buying the three hours costs SEVEN POINTS of admission for 36 minutes.
   *  Willy, ruling: *"the range was the number I priced"* — the three hours
   *  described the SHAPE of the demand (duration, not tonnage) and was never
   *  a floor he had costed.
   *
   *  ⚠️ 32 IS STRICTLY DOMINATED. 32 and 34 refuse identically, so 34 buys 16
   *  minutes and 2 km for nothing. There is no argument for 32.
   *
   *  ⚠️ AND §9's OWN RECORD SETTLES THE ADEQUACY. McMillan, whose position the
   *  founder took: *"a runner who does a 17 km longest run and run-walks the
   *  last stretch finishes."* 34 delivers 18.5.
   *
   *  ⚠️ Sims contradicted the framing that 42 was the cautious option: a higher
   *  peak is MORE weekly running volume for a 20-29 female first-timer over 29
   *  weeks, so on bone health and energy availability 42 is the riskier one. */
  FINISH_GOAL_RUNWALK_PEAK_KM: 34,

  /** The prescribed interval, in minutes. ⚠️ PRESCRIBED, NOT PERMITTED —
   *  Willy and McMillan arrived at this independently, which is the strongest
   *  signal the sitting produced. McMillan: *"'run 40 minutes, walk if you need
   *  to' is a dare. '6 minutes running, 1 minute walking, ten times' is a
   *  session. One is a target you beat; the other is an instruction you
   *  follow."* A runner who is permitted to walk and never told how will run
   *  until they cannot, and arrive at the same injury by a longer route. */
  /** §117's ADEQUACY FLOOR — the peak long run below which a finish-goal
   *  run-walk plan is not a plan, it is a door with nothing behind it.
   *
   *  ⚠️ MANDATED BY THE CHAIR AT S116-FLOOR-VS-TARGET-01 (2026-09-20), and the
   *  reason is the most dangerous configuration this engine was in all day.
   *  `LONG-RUN-SHORT` is WATCHED rather than scored on §117 plans, because the
   *  board ruled 18.5 km adequate at peak 34. **Nothing distinguished 18.5 from
   *  13.5.** Had the on-ramp floor dropped to 3, a runner would have arrived at
   *  a marathon off a 13.5 km longest run and the rubric would have scored it
   *  FIT — the marathon would have cleared 90% for the first time by admitting
   *  people to plans that do not work.
   *
   *  **An exemption granted for a good reason at one peak, silently covering a
   *  much worse plan at another.** The exemption was correct; its bound was
   *  missing.
   *
   *  17 is not invented here: it is §9's Recorded structural finding, McMillan,
   *  the position the founder took — *"a runner who does a 17 km longest run
   *  and run-walks the last stretch finishes."* */
  FINISH_GOAL_RUNWALK_MIN_PEAK_LR_KM: 17,

  FINISH_GOAL_RUNWALK_RUN_MINS: 6,
  FINISH_GOAL_RUNWALK_WALK_MINS: 1,

  // ── §116 — the base-build on-ramp (P-16, Coaching Board 2026-09-20) ────────
  //
  // §111 refuses the sub-12 km/week marathoner and NAMES a base-building plan
  // as the remedy. §57 made that remedy structurally impossible — every
  // foundation week is `baseline x 1.10`, flat from week 2, at any length.
  // These are the numerics for the ramp that closes it.
  //
  // ⚠️ THEY LIVE HERE AND NOT IN `foundationBlock.ts` OR A ROUTE. §106
  // (`peakKmByLevel` in `length.ts`) and MARATHON-VOLUME-GATE-01 (the volume
  // gate hardcoded in the API route) are both on record as the same defect:
  // a coaching numeric outside the singularity is invisible to
  // `configPrincipleSync`, to `configConsumer`, and to the coaching-guard hook.

  /** Ceiling on ramp length. Not a coaching bound — a termination bound for
   *  `onRampWeeksNeeded`'s search, set well above any real requirement. */
  BASE_BUILD_ONRAMP_MAX_WEEKS: 26,

  /** §3's standard cadence, named separately so the ramp's deload rhythm is a
   *  stated choice rather than an incidental read of the main-plan constant.
   *  Masters cadence is deliberately NOT applied: the ramp is all easy and
   *  below the volume at which the masters shortening was ratified. */
  BASE_BUILD_ONRAMP_DELOAD_FREQUENCY: 4,

  /** Below this the runner is not someone a RUNNING ramp serves. Willy at the
   *  sitting: a runner at 8 km/week over 4 days is already running 2 km at a
   *  time; run-walk is for someone who cannot, and that runner is below this
   *  floor. ⚠️ RUN-WALK IS EXPLICITLY NOT SCOPED — do not build it to copy a
   *  competitor. */
  BASE_BUILD_ONRAMP_MIN_START_KM: 6,

  /** §44's ratified 16-week threshold, reused rather than re-chosen. McMillan:
   *  a ramp that leaves less than this has bought base at the cost of the
   *  specific preparation the race actually needs. */
  BASE_BUILD_ONRAMP_MIN_REMAINING_WEEKS: 16,

  MAX_BASE_BUILD_RATIO: 4.0,              // delivered peak weekly_km / current_weekly_km
  BASE_BUILD_RATIO_MIN_DISTANCE_KM: 42,  // §111 governs marathon and ultra only

  // ── Prep-time validation (CoachingPrinciples §44) ──────────────────────────
  // Minimum weeks of preparation per race distance / goal type. Two-step UX:
  //   block → refuse generation, list alternatives.
  //   warn  → refuse unless input.acknowledged_prep_warning === true.
  //   ok    → proceed.
  // For goal: 'finish', the warn zone is treated as ok (only block applies).
  // Returning runners shift all thresholds up by PREP_TIME_RETURNING_RUNNER_SHIFT_WEEKS.
  PREP_TIME_THRESHOLDS: {
    '5K':       { block: 4,  warn: 8 },
    '10K':      { block: 6,  warn: 10 },
    'HM':       { block: 8,  warn: 12 },
    'MARATHON': { block: 10, warn: 16 },
    '50K':      { block: 14, warn: 20 },
    '100K':     { block: 14, warn: 20 },
  },
  PREP_TIME_RETURNING_RUNNER_SHIFT_WEEKS: 2,

  // ── Difficulty band (CoachingPrinciples §44 amendment + §31) ────────────────
  // The engine surfaces an ordinal demand label on every GENERATED plan:
  //   'comfortable' | 'demanding' | 'very_demanding'.
  // (The fourth, refusal tier — "not achievable in this window" — is the §44
  // `block`, which throws PrepTimeError and never reaches plan.meta.)
  // Deliberately ordinal, never a percentage: with one benchmark run + one max
  // HR the engine cannot defend a probability, and false precision is an
  // overclaim (Coaching Board veto, 2026-08-18). It describes the demand the
  // plan places on the RUNNER's timeline/life, not a verdict on the runner.
  //
  // BOUNDARY (SLT, 2026-08-18): the band is a *pre-generation feasibility* read,
  // derived ONLY from prep-time margin + compression_classification — never from
  // plan-quality / enrichment signals. This keeps it structurally distinct from
  // the PAID numeric confidence score (a *post-generation quality* read) so the
  // two can never become competing verdicts. The band is FREE; the score is PAID.
  //
  // A time-target plan whose weeks-available sits within this many weeks of the
  // recommended (`ok`) minimum is 'demanding' rather than 'comfortable' — a tight
  // but safe timeline is a real ask. Finish goals never trip this (their warn
  // band is treated as ok per §44), so they read 'comfortable' unless constrained.
  DIFFICULTY_COMFORTABLE_MARGIN_WEEKS: 2,

  // ── CA-03 post-race goal-ladder suggestion seeds (CoachingPrinciples §67) ───
  // These seed the "what next" wizard prefill; the runner edits before generating.
  GOAL_SEQUENCING: {
    /** "Same distance, faster" suggests this fraction of the achieved finish (3% quicker). */
    CHASE_IMPROVEMENT_FACTOR: 0.97,
  },

  // ── Long-run progression cap (CoachingPrinciples §45) ──────────────────────
  // Universal — no phase exemption. Long-run distance increase week-on-week
  // capped at the GREATER of LONG_RUN_PROGRESSION_CAP_PCT (% of prior LR) or
  // LONG_RUN_PROGRESSION_CAP_ABS_KM (absolute). Step-back from a deload to the
  // pre-deload distance is permitted within LONG_RUN_DELOAD_STEP_BACK_TOLERANCE_PCT.
  LONG_RUN_PROGRESSION_CAP_PCT:           20,
  LONG_RUN_PROGRESSION_CAP_ABS_KM:         5,

  // ── Week-1 absolute step ────────────────────────────────────────────────────
  // WEEK1-FLOOR-SHORT-DIST-01 (Coaching Board 2026-09-20). Week 1 has no prior
  // week, so §2's week-on-week ramp cap does not govern it — the gap §111's own
  // text names ("a 3.6x acute jump in week one that §2's ramp cap does not
  // govern"). The ratio arm alone missed it at higher volumes: a runner on
  // 40 km/week handed 50 is +10 km but only 1.25x, under the ratio.
  //
  // 10 km is Willy's binding condition made numeric, and its prevalence was
  // measured before it was set: 3.1% of plans with any positive week-1 step,
  // mean per-run increase +2.1 km at that threshold. Chosen from the data, not
  // from the round number it happens to be.
  WEEK1_ABSOLUTE_STEP_MAX_KM:             10,
  // ⚠️ AND A PROPORTIONAL GUARD, because the absolute arm alone over-fired.
  // Measured immediately after adding it: a runner declaring 90 km/week handed
  // a 100 km week 1 — a 1.11x step, ten kilometres spread over six runs — was
  // flagged as a week-1 leap, and 100K fit-for-purpose fell 95.8% -> 88.5% on
  // that alone. A flat kilometre threshold means something different at 10
  // km/week and at 90. The arm now needs BOTH: a large absolute step AND a
  // step that is proportionally real.
  WEEK1_ABSOLUTE_STEP_MIN_RATIO:          1.15,

  // §2 Amendment 2 (Coaching Board 2026-09-20, HM-WEEK1-PERRUN-01) — the ratio
  // arm is a SCREEN; the per-run step is the confirmation.
  //
  // A weekly total is not a training stress: a session is. Measured across all
  // 309 ratio-flagged plans product-wide, the worst per-run increase is
  // +2.40 km and no session anywhere exceeds the runner's longest-ever run by
  // more than +0.50 km. The arm was flagging no load hazard at all.
  //
  // ⚠️ 1.5 km WAS CHOSEN OVER 2.0 km DELIBERATELY, AND AGAINST THE SCOREBOARD.
  // 2.0 scored better (product 96.5% vs 95.3%, HM 97.9% vs 95.1%) and retained
  // only 12% of the flagged population; 1.5 retains 51%, so the arm keeps its
  // teeth. Hutchinson's standing objection at that sitting was the PATTERN of
  // repeated relaxation, and taking the larger relaxation because it scores
  // higher is that pattern. The smaller one that solves the problem wins.
  //
  // ⚠️ THE BACKSTOPS ARE UNTOUCHED: arm 2 (>=10 km AND >1.15x) still catches a
  // large weekly step assembled from many small runs, and arm 3 still catches
  // a single session beyond the runner's demonstrated range.
  WEEK1_PER_RUN_STEP_MAX_KM:              1.5,

  // §45 Amendment 2 (LR-ABS-CAP-LOWVOL-01, Coaching Board 2026-09-17).
  //
  // The +5km ABSOLUTE arm above is tapered on a small week:
  //   allowed step = max(prevLR × CAP_PCT, min(CAP_ABS, prevLR × this))
  //
  // WHY THIS NUMBER, because "a 33% ceiling is a number I made up" is what got
  // the first attempt ruled INSUFFICIENT EVIDENCE. The board's rule was "15% of
  // the prior WEEK", derived as half the long run's own build-phase share under
  // §9 (`LONG_RUN_PCT_OF_WEEKLY_VOLUME` build = 30%). Since §9 sizes the long run
  // AT 30% of the week, 15% of the week IS 50% of the long run — the same rule,
  // re-expressed on an input that is stable. A single week's STEP may not exceed
  // half of what the long run already is.
  //
  // ⚠️ THE BASIS CHANGED DURING IMPLEMENTATION, AND THE REASON MATTERS. Shipped
  // against `prev.weekly_km` it broke 140 plans: §45 runs mid-pipeline and the
  // long run is re-anchored (duration -> distance) afterwards, so the producer
  // and `INV-PLAN-LR-PROGRESSION-CAP` read DIFFERENT weekly volumes and
  // disagreed. `prevLR` is the value the % arm already uses, so the two cannot
  // drift. LR-CAP-BLIND-01 was one bug in two copies; this avoids re-creating
  // that shape.
  //
  // WHAT IT FIXES. §9 sizes the long run as a share of weekly volume; the +5km
  // allowance was the one part of long-run prescription that ignored weekly
  // volume entirely — the signature of a constant written for a typical case and
  // never revisited (Seiler). Measured on the low-volume cohort (longest recent
  // run < 18km AND volume < 35km/wk), 1,200 plans / 5,586 steps:
  //
  //   · 29.2% of long-run steps were legal ONLY via the absolute arm
  //   · of those, 32.5% were >= +40% in a single week — against **2.7%** in the
  //     control group. Frequency was never the tell (the arm binds MORE often on
  //     ordinary runners, 37.8%); MAGNITUDE is, by 12x.
  //   · worst observed 6 -> 11km (+83%) on a 17km week.
  //
  // COST, accepted with open eyes: 22.7% of low-volume plans get a smaller peak
  // long run (median -1.5km), and 18 of 1,149 (1.6%) can no longer reach §24's
  // specificity floor and reclassify as maintenance-grade against their time
  // goal — they keep the honest `volume_constraint_note` (McMillan's condition).
  // Worst in-plan jump 83% -> 57%; p90 53% -> 46%; median unmoved at 33%; zero
  // plans newly refused. A cap that bites only the tail is the correct shape.
  LONG_RUN_ABS_STEP_MAX_PCT_OF_LR:        50,
  // §6 Amendment 1 (Coaching Board PEAK-LR-NOT-IN-PEAK-01, 2026-09-15) — the
  // taper long run may not exceed the PEAK phase's long run.
  //
  // §6 says "volume drops sharply in the taper", but §9's phase shares run
  // base 28 / build 30 / peak 32 / TAPER 40 — the taper takes the LARGEST share
  // of a smaller week. That is defensible (you cut easy volume harder than the
  // long run) right up to the point where the larger share of a smaller week
  // beats the peak's smaller share of a bigger one. Measured across 1,440 plans
  // it inverts on 28 (1.9%), worst case an HM taper long run of 20.5 km after a
  // peak of 18.5 — a 97%-of-race-distance dress rehearsal two weeks out.
  //
  // THE TOLERANCE IS NOT COSMETIC. Session distances round to
  // DISTANCE_ROUNDING_PRECISION_KM, and the 5K cases invert by exactly +0.5 km —
  // one rounding step. Capping on a bare `>` would report rounding as a coaching
  // defect, and a check that cries wolf gets disabled (NOISE-GATE-01).
  TAPER_LR_VS_PEAK_TOLERANCE_KM: 0.5,

  LONG_RUN_DELOAD_STEP_BACK_TOLERANCE_PCT: 5,

  // ── Peak weekly volume floor for long races (CoachingPrinciples §46) ───────
  // Time-targeted plans for marathon and ultra need an absolute weekly-volume
  // floor in peak phase, not just a peak-vs-base ratio. HM and shorter rely on
  // PEAK_OVER_BASE_RATIO alone. When the floor is unreachable, plan downgrades
  // to maintenance via the §23 / §38 mechanism.
  MARATHON_PEAK_VOLUME_FLOOR_RATIO: 1.25,  // ×race_distance — covers 40–43km races
  ULTRA_50K_PEAK_VOLUME_FLOOR_RATIO: 1.00, // ×race_distance — 43–55km
  ULTRA_LONG_PEAK_VOLUME_FLOOR_RATIO: 0.80,// ×race_distance — >55km
  ULTRA_PEAK_VOLUME_FLOOR_CAP_KM:    130,  // absolute cap for >55km

  // ── Peak long-run alternation (CoachingPrinciples §47) ─────────────────────
  // No two consecutive peak weeks may both carry a peak-level long run.
  PEAK_LR_ALTERNATION_THRESHOLD_PCT: 90,   // % of peak LR distance defining "peak-level"
  PEAK_LR_STEPBACK_MAX_PCT:          80,   // % of peak LR distance defining a "step-back" LR
  // §47 Amendment 2 (Coaching Board 2026-09-16) — a peak step-back is a VOLUME
  // step-back, not only an intensity one. §47 eased the long run's pace and wrote
  // "absorb last week's peak" while the WEEK's total kept climbing on the curve
  // (measured: 6,720 plans, 22.5% of the grid, delivered a step-back week BIGGER
  // than the week before it). §90's principle — a week the runner is told is
  // easier must DELIVER less — applied in peak: the step-back week trims its easy
  // volume to at most this % of the preceding week, never below §52's long-run
  // share or the min-easy floor.
  PEAK_STEPBACK_WEEK_MAX_PCT:        90,   // % of preceding week the step-back week may deliver
  // CoachingPrinciples §9 (CD-9) — within the build phase, every Nth long run
  // steps back by this % so a runner isn't repeating the same long run for
  // weeks. Peak long runs (the culmination) and deloads are left alone.
  LONG_RUN_STEPBACK_CADENCE_N:        3,   // every 3rd build long run
  LONG_RUN_STEPBACK_PCT:             20,   // drops 20%

  // ── Quality variety across the full plan (CoachingPrinciples §53) ──────────
  // No single quality-session label may appear more than
  //   floor(total_quality_sessions / DENOMINATOR) + ALLOWANCE
  // times across the full plan. Default 1/3 + 1: a 9-quality-session plan caps
  // each label at 4 occurrences. Extends round-2 M-02 (taper variety) to apply
  // to base/build/peak as well as taper.
  QUALITY_VARIETY_DENOMINATOR: 3,
  QUALITY_VARIETY_ALLOWANCE:   1,

  // Minimum weekly volume (km) for a threshold_ladder to be prescribed
  // (CoachingPrinciples §53, CAT-ULTRA-THIN-01, Coaching Board 2026-08-21). The
  // ladder is ~24 min of accumulated threshold work; dropping it on a genuinely
  // low-volume week is a spike (Willy), so it is gated on volume rather than a
  // fitness label — which lets an intermediate marathon/ultra runner at real
  // volume reach it (McMillan) and widens their thin threshold pool. A relative,
  // per-runner floor (T-work minutes as a share of weekly minutes — Sims) is the
  // tracked refinement; this absolute km floor is Willy's binding version.
  THRESHOLD_LADDER_MIN_WEEKLY_KM: 45,

  // Second eligibility path — Coaching Board 2026-09-03. The flat km floor
  // above denies 61.5% of genuinely threshold-committed low-volume weeks
  // (measured: >=20% of the week's training minutes already threshold-
  // category), and lowering the floor doesn't fix it — at 25km/week, 79.2%
  // of newly-admitted weeks have NO threshold commitment at all. A runner
  // who has ALREADY sustained threshold-category work across recent weeks
  // has demonstrated tissue readiness through repetition (Willy's own
  // standard), not claimed it through one week's arithmetic (Sims' fix) — so
  // this is a second, additive path, never a replacement for the floor above.
  // "2 of 3" is a defensible operational default, not literature-derived —
  // stated honestly (Hutchinson) rather than dressed up as more rigorous
  // than it is. The stability check is a COLLAPSE GUARD, not a floor
  // (Sims) — it only rules out a runner whose volume is actively falling
  // apart mid-window (Willy), never sets a minimum on how low it can be.
  THRESHOLD_LADDER_ALT_LOOKBACK_WEEKS: 3,
  THRESHOLD_LADDER_ALT_MIN_HITS: 2,
  THRESHOLD_LADDER_ALT_STABILITY_PCT: 20,

  // ── Long run as fraction of weekly volume (CoachingPrinciples §52) ─────────
  // No single run may exceed this fraction of the week's total volume. Above
  // this threshold the week is structurally lopsided — the long run becomes
  // the only run, weekday training disappears.
  // ── §114 — THE LONG RUN FITS THE WEEK IT IS IN (founder decision 2026-09-19) ──
  //
  // Where the week cannot hold the long run the race asks for, the long run
  // yields and the plan says so. The alternative on the table was refusing
  // these runners outright; the founder took McMillan's position that for a
  // first-timer "get you round" IS the goal.
  //
  // ⚠️ THE VALUE IS §52's OWN 60%, DELIBERATELY. This introduces no new
  // threshold — it makes the cap §52 has always stated bind at CONSTRUCTION
  // instead of warning after the fact. Seiler's first number was 45%, reasoning
  // from §9's 28-40% sizing intent, and measurement falsified it: at a 47 km
  // peak week a 26 km long run is 55%, which is what every novice marathon plan
  // in print does.
  //
  // ⚠️ FOUR ATTEMPTS TO RAISE THE WEEK INSTEAD ARE RECORDED IN §9's STRUCTURAL
  // FINDING AND ALL FOUR FAILED. The week cannot be raised: an 8 km/week runner
  // cannot reach the 43 km a 26 km long run needs, in nineteen weeks, under §2
  // once §3's deloads take 30% four times.
  LONG_RUN_MAX_PCT_OF_DELIVERED_WEEK: 60,

  LONG_RUN_MAX_PCT_OF_WEEKLY: 60,

  // ── Strides on midweek easy (CoachingPrinciples §28) ───────────────────────
  // From this week onwards, the engine appends a stride coach-note to one
  // midweek easy run per week. Skipped in race week and deload weeks.
  STRIDES_FIRST_WEEK: 3,

  // §28 Amendment 1 (Coaching Board 2026-09-18, CB-BEGINNER-HILLS-01) — how
  // often a BEGINNER's stride run becomes a short HILL stride run.
  //
  // MEASURED GAP: plans containing any hills — beginner 0.0%, intermediate
  // 43.7%, experienced 40.5%. Nobody decided beginners should not do hills; it
  // falls out of `hill_reps` being typed `vo2max` in the catalogue against
  // QUALITY_SESSIONS_PER_WEEK_MAX.beginner = 0. Willy: "a short hill sprint is
  // not a VO2max session — six by ten seconds is neuromuscular and
  // tendon-loading, and carries LOWER impact per unit of stimulus than flat
  // fast running because the ground comes up to meet you."
  //
  // ⚠️ 2 MEANS ALTERNATE, NOT ADD. On a hill week the stride run BECOMES the
  // hill run. The board authorised hills "dosed like §28's strides"; placing a
  // hill run alongside the stride run would DOUBLE the weekly neuromuscular
  // dose, which no seat asked for and which Willy would object to. Total dose
  // is unchanged; only the variety increases.
  BEGINNER_HILL_STRIDE_EVERY_N_WEEKS: 2,

  // ── Tune-up race callout (CoachingPrinciples §32) ──────────────────────────
  // Plans of this length or longer get a mid-build tune-up race suggestion.
  // Placed on the latest non-deload build week before peak. Optional — the
  // coach note appears as plan.weeks[i].tune_up_callout, not a separate
  // session. Users can ignore it without breaking the plan.
  TUNE_UP_MIN_PLAN_WEEKS: 10,

  // ── Race-week shakeout (CoachingPrinciples §30, §39) ──────────────────────
  // Race week has no quality session — shakeouts only. Hard cap on duration
  // and a stride note on the first shakeout preserve neuromuscular sharpness
  // without adding race-day fatigue. For HM/marathon, an additional easy
  // mid-week run prevents the taper from going too deep.
  RACE_WEEK_SHAKEOUT_MAX_MINS: 35,
  // §30 (amended, F14) — the two shakeouts do different jobs. The earlier one
  // keeps the legs turning over and carries the strides; the final one is
  // minimal, because the last run before a race should leave the runner
  // wondering whether it was enough. Index-aligned with
  // RACE_WEEK_SHAKEOUT_DAYS_BEFORE_RACE.
  RACE_WEEK_SHAKEOUT_KM: [5, 3],
  RACE_WEEK_EASY_KM: {
    HM:       7,    // 6–8 km easy on a non-shakeout day
    MARATHON: 9,    // 8–10 km
  },
  // CoachingPrinciples §77 — shakeout spacing expressed as days BEFORE the race,
  // so it generalises to any race weekday. [5, 3] reproduces the historical
  // Tue/Thu placement for a Sunday race while remaining correct for a Wednesday
  // one. Offsets landing outside race week, or on a blocked day, are skipped —
  // never relocated to after the race.
  RACE_WEEK_SHAKEOUT_DAYS_BEFORE_RACE: [5, 3],

  // CoachingPrinciples §39 Amendment 1 / §26 — the day(s) before the race carry no
  // scheduled running session. Expressed as days BEFORE the race, the same
  // vocabulary §77 uses, so it generalises to any race weekday.
  //
  // §30's shakeout offsets [5, 3] already place nothing here. What DID land on
  // race eve was §39's "mid-week" easy run: its day came from the preference
  // order ['sat', 'fri', ...] and for a Sunday race — which is nearly every real
  // race — 'sat' is the day before the gun and it was first in the list.
  // Measured 2026-09-14 on an 81-plan Sunday-race grid: a session landed on race
  // eve in **81 of 81 plans (100%)**, mean 54 minutes, and the worst case was a
  // BEGINNER finish-goal marathoner on 25 km/week given 9 km / 72 minutes the day
  // before their first marathon.
  //
  // 1, not 2: a single day of no running before a race is standard taper practice
  // and the board declined to invent a longer protected window without evidence.
  RACE_EVE_PROTECTED_DAYS: 1,

  // §80 Amendment 1 — the race-day opening instruction, as a FRACTION of race
  // distance rather than a fixed 5 km.
  //
  // `raceSession()` hardcoded "First 5 km at Zone 2." for EVERY distance. On a
  // marathon that is sensible and standard. On a 10K it gives away half the race,
  // and on a 5K it instructs the runner not to race their goal race at all.
  //
  // 0.12 is not a new number: 5 km IS 11.85% of a marathon, so the constant was
  // always the marathon's opening fraction written out in kilometres and then
  // applied to distances it was never derived for. Deriving it back leaves the
  // marathon unchanged (5.06 km) and makes every other distance correct.
  RACE_OPENING_FRACTION: 0.12,

  // ── Fresh-from-layoff detection (CoachingPrinciples §29) ───────────────────
  // If weeks_at_current_volume is set and below this threshold, the runner is
  // returning from a layoff and not actually consolidated at their stated
  // current_weekly_km. The engine treats current_weekly_km as aspirational and
  // starts the plan at FRESH_RETURN_START_FRACTION × current_weekly_km.
  FRESH_RETURN_WEEKS_THRESHOLD: 8,
  FRESH_RETURN_START_FRACTION:  0.7,

  // Heuristic detection (R2/M-03) — when the runner has experienced training
  // age but very low current volume / longest run, infer fresh-from-layoff
  // even without the explicit weeks_at_current_volume input. Both thresholds
  // must be hit; otherwise no inference is made.
  HEURISTIC_FRESH_RETURN_WEEKLY_KM:  25,
  HEURISTIC_FRESH_RETURN_LONG_RUN_KM: 10,

  // ── Injury weekly volume cap (knee, shin splints) ──────────────────────────
  // CoachingPrinciples §2 — for these two injury types, weekly volume cap
  // tightens from MAX_WEEKLY_VOLUME_INCREASE_PCT (10%) to this stricter limit.
  INJURY_WEEKLY_INCREASE_CAP_PCT: 5,  // % above previous week's volume

  // ── Delivered-cap absolute floor (CoachingPrinciples §90/§94, CHARITY-CAP-ABSFLOOR-01) ──
  // A percentage cap on a LOW base magnifies a clinically trivial rise: a
  // knee-history 10K runner adding +3 km of easy volume trips the 5% delivered
  // injury cap at +38%, while the change is one short easy run. The delivered
  // caps (INV-PLAN-INJURY-CAP-DELIVERED §90, INV-PLAN-DELIVERED-RAMP §94) now
  // fire only when the week-on-week rise exceeds BOTH the % cap AND this absolute
  // km floor. Set at 3 km on measurement (Coaching Board 2026-09-13): across a
  // 2,790-plan injury/low-volume grid the flagged non-long-run rises spanned
  // 1–7 km (median 4); a 3 km floor silences the ≤3 km arithmetic noise (49% of
  // flags) while keeping EVERY rise ≥3 km, so no real low-base spike is masked
  // (Sims' condition — a 5 km floor was rejected for masking the 4–7 km band).
  // A COACHING numeric (a clinical-triviality threshold), not the inline
  // DELIVERED_ROUNDING_TOLERANCE_PCT (which absorbs single-km rounding). It gates
  // the CHECKER's warn, never the engine's trim — the producer still caps to §2's injury cap.
  DELIVERED_ABSOLUTE_FLOOR_KM: 3,  // km; a rise below this is not a delivered-cap breach

  // §94 Amendment 1 (RAMP-GUARD-FAILS-OPEN-01, Coaching Board 2026-09-17).
  //
  // Share of a week's DELIVERED rise attributable to the long run above which the
  // §94 violation NAMES the long run as the driver. Gates the MESSAGE, never the
  // prescription — the engine has no lever here, and that is precisely the point.
  //
  // WHY IT EXISTS, from two seats. Seiler: §94 was written for a spike created by
  // a QUALITY trim handing its deficit forward (intensity and volume colliding);
  // the 202 cases that retiring the trimable arm newly surfaces are pure aerobic
  // growth in one long easy run. Different exposures, and one undifferentiated
  // code reporting both gets read as one thing. McMillan: the long run is
  // race-anchored and §45 permits the jump, so a message that reads "the engine
  // failed to prevent this" is false and teaches runners to ignore warnings.
  // Named as long-run-led it reads as coaching.
  //
  // 50% = "more of the rise came from the long run than from everything else".
  DELIVERED_RAMP_LR_ATTRIBUTION_PCT: 50,

  // ── Injury-aware session selection (CoachingPrinciples §21) ────────────────
  // Injury keywords that trigger exclusion of hill sessions during base/build
  // phases. Substrings; matched case-insensitively against injury_history.
  // Peak phase may reintroduce hills only if the runner has completed build
  // symptom-free (gated by explicit user check-in — not yet implemented).
  HILL_RESTRICTING_INJURIES: ['knee', 'itb', 'achilles', 'shin', 'calf', 'plantar'] as readonly string[],

  // Quality sessions per taper week. Last entry is always race week (= 0).
  // Length = total taper-phase weeks INCLUDING race week. Capped per
  // CoachingPrinciples §49 (taper duration). Length must be ≤ MAX_TAPER_PHASE_WEEKS.
  TAPER_QUALITY_PER_WEEK: {
    '5K':       [1, 0],
    '10K':      [1, 0],
    'HM':       [1, 1, 0],
    'MARATHON': [1, 1, 1, 0],
    '50K':      [1, 1, 1, 0],
    '100K':     [1, 1, 1, 0],
  },

  // ── Taper duration cap (CoachingPrinciples §49) ────────────────────────────
  // Maximum total taper-phase weeks INCLUDING race week. Engine cannot allocate
  // more weeks to taper than these caps; excess weeks flow to base / build.
  // Round-2 Case 04 review found a 4-week marathon taper detrains and compresses
  // the build. The cap below holds marathon at 3 actual taper weeks (4 entries),
  // ultra at 3 (was 4 for 100K).
  MAX_TAPER_PHASE_WEEKS: {
    '5K':       2,   // 1 taper + race
    '10K':      2,
    'HM':       3,   // 2 taper + race
    'MARATHON': 4,   // 3 taper + race
    '50K':      4,
    '100K':     4,
  },

  // ── Hard / easy spacing (CoachingPrinciples §7) ─────────────────────────────
  MIN_HOURS_BETWEEN_QUALITY: 48,

  // OVERRIDE — rebuild spec proposed 24h. Set to 48h on coaching grounds:
  // for the target audience, a long run on heavy legs from a quality session
  // the day before is the most reliable injury vector. See CoachingPrinciples §7.
  MIN_HOURS_BETWEEN_QUALITY_AND_LONG: 48,

  // CoachingPrinciples §7 (CD-12) — the two LARGEST aerobic sessions of a week
  // (long run + biggest other run) should sit ≥ this far apart. Enforced by
  // placement where days are flexible; where blocked days force them closer,
  // INV-PLAN-LARGEST-SESSIONS-SPACED surfaces it (warn) rather than silently
  // shipping a lumpy week.
  MIN_HOURS_BETWEEN_LARGEST_SESSIONS: 48,

  // ── Quality session frequency (CoachingPrinciples §8) ───────────────────────
  // OVERRIDE — rebuild spec proposed 3 for experienced. Set to 2 on the basis
  // that the third quality session is rarely accommodated by life and consistently
  // produces the symptoms Zonna exists to prevent. See CoachingPrinciples §8.
  QUALITY_SESSIONS_PER_WEEK_MAX: {
    beginner:     0,
    intermediate: 2,
    experienced:  2,
  },

  // §110 (Coaching Board 2026-09-16, CB-HSR-AVOID-01) — `avoid` is a FLOOR,
  // not a switch. `hard_session_relationship: 'avoid'` used to set
  // plannedQuality = 0 for EVERY week of EVERY plan: 2,197 non-beginner plans
  // on the 15,973-plan sweep got zero quality across 8+ weeks, and — because
  // §1 is a CEILING with no floor — raised no invariant anywhere.
  //
  // Every seat rejected zero. Seiler: self-organising recreational runners land
  // at 10-15% hard, so 100/0 is outside any measured population and is a
  // different model, not a cautious reading of 80/20. Willy: the volume curve
  // still ramps, so zeroing intensity swaps intensity risk for monotonous-volume
  // risk — the one that produces bone stress injuries. Sims: monotonous
  // low-intensity running is close to the worst osteogenic stimulus available,
  // and `avoid` is a box women select more often for cultural rather than
  // physiological reasons. McMillan: "I avoid hard sessions" means "I don't
  // know how", not "never give me one".
  //
  // 1 is the value §96's precedent forces. §96 ruled that a brake "returns the
  // runner to the standard plan, byte for byte. It does not cut below baseline."
  // 1/week IS the baseline for build phase (§8) and for a non-experienced peak;
  // what `avoid` gives up is the experienced runner's SECOND peak quality
  // session. The brake removes the surplus and never the substance.
  //
  // This is the downward rung §35 declared and never built, and which §96
  // identified as missing ("It never built the rung going the other way").
  HARD_AVERSE_QUALITY_PER_WEEK_MAX: 1,

  // §110 Amendment 2 (Coaching Board CB-BEGINNER-TIMEGOAL-01, 2026-09-19) — a
  // BEGINNER WHO SET A TIME TARGET gets one quality session per week. Beginners
  // on a FINISH goal stay at zero, which the same board ruled CORRECT AS IS the
  // same day, unanimously, and did not reopen.
  //
  // ⚠️ §8 HAS DECLARED THIS SINCE THE ORIGINAL SPEC AND THE VALUE CONTRADICTED
  // IT. §8's config block reads `beginner -> 0 (no quality at all in base;
  // light tempo only after week 4)`. The parenthetical describes light tempo;
  // the value makes light tempo impossible. Same shape as §92's phantom
  // enforcement, in reverse — documented intent with a number that forbids it.
  //
  // WHY, MEASURED across 45,888 plans. The gap was BINARY, not a lighter dose:
  //
  //   cohort                        n       zero-quality   any goal-pace session
  //   beginner     · time_target    6,336       100%                0%
  //   intermediate · time_target    6,336         0%              100%
  //   experienced  · time_target    6,336         0%              100%
  //
  // Every cohort that sets a time target runs at that pace except one, which
  // runs at it zero percent of the time. Hutchinson's line was already on the
  // record in §110: "No evidence supports zero intensity as preparation for a
  // time-goal race."
  //
  // ⚠️ WHY 1. §96's precedent, the same one that fixed
  // HARD_AVERSE_QUALITY_PER_WEEK_MAX: 1/week IS the build-phase baseline (§8).
  // Willy's frequency concern (the literature starts a new runner at one
  // session every TWO weeks) was raised and WITHDRAWN ON THE NUMBERS: measured
  // onset is week 5-7 with 6-10 sessions across a 20-week plan, which averaged
  // over the block is already close to every-other-week. The onset gate is
  // unchanged and deliberately so — `plannedQuality` is already 0 in base and
  // 1 in build.
  BEGINNER_TIME_TARGET_QUALITY_PER_WEEK_MAX: 1,

  // §110b — THE WEEK MUST BE ABLE TO CARRY THE SESSION (Willy's condition of
  // approval, sized by measurement 2026-09-19).
  //
  // A quality session is sized by an ABSOLUTE work-minute band
  // (THRESHOLD_WORK_TARGET_MINS), deliberately decoupled from weekly volume
  // (§8/SC-08). That is right for the dose and wrong for a tiny week: the same
  // 8-11 km session is 25% of a 40 km week and 71% of a 16 km one.
  //
  // MEASURED without this gate: **640 NEW §52 breaches on the property sweep**,
  // every one of them a beginner at 5-12 km/week — e.g. "Goal-pace blocks
  // 11.4km is 71% of weekly volume 16km". §52 was right and the ruling needed
  // a floor.
  //
  // 20 km/week is derived, not chosen: the largest beginner quality session
  // measured is 11.4 km, and §52's 60% cap needs a week of at least
  // 11.4 / 0.6 = 19 km to carry it. Below this a beginner gets the plan they
  // got before — all easy, plus §28's strides and hill strides — which the
  // board ruled correct for the finish-goal beginner and is the conservative
  // direction for a time-goal beginner who simply is not running enough yet.
  //
  // ⚠️ THIS IS A FLOOR ON THE WEEK, NOT A SCALING OF THE DOSE. Shrinking the
  // session to fit the week is the CD-1 error (a share of volume cannot express
  // "least sustainable per minute") and would hand a 5 km/week runner a
  // homeopathic tempo. The session keeps its dose; the week has to earn it.
  BEGINNER_QUALITY_MIN_WEEKLY_KM: 20,

  // §110 — the plan length at or above which zero quality is a defect rather
  // than a short-plan artifact, for a non-beginner. 8 weeks is the shortest
  // PLAN_SIGNATURES minimum at any distance, so this binds on every plan the
  // engine can emit that HAS build/peak weeks; the phase gate in
  // INV-PLAN-QUALITY-NOT-ZERO does the real work, and this is the belt.
  QUALITY_FLOOR_MIN_PLAN_WEEKS: 8,

  // §110 Amendment 1 (CB-HSR-AVOID-01 second sitting, 2026-09-16) — `avoid`
  // takes a quality session every Nth BUILD week, not every build week.
  //
  // WHY AN AMENDMENT, AND THE MEASUREMENT THAT FORCED IT. The first sitting set
  // HARD_AVERSE_QUALITY_PER_WEEK_MAX = 1 on the reasoning that §96's precedent
  // ("a brake returns the runner to the standard plan, byte for byte") fixed the
  // value. Measured across a 540-cell grid, that left `avoid` BYTE-IDENTICAL to
  // `neutral` for 72.6% of runners and 100% of intermediates — an intermediate
  // never earns 2 quality/week, so a cap of 2->1 cannot bind on them. §96's own
  // defect, reproduced one section later.
  //
  // The misreading was mine and the constitution had already settled it: §96
  // line 4771 says conflating the two "would take work from a runner who asked
  // to be PACED, not SPARED". `overdo` is paced — baseline. `avoid` is spared —
  // BELOW baseline. "Does not cut below baseline" was scoped to `overdo`.
  //
  // BUILD ONLY. Peak and taper keep full frequency: the reduction belongs where
  // tissue tolerance is still being established (Willy), and §110's floor
  // depends on peak retaining quality, so this can never reach zero. 2 keeps a
  // plan well inside §1's ceiling and gives McMillan the on-ramp the first
  // sitting lost — every other week in build, weekly by peak.
  // §110 Amendment 1 (CB-HSR-AVOID-01 second sitting, 2026-09-16) — `avoid`
  // takes a SMALLER quality session, sized at this % of the standard share.
  //
  // WHY A DOSE AND NOT A FREQUENCY. The first sitting set
  // HARD_AVERSE_QUALITY_PER_WEEK_MAX = 1 and, measured across a 540-cell grid,
  // that left `avoid` byte-identical to `neutral` for 72.6% of runners and
  // 100% of intermediates — an intermediate never earns 2 quality/week, so a
  // cap of 2->1 cannot bind. §96's own defect, one section later.
  //
  // The obvious second lever — a quality session every OTHER build week — was
  // built, measured and WITHDRAWN. It collided with §5's VO2max adaptation
  // deadline, then §53's variety cap (61 new errors), then §79's intensity
  // re-entry window (264 new errors). The build rotation is tightly coupled;
  // dose is the one axis nothing else keys on, and §9's re-derivation returns
  // the freed distance to the easy runs (VOL-SHORTFALL-01: volume-preserving).
  //
  // 85 IS DERIVED, NOT PICKED — it is the deepest cut §52 absorbs. Swept
  // 70 / 75 / 80 / 85 across 15,973 plans: everything below 85 fires a NEW
  // INV-PLAN-LR-MAX-WEEKLY-PCT error on a 3-day HM profile ("long run 18.5km is
  // 62% of weekly volume 30km"), and 85 is clean.
  //
  // The mechanism is worth recording because it qualifies a finding this repo
  // already relies on. VOL-SHORTFALL-01 measured that shrinking a quality
  // session PRESERVES weekly volume, because §9's re-derivation hands the freed
  // distance to the easy runs. That was measured on a FIVE-day profile. On a
  // three-day week there are not enough easy slots to absorb it against §9's
  // own easy ceiling, so the week genuinely shrinks and the long run's share
  // rises past §52's 60% cap. **VOL-SHORTFALL-01's result holds where it was
  // taken and not below it** — the same "a number surviving a change to what it
  // means" trap CD-21 records.
  //
  // Reach is unaffected by the choice: 70, 75, 80 and 85 all leave `avoid`
  // inert on the same 27% of intermediate cells (those already pinned at
  // MIN_SESSION_DISTANCE_KM), so nothing is bought by cutting deeper.
  //
  // Bounded below by MIN_SESSION_DISTANCE_KM, which stops the session
  // degenerating into a token effort on a low-volume week (Hutchinson/Sims —
  // the same floor reasoning §8 uses for the VO2max work minimum).
  HARD_AVERSE_QUALITY_DOSE_PCT: 85,

  // Fitness classification (D2, 2026-08-06). VDOT measures what a runner can
  // currently RACE; volume measures what they can currently ABSORB. Both are
  // consulted — see assessFitness(). On disagreement the lower level drives
  // structure and the higher drives the intensity allowance.
  FITNESS_VDOT_THRESHOLDS: {
    intermediate_min: 35,   // vdot < this → beginner
    experienced_min:  50,   // vdot > this → experienced
  },
  FITNESS_VOLUME_THRESHOLDS: {
    beginner_max_weekly_km:    20,   // below this weekly volume → beginner
    beginner_max_long_km:       8,   // or below this longest run → beginner
    experienced_min_weekly_km: 55,
    experienced_min_long_km:   20,
  },

  // ── Long-run rules (CoachingPrinciples §9) ──────────────────────────────────
  // Phase-aware fraction of weekly volume.
  LONG_RUN_PCT_OF_WEEKLY_VOLUME: {
    base:  28,
    build: 30,
    peak:  32,
    taper: 40,
  },

  // Long run must be at least this multiple of the easy session distance.
  // Enforces the principle that the long run is always the longest run of the
  // week. When the natural phase-fraction-based distribution would invert this
  // (low-volume / low-day-count plans), the engine redistributes volume to
  // honour this ratio while preserving total weekly km.
  LONG_RUN_MIN_RATIO_VS_EASY: 1.25,

  // Absolute time cap, by race distance.
  LONG_RUN_CAP_MINUTES: {
    '5K':       90,
    '10K':      120,
    'HM':       135,
    'MARATHON': 210,
    '50K':      300,
    '100K':     420,
  },

  // Tighter cap for finish-goal 5K plans (CoachingPrinciples §40, R2/L-01).
  // 5K finish-goal runners don't need 84-minute long runs; aerobic development
  // through frequency + total volume, not extended LRs.
  LONG_RUN_CAP_MINUTES_5K_FINISH: 70,

  // §80 Amendment 1 (LR-SHORTFALL-CAUSE-01, Coaching Board 2026-09-18) — how
  // close to LONG_RUN_CAP_MINUTES counts as "the cap is what stopped us".
  //
  // NOT a fudge factor. The cap is applied on the KILOMETRE axis
  // (`result = absCapMins / paceMinPerKm`) and the distance is then rounded, so
  // a capped long run lands slightly UNDER its own ceiling and rarely satisfies
  // a one-minute tolerance: 0 of 5,264 notes named the cap across the cohort and
  // targeted grids, while 71.0% sat 2–3 minutes beneath it and blamed the
  // runner's weekly volume instead. (NOT impossible — `noteNamesBindingLever`
  // builds a persona that does reach `cap − 1`. Zero in the corpus is not
  // "cannot fire".)
  //
  // Measured, per §40c's standard. Gap below cap: 2 min × 2,420 · 3 min × 1,316
  // · NOTHING at 4 or 5 · a scattered tail from 6. The empty band means any
  // value in 3–5 splits the population identically, so this sits in a flat
  // region rather than on a cliff.
  LONG_RUN_AT_CAP_TOLERANCE_MINS: 3,

  // §80 Amendment 1 — the smallest long-run shortfall worth telling a runner
  // about, as a share of §80's floor.
  //
  // The note had NO floor and fired at a 2-minute shortfall (1.7% of the
  // floor), attached to "expect the last stretch of race day to be new
  // territory". §40c sets the doctrine: "notes that fire on noise get ignored,
  // which costs more than the note gains" (McMillan).
  //
  // 5%, not §40c's 10%. Shortfall as a share of the floor: min 1.7%, p10 8.8%,
  // median 11.9%, max 39.0%. 5% silences 2.6% — the rounding cases — while 10%
  // would silence 30.5%, and a marathoner 10% short of the §80 floor is ~24
  // minutes short, which is signal, not noise.
  LONG_RUN_SHORTFALL_MATERIAL_PCT: 5,

  // ── Peak long-run race specificity (CoachingPrinciples §24, §35) ──────────
  // Time-targeted plans for HM and longer require race-distance specificity in
  // the long run. Floor (not ceiling) — peak long run must REACH this fraction
  // of race distance, capped by LONG_RUN_CAP_MINUTES. Distances ≤10K do not
  // require race-distance specificity (their long run is for aerobic
  // development, not specificity).
  //
  // Three tiers (R2/M-01):
  //   floor   — default, conservative; engine guarantees this minimum.
  //   target  — runner's longest_recent_run_km is ≥ floor of race distance.
  //   stretch — runner has hard_session_relationship: 'love', no injury
  //             history, and longest_recent_run_km ≥ floor.
  // Floors are minimums, not targets — when persona supports more, push higher.
  PEAK_LR_RATIO_VS_RACE: {
    HM:       0.85,
    MARATHON: 0.75,
  },
  // CoachingPrinciples §80 (D3, 2026-08-06) — finish-goal HM/marathon peak long
  // run as a fraction of projected race DURATION, not distance. A first-timer is
  // time-on-feet limited, not aerobically limited; the number that matters to
  // them is how long they will be moving, and run-walk counts. Subject to the
  // LONG_RUN_CAP_MINUTES ceiling, which still wins.
  FINISH_GOAL_PEAK_LR_RATIO_VS_RACE_DURATION: 0.70,
  PEAK_LR_RATIO_TARGET: {
    HM:       0.90,
    MARATHON: 0.80,
  },
  // PEAK_LR_RATIO_STRETCH — REMOVED 2026-09-15 (Coaching Board,
  // LR-TIER-GATE-RECONCILE-01, §35 Amendment 2).
  //
  // §35's third rung was gated on `hard_session_relationship: 'love'` with no
  // training-age floor, while §47's exception answers the same question and
  // requires no injury at all AND `5yr+`. The weaker gate was the one adding
  // distance (Sims). It was also INERT — measured 0 of 36 comparable plans, so
  // removal has provably no delivered effect.
  //
  // ⚠️ THIS IS A BOARD DELETION, NOT A TIDY-UP, and §25 Amendment 1 is why the
  // distinction matters: "read by nothing" is evidence a CONSUMER is missing,
  // not that the VALUE is junk — `race_pace_pct` was deleted on that reasoning
  // while §25 ratified it one section away. Here the value IS read, its effect
  // was MEASURED as zero, and the board ruled on it explicitly. Do not cite this
  // as precedent for deleting an unread constant.

  // First two weeks of any plan: long run capped at longest_recent_run_km × this.
  WEEK_1_2_LONG_RUN_CAP_MULTIPLIER: 1.10,

  // ── VDOT conservatism (CoachingPrinciples §10) ──────────────────────────────
  // The signature Zonna move: err on the side of restraint when in doubt.
  VDOT_CONSERVATIVE_DISCOUNT_PCT: 3,

  // §109 Amendment 1 — the no-measurement estimate (Coaching Board 2026-09-17).
  //
  // Where a runner has NO benchmark and NO qualifying runs, the race-projection
  // card has nothing measured to work from. It used to assert a VDOT from a
  // hand-authored 3x4 table living in `app/api/race-times/route.ts`: twelve
  // numerics outside this file, explained by no principle, invisible to
  // `configPrincipleSync.test.ts` and to the coaching-guard hook. The
  // `peakKmByLevel` / §106 class exactly.
  //
  // ⚠️ IT CONTRADICTED §13 IN SIX OF TWELVE CELLS. A runner classified
  // `experienced` was assigned VDOT 45 or 48, both BELOW `experienced_min: 50`;
  // a runner classified `beginner` was assigned 37, ABOVE `intermediate_min: 35`.
  // Two of our own numbers disagreeing, and the one reaching runners was the one
  // no principle explained. Measured: this table is the sole source of the
  // projected times for 58% of plans.
  //
  // SO IT IS DERIVED, NOT ASSERTED. The level's own §13 band supplies the
  // anchor; training age only positions the runner WITHIN it. A §13
  // contradiction is then impossible by construction rather than corrected once.
  // Band width is `experienced_min - intermediate_min`, which §13 itself
  // defines — no new band numeric enters.
  //
  // THE FRACTIONS ARE NOT NEW EITHER. They are the shipped intermediate row's
  // own within-band positions (38/42/45/48 against [35,50]) — the one row that
  // was already internally consistent. Applying them to every level leaves the
  // intermediate row byte-identical, which matters: it is the majority path, so
  // the blast radius is confined to the two rows that were actually wrong.
  //
  // ⚠️ PROVENANCE, stated because nobody could state it before (Sims): these
  // are a PRIOR, not a measurement, and the population they describe is
  // unrecorded. Daniels' normative data skew male. They are not sex-adjusted and
  // must not be — VDOT is a performance measure, and a woman who runs the time
  // has the VDOT. The honest correction is the width of the claim, not its level.
  //
  // ⚠️ Seiler: improvement in recreational runners is FRONT-LOADED, so these
  // decelerate (+0.27, +0.20, +0.20) rather than climbing linearly. The exact
  // curve is under-evidenced and the board recorded INSUFFICIENT EVIDENCE on it;
  // anchoring on §13 sidesteps that, because it requires only that we stop
  // contradicting ourselves, not that we know the true curve.
  //
  // ⚠️ NOT ROUND NUMBERS ON PURPOSE. These are offsets of 3, 7, 10 and 13
  // within the 15-wide band, i.e. exactly the shipped intermediate row
  // (35+3=38, 35+7=42, 35+10=45, 35+13=48). Rounding them to 0.47/0.67/0.87
  // lands on 42.05/45.05/48.05 and moves the majority path by a tenth of a
  // VDOT for no reason — the point of reusing this row is that it does NOT move.
  ESTIMATE_VDOT_BAND_FRACTIONS: {
    '<6mo':   0.2000,   //  3/15
    '6-18mo': 0.4667,   //  7/15
    '2-5yr':  0.6667,   // 10/15
    '5yr+':   0.8667,   // 13/15
  },

  // §109 Am.1 — conservatism on an UNMEASURED estimate. Deliberately larger
  // than §10's `VDOT_CONSERVATIVE_DISCOUNT_PCT: 3`, which discounts paces
  // derived from a real benchmark: there the engine is protecting a runner from
  // training at race-day output, here it is hedging a number nobody measured at
  // all. The two are not the same quantity and must not share a constant — the
  // route previously applied a bare `* 0.95` with no name and no principle,
  // which is a second conservatism doctrine by accident.
  ESTIMATE_VDOT_DISCOUNT_PCT: 5,


  // R2/L-03 — staleness compounding. Discount scales with benchmark age:
  // base discount ≤ FRESH_WEEKS, then +PER_4WK_PCT per additional 4-week
  // block, capped at MAX_PCT. Replaces the binary 6-month threshold; the
  // legacy fields above are retained for back-compat with applyRecalibration.
  VDOT_STALENESS_FRESH_WEEKS:        4,   // ≤ this many weeks: base discount only
  VDOT_STALENESS_PER_4WK_PCT:        1,   // +1% per additional 4-week block
  VDOT_STALENESS_MAX_DISCOUNT_PCT:   7,   // cap at 7% total

  // ── Pace and zone display rules (CoachingPrinciples §11, §12) ───────────────
  USE_PACE_RANGES_NOT_POINTS: true,
  EASY_RUN_ZONE_CAP: 'Z2_TOP', // resolves to top of ZONES.Z2 at runtime

  // ── Cross-session intensity ordering (CoachingPrinciples §83, CD-16/SC-06) ──
  // How much faster than derived INTERVAL pace a runner's stated GOAL pace may
  // be before the plan must admit the target sits beyond measured fitness.
  //
  // Why a tolerance at all rather than a strict comparison: goal pace comes from
  // the runner's stated target time, interval pace from their benchmark VDOT.
  // Two independent derivations landing within a rounding width of each other is
  // noise, not an inversion. Beyond this width it is a real ordering failure —
  // the sessions labelled VO2max are prescribed slower than the sessions labelled
  // race pace, and a runner following pace and a runner following heart rate are
  // running two different plans.
  //
  // 0.5% ≈ 1.4 s/km at 4:30/km. The audit's traced case sits ~1.1% inside the
  // inversion (goal 4:30 vs interval 4:33), so it is caught with margin to spare.
  INTENSITY_ORDERING_TOLERANCE_PCT: 0.5,

  // ── Race-specific ownership (CoachingPrinciples §22, CD-18/SC-05) ───────────
  // Distances whose race pace is physiologically DISTINCT from interval pace,
  // and which must therefore own a `race_specific` catalogue session rather than
  // borrowing the all-distance sharpener or a renamed row.
  //
  // 5K is absent on purpose: at 5K, race pace and I-pace largely coincide, so
  // the VO2max rows already deliver race-specific physiology. CD-18's "who this
  // affects" aside said 5K has "the identical gap"; the audit grounds the
  // mismatch in race pace sitting BETWEEN threshold and VO2max for a 10K, which
  // does not transfer. Flagged to the board in §22 — if they disagree, add '5K'
  // here and a 5K catalogue row in the same commit.
  //
  // 50K/100K are absent because their signature focus is `ultra_specific`, not
  // `race_specific` (see PLAN_SIGNATURES).
  RACE_PACE_DISTINCT_FROM_INTERVAL_PACE: ['10K', 'HM', 'MARATHON'] as const,

  // Fitness classification config lives in FITNESS_VDOT_THRESHOLDS +
  // FITNESS_VOLUME_THRESHOLDS above (dual-signal, CoachingPrinciples §79). The
  // former single FITNESS_THRESHOLDS key was superseded by GEN-FIX-07/D2 and
  // removed 2026-08-06 (GEN-FIX-11, D-18) — a dead duplicate, same values, no
  // consumer.

  // ── Max HR formula (CoachingPrinciples §14, zone-rules.md) ──────────────────
  // Tanaka: 208 − 0.7 × age. Used as a fallback when user has not provided max_hr.
  MAX_HR_FORMULA: 'tanaka',

  // ── HR zones (CoachingPrinciples §14, zone-rules.md) ────────────────────────
  // Five named zones, two formulas. Karvonen when resting HR present, % MaxHR
  // otherwise. Auto-selection lives inside computeZones() in ruleEngine.ts.
  //
  // Forward compat: a future paid "zone method selector" feature swaps these
  // tables based on user_settings.zone_method (Karvonen / Daniels / Friel / etc).
  // No engine or consumer change required — they all read zone strings.
  ZONES: {
    Z1: { karvonen_pct: [50, 60],  maxhr_pct: [65, 70]  },
    Z2: { karvonen_pct: [60, 70],  maxhr_pct: [70, 80]  },
    Z3: { karvonen_pct: [70, 80],  maxhr_pct: [80, 87]  },
    Z4: { karvonen_pct: [80, 90],  maxhr_pct: [87, 93]  },
    Z5: { karvonen_pct: [90, 100], maxhr_pct: [93, 100] },
  },

  // ── Displayed zone source (CoachingPrinciples §84 — Coaching Board 2026-09-04) ─
  // The zone a runner SEES (session-detail header, Today's "Hold the zone"
  // eyebrow, the ZoneBar) and the zone/bpm a coach note states MUST derive from
  // the session's PRESCRIBED work — carried on `session.zone` as a single zone
  // or a range ("Zone 4–5") — never from the coarse `session.type` slot. Every
  // quality session is typed `quality`, so a type→zone map collapsed tempo, VO2
  // and hill reps all to a flat "Zone 3", contradicting the coach note (which
  // reads session.zone) on the same card. One source, no contradiction.
  DISPLAY_ZONE_SOURCE: 'session.zone' as const,

  // ── Long run segment sizing (CoachingPrinciples §24b, §24c, §24d) ──────────
  // Segment = the final fraction of long run distance prescribed at a faster pace.
  // "mid peak"   = all peak weeks except final 2 before taper
  // "final peak" = last 2 peak weeks before taper
  // Change 3 (finish-goal) applies to the final non-deload peak week only (singular).
  // Pace keys reference PaceGuide fields — looked up at session-build time.
  LR_5K10K_PEAK_MID_SEGMENT_PCT:       0.20,              // last 20% at marathon pace
  LR_5K10K_PEAK_FINAL_SEGMENT_PCT:     0.30,              // last 30% at HM pace
  LR_5K10K_PEAK_MID_PACE:              'marathonPaceStr' as const,
  LR_5K10K_PEAK_FINAL_PACE:            'hmPaceStr'       as const,
  LR_FINISH_GOAL_LATE_PEAK_SEGMENT_PCT: 0.10,             // last 10% at Z2 ceiling (finish-goal final peak)

  // §25 Amendment 1 (Coaching Board 2026-09-14). The ratified band for the
  // HM/marathon race-specific long run's race-pace finish, as a percentage OF
  // THE LONG RUN. The per-distance number lives on the catalogue row
  // (`main_set_structure.race_pace_pct`: HM 35, MARATHON 40) because it is a
  // property of that session; this is the envelope every such row must sit in,
  // and it is what makes §25's "final 25–40%" checkable instead of prose.
  //
  // It had no numeric and no check for months, and three different answers
  // shipped side by side: the row's 35/40, a hand-typed note saying "Final
  // 30–50% at MP" (which BREACHED this ceiling), and a display layer applying
  // §16's general 20% to the main set (~16% of the session). One segment, three
  // numbers, two of them on the same card.
  LR_RACE_SEGMENT_PCT_MIN:              25,
  LR_RACE_SEGMENT_PCT_MAX:              40,

  // ── Foundation Block (CoachingPrinciples §57) ─────────────────────────────
  // Pre-plan preparation phase inserted before W1 when the gap between today
  // and plan_start exceeds GAP_MIN_AUTO_DAYS. Uses negative week indices.
  FOUNDATION_GAP_NUDGE_DAYS:    7,   // < 7 days: inline nudge only
  FOUNDATION_GAP_AUTO_DAYS:    28,   // 7–28: auto-generate silently
  // > 28: offer three-option choice (see foundationBlock.ts)
  FOUNDATION_MAX_WEEKS:         3,   // max foundation block length (weeks)

  // CoachingPrinciples §57 Amendment (FOUNDATION-LONG-RUNWAY-01, Coaching Board
  // 2026-09-15) — whole uncovered weeks at or above which the plan MUST carry an
  // honest note about them.
  //
  // MEASURED. A charity runner typically gets their place months out, so a long
  // runway is the NORMAL case for this cohort, and the block does not reach it:
  // at a 25-week runway M1 gets 3 foundation + 18 main = 21 covered and 4 weeks
  // UNCOVERED; at 30w it is 9, at 40w 19, at 52w 31. The runner opens the app on
  // 21 September and the first dated thing on their plan is 18 October.
  //
  // The filed remedy — raise FOUNDATION_MAX_WEEKS — was VETOED on measurement:
  // §57's own "final foundation week must not exceed effective baseline x 1.10
  // REGARDLESS of block length" binds from week 2, so a forced 12-week block
  // delivers 15.0 then 16.4 eleven times. Nine identical weeks is not
  // preparation, and CB-1 already ruled the block is "habit and routine, not
  // adaptation" (Sims).
  //
  // TWO, not one. One week before a plan starts is a rest-and-admin week and a
  // note about it is noise (NOISE-GATE-01); the <7-day case already has §57's
  // inline nudge. Two or more is a void the runner fills by guessing — §76's own
  // words for the same failure at the other end of the plan.
  FOUNDATION_UNCOVERED_WEEKS_NOTE_THRESHOLD: 2,
  FOUNDATION_WEEKLY_INCREASE_PCT: 10, // max +% per week within the block
  FOUNDATION_LONG_RUN_MAX_PCT:   35, // long run cap as % of that week's weekly_km — aligned with §9's binge threshold (Coaching Board, Coaching-1). Was 50, which let the long run dominate a reduced fresh-return week.
  FRESH_RETURN_EFFECTIVE_BASELINE_FRACTION: 0.70, // mirrors FRESH_RETURN_START_FRACTION

  // CB-1 (Coaching Board, 2026-09-03) — the minimum number of sessions a
  // foundation week needs before it can carry a DISTINCT long run.
  //
  // DERIVED, not chosen. With the long run capped at FOUNDATION_LONG_RUN_MAX_PCT
  // (35%) and §9 requiring long >= LONG_RUN_MIN_RATIO_VS_EASY (1.25) x easy, the
  // (n-1) easy runs share the remaining 65%:
  //
  //     n = 2 -> easy 65.0%  ratio 0.54  x
  //     n = 3 -> easy 32.5%  ratio 1.08  x
  //     n = 4 -> easy 21.7%  ratio 1.62  ok
  //
  // Below 4 sessions an inverted week is arithmetically FORCED by two numbers
  // the board itself set — the shortest run of the week ends up labelled "Long
  // easy". Measured before this shipped: 49,974 INV-PLAN-LONG-IS-LONGEST
  // violations across 24,219 foundation weeks.
  //
  // The board's ruling was "reduce days, never inflate sessions" and "the
  // inverted week is a defect at any volume". The honest consequence is that a
  // foundation week below this many sessions has NO long run — it is equal easy
  // runs, which is what it actually is. See CoachingPrinciples §57.
  FOUNDATION_MIN_SESSIONS_FOR_LONG_RUN: 4,
  // §92 (Coaching Board CB-ONSET-02, 2026-09-07) — §57 bans strides in the
  // foundation block. That ban is lifted for, and ONLY for, a runner who passes
  // the §89 readiness gate (which carries an absolute injury veto — Willy's
  // condition). Strides are neuromuscular and fully recovered: they add no Z3
  // minutes, so §1 is untouched, and they are not `quality`, so they do not
  // count against INTENSITY_DISTRIBUTION. A feel fix, not a fitness one.
  FOUNDATION_STRIDES_REQUIRE_EARLY_ONSET: true,

  // §81 (Coaching Board, MWM-02, 2026-09-03) — how far the long run may exceed
  // the runner's stated weekday ceiling before the plan stops calling itself a
  // race plan.
  //
  // The long run is EXEMPT from `max_weekday_mins` (capping it produces a "long
  // run" shorter than the easy runs — the board vetoed that trade). But an
  // exemption is not a licence to ignore the runner: past this margin the
  // session is not a stretch, it is a different time budget, and the plan must
  // say so and classify maintenance (§52's third remedy, §40c's "a suppressed
  // target is stated, never absorbed silently").
  //
  // Measured on runners who blocked BOTH weekend days — the population this
  // affects — 823 of 896 plans put the long run over the weekday cap, median
  // overrun 127%, p90 347%. At 50% the honest split is ~22% keep a race plan,
  // ~78% are told plainly that these constraints support maintenance.
  LONG_RUN_WEEKDAY_OVERRUN_MAINTENANCE_PCT: 50,

  // §82 (Coaching Board, 2026-09-03) — EASY-RUN FLOOR PROTECTION.
  //
  // applyWeekdayMinsCap can scale an easy run's distance below
  // MIN_SESSION_DISTANCE_KM.easy — §9's floor for "too short to be
  // coaching-meaningful". The engine now holds the session at the floor
  // instead, so its duration exceeds max_weekday_mins by a few minutes rather
  // than delivering a session that trains nothing. One occurrence is
  // arithmetic (a cap value that happens to land under the floor for this
  // runner's pace); recurrence across this many weeks means the runner's day
  // count doesn't fit their stated time budget at their current volume — the
  // same diagnosis §52b makes at construction, surfacing late. At or past this
  // count the plan must say so and classify maintenance (§52's third remedy).
  EASY_RUN_FLOOR_PROTECTION_MAINTENANCE_WEEKS: 2,

  // ── Stimulus rank — quality session escalation order (V5) ──────────────────
  // Numeric stimulus rank used to validate progressive escalation of quality
  // sessions through the build phase. A later quality session must NOT regress
  // below the previous one in rank, except immediately following a deload week
  // (recovery resets the ladder). Coaching rationale: build-phase progression
  // is what produces adaptation — repeating tempo → tempo → tempo or stepping
  // back from hills to strides wastes the build window.
  // Keys match the canonical labels emitted by the catalogue / quality session
  // builders. `match()` lookup in ruleEngine.ts maps free-text labels onto
  // these keys via substring match.
  STIMULUS_RANK: {
    strides:        1,
    easy:           1,
    steady_aerobic: 2,
    hills:          3,
    tempo:          4,
    race_pace:      4,
    vo2max:         5,
  },

  // ── VO2max onset timing (V2, race ≤ 21km only) ─────────────────────────────
  // VO2max work needs ~4–6 weeks to produce measurable adaptation. The first
  // VO2max session must therefore appear no later than:
  //   total_weeks − taper_weeks − VO2MAX_ONSET_MIN_ADAPTATION_WEEKS
  // i.e. there must be at least N weeks of build/peak following the first
  // VO2max session before taper begins. Below this window, the engine swaps
  // an earlier non-VO2 quality with a VO2 session.
  VO2MAX_ONSET_MIN_ADAPTATION_WEEKS: 5,

  // ── Long-run consecutive-repeat ceiling (V4) ───────────────────────────────
  // Long run distance must not repeat identically across more than
  // LR_MAX_CONSECUTIVE_REPEATS non-deload weeks. Beyond that, the third
  // (and subsequent) week increments by LR_REPEAT_INCREMENT_KM. Capped so
  // the long run does not exceed race_distance × multiplier.
  // Coaching rationale: a flat long run across 4+ build weeks is a sign the
  // engine has stalled. Modest progression (+1km) is a stronger stimulus than
  // pure repetition without over-extending.
  LR_MAX_CONSECUTIVE_REPEATS: 2,
  LR_REPEAT_INCREMENT_KM:     1,
  LR_RACE_DISTANCE_MULT_SHORT: 1.8,  // ≤ 21km races
  LR_RACE_DISTANCE_MULT_LONG:  2.0,  // > 21km races

  // ── Pre-plan buffer guidance threshold (V6) ────────────────────────────────
  // When prep_time_weeks_available − prep_time_weeks_required > this, emit a
  // pre_plan block on the plan with maintenance guidance for the buffer
  // period. Below this, no narrative output (the plan starts later but
  // doesn't need a separate guidance block).
  PRE_PLAN_BUFFER_WEEKS_THRESHOLD: 4,

  // ── Days-availability gate (CoachingPrinciples §52, low-day extension) ────
  // Per-distance minimum days/week thresholds. Mirrors PREP_TIME_THRESHOLDS
  // pattern: block (refuse generation), warn (refuse unless acknowledged;
  // generates as maintenance), ok (no friction).
  //
  // Coaching rationale: with too few sessions per week, the long run is
  // forced to dominate weekly volume — the §52 LR/weekly cap (60%) becomes
  // structurally unsatisfiable. For long-distance training, ≥3 days/wk is
  // the floor below which the engine cannot produce a coherent plan; ≥4 is
  // ideal. For shorter races (5K/10K), 2 days remains viable.
  //
  // Returning runners shift block up by one day — coming back from a layoff
  // on minimum days is a higher injury risk than a consolidated runner on
  // the same cadence.
  DAYS_AVAILABILITY_THRESHOLDS: {
    '5K':       { block: 1, warn: 1, ok: 2 },
    '10K':      { block: 1, warn: 1, ok: 2 },
    'HM':       { block: 2, warn: 2, ok: 3 },
    'MARATHON': { block: 3, warn: 3, ok: 4 },
    '50K':      { block: 3, warn: 3, ok: 4 },
    '100K':     { block: 3, warn: 3, ok: 4 },
  },
  DAYS_AVAILABILITY_RETURNING_RUNNER_SHIFT: 1,

  // ── V1 simultaneous volume + quality intro split tolerance ────────────────
  // If week N introduces the first quality session of the plan AND the volume
  // step from N-1 to N exceeds this fraction (1.05 = 5%), the engine holds
  // volume constant in week N. Coaching rationale: introducing a new stress
  // (quality) on top of a meaningful volume bump compounds adaptation load.
  // Better to land one stimulus at a time.
  V1_VOLUME_QUALITY_SPLIT_THRESHOLD_PCT: 5,

  // ── Pre-session readiness signal (CoachingPrinciples §59) ───────────────────
  // The only adjustment trigger that fires BEFORE a run, not after. Composite
  // of three weak signals (RHR / HRV / sleep) — any one fires the soften.
  // Dormant until the user has 14 days of HealthKit samples (silent for new
  // users — no false-positive pollution while the baseline accrues).
  READINESS: {
    /** RHR (bpm) at or above baseline + this delta fires. */
    RHR_ELEVATION_BPM:       7,
    /** HRV (ms) at or below baseline − N standard deviations fires. */
    HRV_DECLINE_SD:          1,
    /** Sleep below this many hours on the night before quality/long fires. */
    SLEEP_THRESHOLD_HOURS:   5,
    /**
     * DS-05 — sleep QUALITY sub-signal. When total sleep was adequate
     * (>= SLEEP_THRESHOLD_HOURS) but deep sleep was a smaller share of staged
     * sleep than this floor, recovery is incomplete even though duration looked
     * fine. Healthy adult deep sleep is ~13–23% of total; below 10% is genuinely
     * low. Conservative on purpose — deep sleep is night-to-night noisy and this
     * is the weakest of the four readiness signals. Only assessed when the source
     * supplied a stage breakdown (deep+rem+light minutes > 0).
     */
    DEEP_SLEEP_PCT_FLOOR:    0.10,
    /** Rolling baseline window (days). */
    BASELINE_WINDOW_DAYS:    14,
    /** Long-run distance multiplier when readiness softens (15% trim). */
    LONG_RUN_SOFTEN_PCT:     0.85,
  },

  // ── Reshape auto-apply thresholds (CoachingPrinciples §69) ──────────────────
  // Wave 3 of the 2026-06-26 reshape remediation. Replaces the binary
  // advisory-vs-autonomous question with magnitude-calibrated confirmation.
  //
  // Doctrine (Wendy Wood, SLT 2026-06-26):
  // - Sub-threshold changes auto-apply silently — small intensity tweaks,
  //   sub-15% distance trims, coach-note-only adjustments. The runner doesn't
  //   need to consent to a 1km easy-run trim; the engine's job is to absorb
  //   that decision quietly. Habit formation depends on automaticity.
  // - Threshold-crossing changes — day-of-week moves, session-type changes,
  //   week-volume changes above the floor — require a confirmation tile with
  //   the Wave 2A diff. The runner sees what changes before it lands.
  // - Skip-with-reason and user-initiated reorders are structural by
  //   definition and ALWAYS require confirmation regardless of magnitude.
  //
  // The 2026-06-26 incident's Row 2 ("rest day from tue to thu" → long run
  // landed on tue) was classified as `requiresConfirmation: false` by the
  // pre-Wave-3 builder because no §7 violation fired. The new threshold
  // catches it: any session_reorder is high-magnitude, period.
  //
  // Principle: CoachingPrinciples §69 — "Magnitude calibration: the
  // structural change that earns confirmation."
  RESHAPE_AUTOAPPLY_THRESHOLDS: {
    /**
     * Per-session distance trim/extend (percent) above which a `modified`
     * day in the diff is treated as high-magnitude. Below this threshold,
     * the engine may silently auto-apply. 15% mirrors the existing
     * `LOAD_RATIO.watch` reduce-volume trim — that exact engine behaviour
     * is sub-threshold by design.
     */
    DISTANCE_CHANGE_PCT_THRESHOLD: 15,

    /**
     * Week-total distance change (percent) above which any cumulative
     * adjustment becomes high-magnitude even when each individual day's
     * trim is sub-threshold. Catches the "death by 1000 cuts" failure
     * mode where the engine could chain three small trims into a 20%
     * weekly load reduction without the runner ever consenting.
     */
    WEEK_VOLUME_PCT_THRESHOLD: 15,
  },

  // ── Post-race maintenance block (CoachingPrinciples §75, MAINT-01) ─────────
  // Duration is distance-keyed. Two phases: quality blackout (Phase 1, restoration)
  // and base maintenance (Phase 2). Modifiers extend Phase 1 only.
  //
  // Phase 1 volume follows POST_RACE_RECOVERY_BY_DISTANCE.volume_curve_pct.
  // Phase 2 volume is a flat fraction of the plan's peak weekly_km.
  POST_RACE_MAINTENANCE_BLOCK: {
    PHASE1_WEEKS_BY_DISTANCE: {
      '5K': 1, '10K': 1, 'HM': 1, 'MARATHON': 2, '50K': 3, '100K': 4,
    },
    PHASE2_WEEKS_BY_DISTANCE: {
      '5K': 3, '10K': 3, 'HM': 3, 'MARATHON': 5, '50K': 5, '100K': 7,
    },
    // ── Volume: anchored to plan BASE, not peak (§75, rev 2026-08-02) ──────────
    // Maintenance is "return to sustainable base and tick over" — NOT "hold near
    // peak". The old model anchored to plan peak (70%), which prescribed
    // near-full training load for weeks with no goal race. We now anchor to the
    // plan's BASE volume (the level the athlete sustainably built from) and
    // default BELOW it (Option 1 — conservative tick-over). Intent can raise it.
    PHASE2_VOLUME_PCT_OF_BASE: 55,       // Phase 2 "tick-over" target as % of plan base weekly_km (tick_over intent).
    RESTORATION_START_PCT_OF_BASE: 25,   // Phase 1 week-1 volume as % of base — starts very low, ramps up to the Phase 2 target.
    VOLUME_CEILING_PCT_OF_BASE: 100,     // hard cap — no maintenance week exceeds base volume (INV-MAINT-VOLUME-CEILING).
    // Intent multiplier (§75 Layer 5): scales the base-anchored volume by what the
    // athlete wants from the period. Default 'tick_over'. Applied to PHASE2 target
    // then clamped to VOLUME_CEILING_PCT_OF_BASE (never above base).
    INTENT_VOLUME_MULTIPLIER: { rest: 0.6, tick_over: 1.0, stay_sharp: 1.6 },
    PHASE2_LONG_DAY_PCT: 35,             // % of weekly volume placed on the longer training day (Saturday).
    // Matches the ~35% long-run share in Phase 1 / Phase 2 base weeks. If a coach
    // wants flatter distribution, reduce toward 25% (equal share across 4 days).
    PHASE2_QUALITY_PER_WEEK: 1,          // max quality sessions in Phase 2
    RPE_BLACKOUT_EXTENSION_THRESHOLD: 8, // race-day rpe >= this → +1 week restoration
    MARATHON_BLACKOUT_RANGE: [2, 3],     // Marathon Phase 1 min/max; RPE selects upper
    PHASE3_LAST_WEEKS: 2,                // final N weeks of Phase 2 become Phase 3 (ambient re-engagement)
    MIN_BASE_KM_FLOOR: 15,               // floor for plan base weekly_km when computing maintenance volumes.
    // Prevents degenerate maintenance plans for users whose plan base was unusually low.
    ACTUAL_CADENCE_MIN_COMPLETED_RUNS: 8, // confidence floor: need ≥ this many COMPLETED runs before
    // trusting actual-cadence detection (days + frequency from session_completions, §75). Below it,
    // fall back to plan-prescribed cadence — don't infer an athlete's rhythm from a handful of logs.
    // ── Person-aware duration modifiers (§75 Layers 2–4) ──────────────────────
    // Restoration (Phase 1) extends when the data says the athlete needs longer.
    RESPONSE_HEAVY_TAG_FRACTION_THRESHOLD: 0.3, // ≥30% of logged sessions tagged Heavy/Wrecked → the plan was hard on them.
    RESPONSE_HIGH_RPE_THRESHOLD: 7,      // mean logged RPE ≥ this → the plan was hard on them.
    RESPONSE_FATIGUE_PHASE1_EXTENSION_WEEKS: 1, // hard-block response → +1 restoration week.
    SUPPRESSED_RECOVERY_PHASE1_EXTENSION_WEEKS: 1, // RHR/HRV still off baseline at generation → +1 restoration week.
    INJURY_PHASE1_EXTENSION_WEEKS: 1,    // any injury flagged → +1 restoration week AND no quality return (Layer 2).
  },
} as const

// Type helpers — derived from the const object so tables and types stay in sync.
export type RaceDistanceKey = keyof typeof GENERATION_CONFIG.INTENSITY_DISTRIBUTION
export type PhaseKey        = keyof typeof GENERATION_CONFIG.SPECIFICITY_BY_PHASE
export type FitnessLevelKey = keyof typeof GENERATION_CONFIG.QUALITY_SESSIONS_PER_WEEK_MAX
export type ZoneKey         = keyof typeof GENERATION_CONFIG.ZONES

// Mapping km → canonical race-distance key. Boundaries match the existing
// DISTANCE_CONFIGS in lib/plan/length.ts (5K ≤ 6km, 10K ≤ 12km, HM ≤ 22km,
// Marathon ≤ 43km, 50K ≤ 55km, 100K beyond).
export function raceDistanceKey(distanceKm: number): RaceDistanceKey {
  if (distanceKm <= 6)  return '5K'
  if (distanceKm <= 12) return '10K'
  if (distanceKm <= 22) return 'HM'
  if (distanceKm <= 43) return 'MARATHON'
  if (distanceKm <= 55) return '50K'
  return '100K'
}
