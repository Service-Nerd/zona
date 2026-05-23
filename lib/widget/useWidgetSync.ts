'use client'

// WIDGET-01 — Push widget state into the App Group whenever plan or
// override data changes. No-op on web (the underlying SharedStore
// plugin short-circuits there).
//
// Strategy: debounce writes so a chain of plan-related state changes
// in a single render burst results in one write. Triggered on first
// mount + whenever any of the dependencies change.

import { useEffect, useRef } from 'react'
import type { Plan } from '@/types/plan'
import { buildWidgetState } from './widgetState'
import { writeWidgetState } from '@/lib/native/sharedStore'
import type { SessionOverride } from '@/lib/plan/effectiveSessions'

export function useWidgetSync(plan: Plan | null, overrides: SessionOverride[]): void {
  const lastPayloadRef = useRef<string | null>(null)

  useEffect(() => {
    const state   = buildWidgetState({ plan, overrides })
    const payload = JSON.stringify(state)
    // Skip if the payload is byte-identical to the last write — saves
    // unnecessary App Group round-trips on noisy re-renders.
    if (payload === lastPayloadRef.current) return
    lastPayloadRef.current = payload
    void writeWidgetState(payload)
  }, [plan, overrides])
}
