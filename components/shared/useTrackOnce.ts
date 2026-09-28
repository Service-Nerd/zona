'use client'

// OPS-ARTIFACT-REACH-01 — fire one analytics event the first time a condition
// becomes true, and never again for that mount.
//
// 🔴 ONE OWNER, because two surfaces need exactly this (the weekly-report card and
// the discipline ledger) and two copies of a ref-guarded effect is how they drift.
// It lives under `components/` rather than `lib/analytics.ts` so that the browser
// Supabase client is imported from a directory that is already client-only —
// `clientBundleBoundary.test.ts` guards that seam.
//
// ⚠️ NOT MECHANICALLY CHECKED, and the reason is stated rather than omitted:
// vitest runs in `node` with no jsdom, so a hook cannot be rendered here. The
// mitigation is that it is small enough to read in one go and has exactly one
// shape of caller. If jsdom is ever added, this is the first thing to test.

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { trackEvent, currentUserId, type AnalyticsEvent } from '@/lib/analytics'

export function useTrackOnce(
  event: AnalyticsEvent,
  when: boolean,
  props: Record<string, unknown> = {},
): void {
  const fired = useRef(false)
  useEffect(() => {
    if (!when || fired.current) return
    fired.current = true
    void (async () => {
      const supabase = createClient()
      // A null id makes trackEvent a no-op, which is the correct outcome: the
      // event is worthless without an owner and telemetry must never throw here.
      trackEvent(supabase, await currentUserId(supabase), event, props)
    })()
    // `props` is deliberately not a dependency: it is a fresh object literal on
    // every render, and the ref already guarantees one fire per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [when, event])
}
