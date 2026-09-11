'use client'

/**
 * A link OUT of the app shell — UX-AUTH-01.
 *
 * On the web `target="_blank"` opens a new tab and the app keeps its own. Inside
 * the Capacitor webview there is no "new tab": Capacitor's UI delegate loads a
 * `_blank` navigation into the SAME webview, so tapping "Privacy Policy" on the
 * login screen replaced the app with the marketing site — `SiteHeader`, Plans,
 * Pricing, "Get the app" — and left the runner no way back. Reported from a
 * device as *"signing out lands the app on the marketing website"*.
 *
 * Native therefore opens the URL in `SFSafariViewController` (`@capacitor/browser`),
 * which is the pattern this app already uses for OAuth: it presents over the app,
 * carries its own Done button, and cannot navigate the app anywhere.
 *
 * The absolute URL is derived from `window.location.origin`, never a constant:
 * the webview is loaded from the canonical host, so the link inherits it. A
 * hardcoded apex URL would be worse than wrong — `allowNavigation` lists
 * `www.zonna.run` only, so Capacitor would bounce the runner out to Safari.
 */

import { Capacitor } from '@capacitor/core'
import { useCallback, type CSSProperties, type ReactNode } from 'react'

export interface ExternalLinkProps {
  href: string
  children: ReactNode
  style?: CSSProperties
  className?: string
  'aria-label'?: string
}

export default function ExternalLink({ href, children, style, className, ...rest }: ExternalLinkProps) {
  const onClick = useCallback((e: React.MouseEvent<HTMLAnchorElement>) => {
    // `Capacitor` is imported statically and `isNativePlatform()` is synchronous
    // ON PURPOSE. `preventDefault()` after an `await` is too late — the browser
    // has already started the navigation by the time the microtask runs, so the
    // webview would load the marketing page AND present the browser sheet.
    if (!Capacitor.isNativePlatform()) return
    e.preventDefault()

    const url = new URL(href, window.location.origin).toString()
    void (async () => {
      try {
        const { Browser } = await import('@capacitor/browser')
        await Browser.open({ url, presentationStyle: 'popover' })
      } catch {
        // Plugin missing or refused: a same-webview navigation is still better
        // than a dead tap on a link Apple requires to work.
        window.location.href = url
      }
    })()
  }, [href])

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onClick}
      style={style}
      className={className}
      {...rest}
    >
      {children}
    </a>
  )
}
