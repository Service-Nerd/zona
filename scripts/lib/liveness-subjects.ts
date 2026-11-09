// liveness-subjects.ts — THE SINGLE OWNER of "which test covers which source?"
//
// 🔴 EXTRACTED 2026-11-09 BY CODE REVIEW, and the reason is the class this repo
// records most often. `TEST-LIVENESS-COVERAGE-01` shipped a gate over these two
// maps that read them as TEXT out of `test-liveness.ts`, and review found two
// fail-open parse defects in it within the hour:
//
//   · a row with `// ` in front of it still counted, so commenting one out
//     removed it from the harness with every arm of the gate still green
//   · the block boundary was `line === '}'` exactly, so ONE TRAILING SPACE on the
//     closing brace widened the region into `NO_SUBJECT` and took the parsed key
//     count 31 -> 38, leaving the ratchet slack by seven
//
// ⚠️ **Both are "bound the region, never grep the file" — the rule that gate's own
// header cites, broken in the gate itself.** The answer is not a better parser.
// A checker that holds its own copy of a derivation agrees with the producer only
// by accident (`deloadCadence`, `tierResolution`, `SESSION-KM-01`,
// `OPS-AI-OWNER-01`), and here the "copy" was a regex over the producer's source
// text, which is the most fragile copy of all. **So both read the real object.**

// ── The map is DECLARED, never inferred ─────────────────────────────────────
//
// A "first import wins" heuristic works today and breaks silently the first time
// someone reorders an import block. Declaring it makes the pairing reviewable,
// and makes an unmapped test file a visible gap rather than an absent one.
export const SUBJECTS: Record<string, string[]> = {
  // §123 — the scorer must agree with the catalogue. Both arms point at the OWNER, so a
  // mutation to the band logic has to be caught by one of them.
  'lib/coaching/scorePrescribedReachable.test.ts': ['lib/coaching/prescribedZoneFigures.ts'],
  'lib/coaching/prescribedZoneFigures.test.ts':    ['lib/coaching/prescribedZoneFigures.ts'],
  'lib/coaching/cohortSimilarity.test.ts':          ['lib/coaching/runHistory.ts'],
  'lib/coaching/fatigueAccumulation.test.ts':       ['lib/coaching/fatigueAccumulation.ts'],
  'lib/plan/longRunReadiness.test.ts':              ['lib/plan/longRunReadiness.ts'],
  'lib/coaching/dayBoundary.test.ts':               ['lib/coaching/dayBoundary.ts'],
  'lib/coaching/limiter.test.ts':                   ['lib/coaching/limiter.ts'],
  'lib/coaching/postRaceRecoveryCurve.test.ts':     ['lib/coaching/postRaceReshape.ts'],
  'lib/coaching/prompts/sessionFeedback.test.ts':   ['lib/coaching/prompts/sessionFeedback.ts'],
  'lib/coaching/qualityDowngrade.test.ts':          ['lib/coaching/qualityDowngrade.ts'],
  'lib/coaching/readinessBaseline.test.ts':         ['lib/coaching/readinessBaseline.ts'],
  'lib/coaching/recalibrationPrompt.test.ts':       ['lib/coaching/recalibrationPrompt.ts'],
  'lib/coaching/reshapeMagnitude.test.ts':          ['lib/coaching/reshapeMagnitude.ts'],
  'lib/coaching/sessionScore.test.ts':              ['lib/coaching/sessionScore.ts'],
  // ⚠️ BOTH, since 2026-11-09 (`TEST-LIVENESS-COVERAGE-01`). This row named only the
  // consumer, so a mutation to the GATE TABLE itself was never applied.
  'lib/plan/featureGates.test.ts':                  ['lib/plan/canUseFeature.ts', 'lib/plan/featureGates.ts'],

  // ── TEST-LIVENESS-COVERAGE-01 (2026-11-09) ────────────────────────────────
  // Four sources were ALREADY declared as mutation subjects by another test's row
  // while their OWN co-named test file sat outside the map — so the harness
  // reported on those sources through a neighbour's assertions and never through
  // the test written for them. Each of these was added and then RUN: see the
  // baseline for any that survived, with its reason.
  'lib/plan/effectiveSessions.test.ts':             ['lib/plan/effectiveSessions.ts'],
  'lib/ui/loadRatioContext.test.ts':                ['lib/ui/loadRatioContext.ts'],
  'lib/coaching/weeklyZoneAggregate.test.ts':       ['lib/coaching/weeklyZoneAggregate.ts'],
  // ⚠️ MAPPED AND *UNPROVEN*, DELIBERATELY. `lib/plan.ts` is 362 lines with many exports
  // and both of its tests (`plan.test.ts` and `planDateWindow.test.ts`, mapped since
  // before this) report UNPROVEN: scoping mutations to the symbols either one imports
  // scopes them across the module, so the battery lands outside the asserted behaviour
  // far more often than inside. **Same too-broad-subject case as `ruleEngine.ts` and
  // `lib/coaching/constants.ts` above.** Recorded rather than left absent: UNPROVEN is
  // the harness saying it cannot speak to this, which is a different and more useful
  // statement than the test not being in the map at all.
  'lib/plan.test.ts':                               ['lib/plan.ts'],
  'lib/plan/fitnessThresholds.test.ts':             ['lib/plan/fitnessAssessment.ts'],
  'lib/plan/inputRanges.test.ts':                   ['lib/plan/inputs.ts'],
  'lib/plan/taperRecalibration.test.ts':            ['lib/plan/taperRecalibration.ts'],
  'lib/planDateWindow.test.ts':                     ['lib/plan.ts'],
  // §126 — the doubles rule and its independent check, plus the owner that applies it.
  'lib/plan/doubles.test.ts':                       ['lib/plan/doubles.ts', 'lib/plan/effectiveSessions.ts'],
  // §129 — the load picture and the verdict it feeds (LOAD-SOURCE-TOTAL-01).
  'lib/coaching/loadPicture.test.ts':               ['lib/coaching/loadPicture.ts', 'lib/ui/loadRatioContext.ts'],
  'lib/coaching/moments.test.ts':                  ['lib/coaching/moments.ts'],
  // §132 — what kind of run was this (time in zone; split and planned are never grey).
  'lib/coaching/runEffort.test.ts':                ['lib/coaching/runEffort.ts'],
  // §133 — what Kit caught (each receipt from the owner that already says it).
  'lib/coaching/kitReceipts.test.ts':              ['lib/coaching/kitReceipts.ts'],
  // §134 — did this reshape INTRODUCE the violation, or was it already there? The harness
  // mutates the classifier, which is the whole of the rule: there is no plan property to
  // check, which is why §134 carries no `validatePlan()` invariant.
  'lib/coaching/reshapeIntroduced.test.ts':         ['lib/coaching/reshapeIntroduced.ts'],
  // STORED-PLAN-DEBT-REPAIR-01 — where a stored plan's debt sits in time, which is the
  // axis that took the actionable set from 15 plans to 6.
  'lib/plan/storedPlanDebt.test.ts':               ['lib/plan/storedPlanDebt.ts'],
  // §130 — the easy share's weekly record (the headline's colour rule is a markup assertion, falsified by hand).
  'components/shared/easyShare.markup.test.ts':     ['lib/coaching/weeklyZoneAggregate.ts'],
}

