// NavTab — one tab in the bottom navigation. NAV-SLIM-01 (Design Board,
// 2026-09-25).
//
// 🔴 WHY THIS IS NOT A `<Button>`. The tabs were `<Button variant="ghost">`, and
// `.btn--regular`'s `min-height: 44px` set the bar's height: 10px pad + 44 + 10
// = **64px**, against `ui-patterns.md` § 7's documented **60px**. The content
// only wants 43.4px. `size="compact"` carries the same 44px floor, so NEITHER
// Button size can express chrome.
//
// **A nav tab is not a call to action.** 44px is a CTA's tap floor (`:262`);
// borrowing it for furniture is what made the bar too tall, and the founder
// asked for it slimmer repeatedly while the spec already said 60. Fourth
// primitive this week whose absence produced hand-rolled copies, after
// `.cta-pill`, `BackButton` and `Switch`.
//
// ⚠️ THE TAP TARGET GOES UP, NOT DOWN. The bar used to pad 10px above and below
// a 44px button — 64px of bar, 44 of it tappable (**69%**). The padding now
// lives in the tab, so the whole 60px is a target. Bar −4px, target +16px.
//
// ⚠️ TWO RENDERERS, ONE SOURCE. `GuideSheet` draws a mirror of the nav to show a
// runner where a screen lives, and it had drifted: it listed **Strava**, whose
// tab was removed in Phase 1, and omitted **Me** — so the guide taught a nav
// that had not existed for months, and highlighted nothing when it fired for
// Me. Both renderers now map `NAV_ITEMS`, so a tab cannot exist in one and not
// the other. The marketing site's two replicas (`PhoneFrame`, `PhoneShell`)
// already encoded the correct tabs and `NAV_H = 60`: **the website was right and
// the app had drifted.**

import type { ReactNode } from 'react'

export interface NavTabProps {
  label: string
  icon: ReactNode
  active: boolean
  /** Omitted by the GuideSheet mirror, which is a picture of the nav, not the nav. */
  onClick?: () => void
}

export default function NavTab({ label, icon, active, onClick }: NavTabProps) {
  const cls = `nav-tab${active ? ' nav-tab--active' : ''}`
  // A mirror is not interactive: it renders as a div so it is not in the tab
  // order and screen readers do not offer four buttons that do nothing.
  if (!onClick) {
    return <div className={cls} aria-hidden>{icon}<span>{label}</span></div>
  }
  return (
    <button type="button" className={cls} onClick={onClick} aria-current={active ? 'page' : undefined}>
      {icon}<span>{label}</span>
    </button>
  )
}
