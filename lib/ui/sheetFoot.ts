'use client'

// SHEET-ORIGIN-01, S1 Amendment 1 (Design Board 2026-10-24) — is a sheet using the nav pill as its foot right now?
//
// A sheet that comes out of the pill needs the pill visible ABOVE the scrim, and S1's reason for covering the nav still
// holds: a visible nav that offers four destinations while a modal is open is lying. So while a sheet claims the foot,
// the nav renders `.nav-bar--sheet-foot` (tabs faded to nothing, `inert`, `aria-hidden`) and stops being a nav.
//
// 🔴 THE FOOT IS DRAWN BY THE SHEET, NOT BY RAISING THE NAV. The first build lifted the nav's z-index above the scrim,
// and measured in the browser it still painted UNDER it: the nav's ancestor is `position: fixed`, which makes a
// stacking context, so its 4001 only counted inside that ancestor and the scrim dimmed it — the exact grey pill of the
// reverted build. So the nav registers its node here, and `Sheet` draws an empty pill at that node's measured box
// INSIDE its own layer. Wherever the nav sits in the tree, the foot is above the scrim by construction.
//
// A module store rather than a prop, because `Sheet` portals to <body> from anywhere in the tree and the nav lives in
// a 7,800-line component: threading a flag between them is the edit that goes wrong. Counted, not boolean, so two
// sheets overlapping in their enter/exit cannot release the foot while one is still open.

import { useEffect, useSyncExternalStore, type RefObject } from 'react'

let claims = 0
let navNode: HTMLElement | null = null
const listeners = new Set<() => void>()
const emit = () => listeners.forEach(l => l())

/** Claim the pill as a sheet's foot. Returns a release that is safe to call more than once. */
export function claimSheetFoot(): () => void {
  claims += 1
  emit()
  let released = false
  return () => {
    if (released) return
    released = true
    claims -= 1
    emit()
  }
}

/** The real nav's element, registered by the nav itself, so a sheet can draw the foot over its exact box. */
export function getNavNode(): HTMLElement | null {
  return navNode
}

export function isSheetFootActive(): boolean {
  return claims > 0
}

export function useSheetFootActive(): boolean {
  return useSyncExternalStore(
    l => { listeners.add(l); return () => { listeners.delete(l) } },
    isSheetFootActive,
    () => false,
  )
}

/**
 * Make the nav `inert` while it is a sheet's foot. (Registration is `registerNavNode`, from the ref callback.)
 *
 * ⚠️ IMPERATIVE ON PURPOSE. React 18.3 (this app) does not support `inert` as a prop: `inert={true}` is dropped and
 * the pill stays keyboard-reachable under a modal dialog, which is the S1 lie by another route. React 19 does support
 * it, as a BOOLEAN, so the `inert=""` string workaround would silently stop working on upgrade. The DOM property works
 * on both, and WKWebView has supported it since iOS 15.5.
 */
/**
 * Register (or clear) the nav element. Call it from the nav's REF CALLBACK, which React runs on every mount and
 * unmount. ⚠️ Not from an effect: the nav is unmounted on onboarding and redeem, so an effect that ran once at the
 * dashboard's mount either never saw a node (and every sheet silently fell back to S1) or kept a detached one after a
 * remount. Found in the downstream check before release; the preview could not show it, because its pill never unmounts.
 */
export function registerNavNode(node: HTMLElement | null): void {
  navNode = node
}

export function useSheetFootNav(ref: RefObject<HTMLElement | null>, active: boolean): void {
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.inert = active
    return () => { el.inert = false }
  }, [ref, active])
}