// Tests with NO mutable subject, recorded rather than silently absent.
export const NO_SUBJECT: Record<string, string> = {
  'lib/health/reportDistance.test.ts':
    '§128 (Coaching Board 2026-10-22, UNMEASURED-DISTANCE-01). A route + source-boundary test: the numeric harness has no '
    + 'subject to perturb (the bounds are data validation, the rule is which modules may READ a column). FALSIFIED BY '
    + 'HAND, 4 ways, each red: the fill-only 409 guard removed, `runHistory` made to read `reported_distance_m`, '
    + '`runDistance` counting a device 0 as measured, and the user scope dropped from the read.',
  'lib/coaching/reshapeLimits.test.ts':
    '§124 + §2 Am.5 + §109 Am.1 (Coaching Board 2026-10-08). Registered as a SUBJECT first and '
    + 'the harness reported UNPROVEN, correctly: `lib/coaching/constants.ts` holds 41 exported '
    + 'constants and this test guards 6, so a random numeric perturbation lands outside them far '
    + 'more often than inside — the same too-broad-subject case as ruleEngine.ts above, for the '
    + 'same reason. FALSIFIED BY HAND, 5 ways, each going red on a different arm: EF loosened to '
    + 'the -5 Seiler refused; MAX_ADJUSTMENTS_PER_WEEK raised to 4; the false "4-week rolling avg" '
    + 'comment restored; Sims\' mandatory clause deleted from the constitution; '
    + 'ZONE_BLOCK_VERDICT_MIN_RUNS dropped to 2. The board\'s reasoning is a set of RELATIONSHIPS '
    + 'between six named values, which a battery of operator flips cannot express.',
  'lib/coaching/raceProjectionHonesty.test.ts':
    'Asserts over PROMPT TEXT it builds inline; there is no separate module whose behaviour a '
    + 'mutation could change. Its own FALSIFICATION block is the liveness proof.',
  'lib/plan/raceResultWriteBoundary.test.ts':
    'A source-ORDER test: it reads app/api/post-race-reshape/route.ts as text. Mutating that '
    + 'source is what the test already does conceptually, and its `at()` helper fails loudly when '
    + 'an anchor disappears.',
  'lib/coaching/reframeCohort.test.ts':
    'Composes sessionRole + constants rather than owning a module; the behaviour it guards lives '
    + 'in classifiers already covered by invariant liveness.',
  'lib/plan/peakLrEarnedTier.test.ts':
    'Subject is ruleEngine.ts (~7k lines) via generateRulePlan, the same case as '
    + 'maintenanceNotePrescriptive below: scoping mutations to the one symbol it imports scopes '
    + 'them to the whole engine, and the signal drowns. FALSIFIED BY HAND INSTEAD (2026-09-17): '
    + 'flattening PEAK_LR_RATIO_VS_RACE.HM onto PEAK_LR_RATIO_TARGET.HM turns it red in two '
    + 'places at once — the tier lift ("expected 19 to be >= 19.545") and the rung ordering. '
    + 'Restored byte-identical; 7/7 green after. The comparative assertions ARE the proof: a '
    + 'runner who has proven the distance must get a longer peak long run than one who has not.',
  'lib/plan/maintenanceNotePrescriptive.test.ts':
    'Subject is ruleEngine.ts (~7k lines). Mutating it at random produces mutants unrelated to §38 '
    + 'and drowns the signal. Its profile-flip assertions ARE the falsification: change the named '
    + 'input, the profile must move.',
}
