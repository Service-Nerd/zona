import { defineConfig } from 'vitest/config'
import path from 'node:path'

/**
 * Vitest config — unit tests for pure functions only.
 *
 * Scope today: lib/coaching + lib/plan pure modules (selection logic, stream
 * analysis, prompt-context builders, plan generation), plus the pure logic of
 * shared form primitives in components/shared (step/clamp/toggle/value-mapping
 * helpers — exported node-testable functions, never React render). Routes /
 * Supabase-touching code and component rendering are deliberately out of scope
 * for v1 — the primitives keep their logic pure precisely so it's testable here
 * without a DOM. Covered by integration tests when that surface exists.
 *
 * Path aliases mirror the Next.js `@/` convention used across the codebase.
 */
export default defineConfig({
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
