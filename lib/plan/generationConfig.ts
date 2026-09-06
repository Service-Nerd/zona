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
    '50K':      { max_quality_session_pct: 15 },
    '100K':     { max_quality_session_pct: 15 },
  },

  // ── 10% rule + recovery cadence (CoachingPrinciples §2, §3) ─────────────────
  MAX_WEEKLY_VOLUME_INCREASE_PCT: 10,
  RETURNING_RUNNER_ALLOWANCE_PCT: 15,
  RETURNING_RUNNER_GRACE_WEEKS:    3,
  // RAMP-BOUNCEBACK-01 (Coaching Board 2026-09-06, Willy-led) — the post-deload
  // bounceback is BOUNDED for injury-history runners and left UNBOUNDED for
  // healthy runners. No new numeric: injury bouncebacks are bounded by the
  // existing INJURY_WEEKLY_INCREASE_CAP_PCT (§12); healthy bouncebacks keep §2's
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

  // ── Phase structure (CoachingPrinciples §4, §5) ─────────────────────────────
  // Specificity rises as the race approaches.
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
  // What the measurement found, on the §12 knee-injury archetype:
  //   base 35:  45 45 48 38* 48 49 53 46* 50 56 59   worst jump W5 +26%
  //   base 30:  45 45 48 38* 39 51 50 46* 53 56 60   worst jump W6 +31%
  //
  // The +26% at 35% is already far above §12's 17% injury cap. It passes only
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

  MIN_SESSION_DISTANCE_KM: {
    long:               5,
    easy:               4,
    quality:            5,
    secondary_quality:  4,
  },

  // ── Returning runner detection threshold ────────────────────────────────────
  // A user is detected as a "returning runner" when their training_age > 2 years
  // AND their current_weekly_km is below this fraction of peakKm. Below this
  // threshold the body has obvious headroom for the 15% allowance window.
  RETURNING_RUNNER_VOLUME_THRESHOLD_PCT: 50,  // % of peakKm

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
  LONG_RUN_MAX_PCT_OF_WEEKLY: 60,

  // ── Strides on midweek easy (CoachingPrinciples §28) ───────────────────────
  // From this week onwards, the engine appends a stride coach-note to one
  // midweek easy run per week. Skipped in race week and deload weeks.
  STRIDES_FIRST_WEEK: 3,

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
  // CoachingPrinciples §12 — for these two injury types, weekly volume cap
  // tightens from MAX_WEEKLY_VOLUME_INCREASE_PCT (10%) to this stricter limit.
  INJURY_WEEKLY_INCREASE_CAP_PCT: 5,  // % above previous week's volume

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
  PEAK_LR_RATIO_STRETCH: {
    HM:       0.95,
    MARATHON: 0.85,
  },

  // First two weeks of any plan: long run capped at longest_recent_run_km × this.
  WEEK_1_2_LONG_RUN_CAP_MULTIPLIER: 1.10,

  // ── VDOT conservatism (CoachingPrinciples §10) ──────────────────────────────
  // The signature Zonna move: err on the side of restraint when in doubt.
  VDOT_CONSERVATIVE_DISCOUNT_PCT: 3,
  VDOT_STALE_BENCHMARK_ADDITIONAL_DISCOUNT_PCT: 5,
  VDOT_STALE_BENCHMARK_MONTHS: 6,

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
  LR_BUILD_Z2_CEILING_SEGMENT_PCT:     0.10,              // last 10% at Z2 ceiling (build)
  LR_FINISH_GOAL_LATE_PEAK_SEGMENT_PCT: 0.10,             // last 10% at Z2 ceiling (finish-goal final peak)

  // ── Foundation Block (CoachingPrinciples §57) ─────────────────────────────
  // Pre-plan preparation phase inserted before W1 when the gap between today
  // and plan_start exceeds GAP_MIN_AUTO_DAYS. Uses negative week indices.
  FOUNDATION_GAP_NUDGE_DAYS:    7,   // < 7 days: inline nudge only
  FOUNDATION_GAP_AUTO_DAYS:    28,   // 7–28: auto-generate silently
  // > 28: offer three-option choice (see foundationBlock.ts)
  FOUNDATION_MAX_WEEKS:         3,   // max foundation block length (weeks)
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
