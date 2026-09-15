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
    include: ['lib/**/*.test.ts', 'components/**/*.test.ts'],
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
  },
})
