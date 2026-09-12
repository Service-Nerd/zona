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
  },
})
