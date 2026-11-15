# `ExternalLink` — contract

**Component:** `components/shared/ExternalLink.tsx`

A link OUT of the app shell. **4 importers.**

⚠️ **Written 2026-11-15 (`CONTRACT-COVERAGE-03`, highest reach first).**

## Prop interface

```typescript
export interface ExternalLinkProps {
  href: string
  children: ReactNode
  style?: CSSProperties
  className?: string
  'aria-label'?: string
}
```

⚠️ **`'aria-label'` IS A REAL PROP AND NEITHER PARSER SEES IT**, symmetrically: both
`componentProps` and `contractProps` extract names with `^([A-Za-z_$][\w$]*)\s*\??\s*:`, which a
QUOTED key does not match. So it is invisible on both sides and the parity check is unaffected —
but a future hyphenated prop is equally invisible, which is worth knowing before someone relies
on this gate to catch an undocumented one. It reaches the DOM through `...rest`.

## Invariants

1. 🔴 **INSIDE THE CAPACITOR WEBVIEW THERE IS NO "NEW TAB"** (`UX-AUTH-01`). Capacitor's UI
   delegate loads a `_blank` navigation into the **same** webview, so tapping *"Privacy Policy"*
   on the login screen replaced the app with the marketing site — `SiteHeader`, Plans, Pricing,
   *"Get the app"* — and left the runner no way back. Reported from a device as *"signing out
   lands the app on the marketing website"*.
2. ✅ **NATIVE OPENS `SFSafariViewController`** via `@capacitor/browser`, the pattern this app
   already uses for OAuth: it presents over the app, carries its own Done button, and **cannot
   navigate the app anywhere.**
3. 🔴 **`Capacitor.isNativePlatform()` IS CALLED SYNCHRONOUSLY, AND THE IMPORT IS STATIC, ON
   PURPOSE.** `preventDefault()` after an `await` is too late — the browser has already started
   the navigation by the time the microtask runs, so the webview would load the marketing page
   **and** present the browser sheet. Do not make the platform check async.
4. 🔴 **THE ABSOLUTE URL COMES FROM `window.location.origin`, NEVER A CONSTANT.** The webview is
   loaded from the canonical host, so the link inherits it. A hardcoded apex URL would be worse
   than wrong: `allowNavigation` lists `www.zonna.run` only, so Capacitor would bounce the runner
   out to Safari (see also `GTM-SITE-01` — the apex 307-redirects to `www`).
5. ⚠️ **THE CATCH FALLS BACK TO A SAME-WEBVIEW NAVIGATION, DELIBERATELY.** If the plugin is
   missing or refused, that is still better than a dead tap on a link **Apple requires to work**.
6. **`target="_blank"` and `rel="noopener noreferrer"` stay on the anchor** — they are what make
   the web path correct, and the native path never reaches them because `preventDefault()` runs
   first.
7. **No hardcoded colour.** The component sets no colour at all; `style` and `className` are the
   caller's.

## Pattern

`ui-patterns.md` § link. Ruling: `UX-AUTH-01`.
