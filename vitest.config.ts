import { defineConfig } from 'vitest/config'
import path from 'node:path'

/**
 * Vitest config — unit tests for pure functions only.
 *
 * Scope today: lib/coaching + lib/plan pure modules (selection logic, stream
 * analysis, prompt-context builders, plan generation), plus the pure logic of
 * shared form primitives in components/shared (step/clamp/toggle/value-mapping
 * helpers — exported node-testable functions). Routes and Supabase-touching
 * code stay out of scope; covered by integration tests when that surface exists.
 *
 * STATIC MARKUP is also in scope, via `renderToStaticMarkup` in a `.test.ts`
 * file using `React.createElement` (no JSX, so the include list and the
 * transform stay exactly as they were, and no jsdom is needed — this is a
 * server render). Added for one reason (UX-COACH-01, 2026-09-12): this
 * codebase's recurring failure is a design decision that lives in a COMMENT
 * while the markup says something else — the zone rings were declared paired
 * with Kit's read and shipped with both card borders intact. A comment cannot
 * be asserted on; rendered HTML can. Interaction testing still needs jsdom and
 * a deliberate decision to add it.
 *
 * Path aliases mirror the Next.js `@/` convention used across the codebase.
 */
export default defineConfig({
  // `tsconfig.json` sets jsx:"preserve" because Next.js owns that transform in
  // the app build. Vitest's transform honours it and then fails to parse the
  // untouched JSX the moment a test imports a component. This override is
  // vitest-only and changes nothing about how the app is compiled.
  // (`oxc`, not `esbuild` — vitest 4 runs on rolldown; the esbuild key is
  //  silently ignored and the parse error looks identical, so it reads like the
  //  option did not work rather than like it was never applied.)
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts', 'components/**/*.test.ts', 'packages/**/*.test.ts'],
    // No globals — explicit imports from 'vitest' so test files document intent.

    // ── CI-TIMEOUT-01 (2026-09-15) — vitest's 5,000 ms default is not a
    // timeout for this suite, it is a RACE, and it has already burned a CI
    // investigation across two sessions.
    //
    // MEASURED, both sides. `targetedGrid.test.ts`'s second case generates
    // 1,536 plans: **1,806 ms on the dev machine, 6,316 ms on
    // ubuntu-latest** — a **3.5x slower runner**. Against the 5,000 ms default
    // that is 2.8x headroom locally and 1.26x OVER in CI, so the test does not
    // fail reliably; it fails SOMETIMES, on whatever commit happens to land on
    // a loaded runner. Run #349 was a DOCS-ONLY commit that touched nothing
    // this test reads, and it went red here.
    //
    // That is the worst failure mode this repo has a name for. NOISE-GATE-01:
    // a check that cries wolf gets disabled — and the disabling move for a
    // flaky CI test is "just re-run it", which trains everyone to treat a red
    // gate as noise. The correctness suite stops meaning anything.
    //
    // 30 s, not 10. At the measured 3.5x the default breaks for anything over
    // ~1,430 ms of local work, and this suite generates thousands of plans per
    // file — so a margin that merely clears TODAY's slowest test would be the
    // same race again, one test from now. A genuinely hung test still trips
    // this well inside the job's own 20-minute bound.
    //
    // NOT a licence to write slow tests: `slowTestThreshold` below reports
    // every case over 1 s, so drift toward the wall is VISIBLE in the run
    // output before it is red.
    testTimeout: 30_000,
    hookTimeout: 30_000,

    // Anything above this is printed with its duration. Set at 1 s because that
    // is where the local/CI ratio starts to matter: 1 s here is ~3.5 s there.
    slowTestThreshold: 1_000,

    // ── SUITE-POOL-WALLCLOCK-01 (2026-11-08) — MEASURED, 12 RUNS ─────────────
    //
    // The question the item filed was a trade-off: `--maxWorkers=4` improved per-test
    // fidelity sharply, and *"fewer workers means each test is faster and the suite
    // probably finishes later"* — the wall clock was never measured, and it is the
    // number anyone waiting on `npm run verify` actually cares about.
    //
    // 📐 Measured on this 10-core machine, three runs per setting, 7,393 tests:
    //
    //   workers   wall (mean)   spread   test-time   over 1 s
    //        4       194.9 s     7.7 s     119.2 s         17
    //        6       180.4 s     1.2 s     141.3 s         19   ← both axes best
    //        9       183.6 s     1.3 s     194.7 s         25   (≈ the old default)
    //       10       186.1 s     1.3 s     217.5 s         30
    //
    // 🔑 THE ITEM'S PREMISE IS HALF WRONG, AND THAT IS THE FINDING. The two numbers
    // trade against each other only BELOW 6. Between 6 and 10 there is no trade at
    // all: wall clock and per-test fidelity both get worse together. Against the old
    // default of 9 this is **-3.2 s wall (-1.7%) and -53.4 s of test time (-27%)**,
    // with tests over the 1 s reporting line going 25 -> 19. Nothing is given up.
    // 4 is also the LEAST repeatable setting measured — a 7.7 s spread against 1.2 s.
    //
    // ⚠️ LOCAL ONLY, BECAUSE THE MEASUREMENT IS LOCAL. `ubuntu-latest` is a 2-4 core
    // runner and 6 could be more workers than it has cores. Applying a 10-core result
    // there is the denominator error this repo has paid for repeatedly, so CI keeps
    // vitest's own default until someone measures it on a runner.
    //
    // ⚠️ EVERY DURATION BASELINE ENTRY MOVES WITH THIS, and they were re-measured in
    // the same commit with that reason stated — `check:slow` normalises by the suite
    // total, so the entries are a share, and the share changes when the pool does.
    ...(process.env.CI ? {} : { maxWorkers: 6 }),
  },
})
