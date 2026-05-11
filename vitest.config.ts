import { defineConfig } from 'vitest/config'
import path from 'node:path'

/**
 * Vitest config — unit tests for pure functions only.
 *
 * Scope today: lib/coaching pure modules — selection logic, stream analysis,
 * prompt-context builders. Routes / Supabase-touching code is deliberately
 * out of scope for v1 — covered by integration tests when that surface exists.
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
    include: ['lib/**/*.test.ts'],
    // No globals — explicit imports from 'vitest' so test files document intent.
  },
})
