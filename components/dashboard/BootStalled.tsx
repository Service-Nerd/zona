import { EmptyState } from '@/components/shared/EmptyState'
import Button from '@/components/ui/Button'
import { BOOT_STALLED_TITLE, BOOT_STALLED_ACTION } from '@/lib/ui/bootWatchdog'

/**
 * BOOT-HANG-01 (2026-10-25) — what replaces the loading screen once it has held for `BOOT_STALL_MS`.
 * ui-patterns.md § 8 Empty State through the shared `EmptyState`, the same anatomy as `PlanLoadFailed`.
 * Retry reloads, which re-runs the whole boot: exactly what force-closing the app used to do.
 */
export function BootStalled({ onRetry }: { onRetry: () => void }) {
  return (
    <EmptyState
      fill
      title={BOOT_STALLED_TITLE}
      action={<Button variant="primary" fullWidth onClick={onRetry}>{BOOT_STALLED_ACTION}</Button>}
    />
  )
}
