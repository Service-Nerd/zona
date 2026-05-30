// Copy table for RaceTimesCard, keyed by variant.
//
// Each surface answers a different user question, so the framing differs even
// though the data is identical:
//   - status (Coach screen):    "Where you stand today" — passive status.
//   - anchor (Benchmark entry): "Where you are now"     — before-state, the
//                               recalibrate form sits directly below.
//   - result (Benchmark result): "What's changed"       — post-update confirmation.
//
// All strings live here. Do not hardcode any of these in the component.

export type RaceProjectionsVariant = 'status' | 'anchor' | 'result'

export interface RaceProjectionsCopy {
  /** Section eyebrow rendered at the top of the card. */
  eyebrow: string
  /** Shown when state is 5 (no estimate available) or fetch fails. */
  empty: {
    heading: string
    /** Body when Strava IS connected. */
    bodyWithStrava: string
    /** Body when Strava is NOT connected. */
    bodyWithoutStrava: string
  }
  /** Shown below the distance list when state ∈ {3, 4} (low-confidence estimate). */
  lowConf: {
    /** state 3 — has benchmark, low confidence. */
    withBenchmark: string
    /** state 4 — no benchmark, Strava connected. */
    withoutBenchmarkStrava: string
    /** state 4 — no benchmark, Strava not connected. */
    withoutBenchmarkNoStrava: string
  }
  /**
   * Recalibration nudge — only present on the `status` variant. Other surfaces
   * either ARE the recalibration UI (`anchor`) or just confirmed it (`result`),
   * so a "go recalibrate" CTA would be a tautology.
   */
  recal?: {
    body:    string
    cta:     string
    dismiss: string
  }
}

export const RACE_PROJECTIONS_COPY: Record<RaceProjectionsVariant, RaceProjectionsCopy> = {
  status: {
    eyebrow: 'Race projections',
    empty: {
      heading: 'No estimate yet.',
      bodyWithStrava:    'Add a benchmark result in Profile, or complete a few easy runs with heart rate.',
      bodyWithoutStrava: 'Add a benchmark result in Profile, or complete a few easy runs with heart rate.',
    },
    lowConf: {
      withBenchmark:           'Log a benchmark result in Profile for a higher-confidence estimate.',
      withoutBenchmarkStrava:  'Log a benchmark result in Profile to improve accuracy.',
      withoutBenchmarkNoStrava:'Add a benchmark in Profile, or complete a few easy runs with heart rate.',
    },
    recal: {
      body:    'Aerobic fitness has moved since plan start. Your training zones may be set too low for where you are now.',
      cta:     'Update zones →',
      dismiss: 'Not now',
    },
  },

  anchor: {
    eyebrow: 'Where you are now',
    empty: {
      heading: 'No estimate yet.',
      bodyWithStrava:    'Use the form below to log a benchmark result.',
      bodyWithoutStrava: 'Use the form below to log a benchmark result.',
    },
    lowConf: {
      withBenchmark:           'Update below for a higher-confidence estimate.',
      withoutBenchmarkStrava:  'Log a benchmark below to improve accuracy.',
      withoutBenchmarkNoStrava:'Log a benchmark below to improve accuracy.',
    },
  },

  result: {
    eyebrow: "What's changed",
    empty: {
      heading: 'No estimate yet.',
      bodyWithStrava:    'Projections will refresh once your update is processed.',
      bodyWithoutStrava: 'Projections will refresh once your update is processed.',
    },
    lowConf: {
      withBenchmark:           '',
      withoutBenchmarkStrava:  '',
      withoutBenchmarkNoStrava:'',
    },
  },
}
