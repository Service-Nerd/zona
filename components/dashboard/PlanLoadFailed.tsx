import { EmptyState } from '@/components/shared/EmptyState'
import Button from '@/components/ui/Button'

// Lifted out of `DashboardClient` (2026-10-16) so it can be rendered on its own: importing the
// whole dashboard to render four lines made its test the slowest in the suite.
/**
 * PLANS-SINGLE-NOT-MAYBE-01 (2026-10-16) — the plan could not be READ (a database error).
 * ui-patterns.md § 8 Empty State through the shared `EmptyState` (EMPTY-STATE-OWNER-01),
 * with its one available action.
 *
 * "Your plan is safe" is TRUE, and only since this item: the loader used to auto-save an old
 * gist/legacy plan over the one it could not read. Retry reloads, which re-runs the whole
 * load rather than a partial one.
 */
export function PlanLoadFailed({ onRetry }: { onRetry: () => void }) {
  return (
    <EmptyState
      fill
      title={<>Couldn&rsquo;t load your plan.</>}
      body="Your plan is safe. Check your connection and try again."
      action={<Button variant="primary" fullWidth onClick={onRetry}>Try again</Button>}
    />
  )
}
