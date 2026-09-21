import { BRAND } from '@/lib/brand'

/**
 * IA-QR-01 — a scannable App Store code beside the hero CTA, desktop only.
 *
 * The CTA is an App Store badge, which on a desktop browser opens a page the
 * visitor then has to re-find on their phone. The app is iOS only. So on the
 * viewport where the badge is LEAST useful, the code does the handoff in one
 * scan.
 *
 * ⚠️ HIDDEN BELOW 1024px, and by CSS rather than by a JS width check: a QR on
 * a phone is asking someone to scan their own screen. `display: none` in a
 * media query keeps it out of the layout at every phone and tablet width and
 * costs no JavaScript, no hydration mismatch and no layout shift. The rule
 * lives in globals.css because inline styles cannot carry a media query, and
 * putting it there keeps the breakpoint next to the rest of the system.
 *
 * ⚠️ The SVG is inlined, not an <img>. It has to inherit `currentColor` so
 * --mute owns it, and a linked file cannot.
 */
export function AppStoreQr({ svg }: { svg: string }) {
  return (
    <div className="qr-desktop-only" aria-hidden="false">
      <a
        href={BRAND.appStore.url}
        style={{
          display: 'block', width: 84, height: 84, color: 'var(--ink)',
          padding: 8, background: 'var(--card)', border: '1px solid var(--line)',
          borderRadius: 'var(--radius-md)', boxSizing: 'content-box',
        }}
        aria-label={`Scan to open ${BRAND.name} on the App Store`}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <span style={{
        display: 'block', maxWidth: 132, marginTop: 8,
        fontSize: 'var(--fs-caption)', lineHeight: 1.3, color: 'var(--mute)',
      }}>
        Scan to get it on your phone
      </span>
    </div>
  )
}
