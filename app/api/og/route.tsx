import { ImageResponse } from 'next/og'
import { BRAND } from '@/lib/brand'
import { loadFont, splitOnDoubleLetter } from '@/lib/brand-og'

export const runtime = 'edge'

/**
 * OG image generator — Warm Slate palette + Zonna wordmark.
 *
 * Architecture:
 * - All copy sourced from BRAND.* constants (lib/brand.ts) — never hardcoded.
 * - Colour values sourced from BRAND.og (lib/brand.ts), which mirrors the
 *   Warm Slate tokens in app/globals.css. @vercel/og runs in the edge runtime
 *   without a DOM so CSS custom properties don't resolve here; BRAND.og is
 *   the single source of truth for the resolved hex values this route uses.
 * - The double-letter accent position is derived from BRAND.name at runtime
 *   via lib/brand-og; if a future rename removes the doubled letters the
 *   wordmark falls back to plain rendering.
 */

export async function GET(req: Request) {
  // SITE-META-01 — the image names the page it belongs to.
  //
  // Until now this route took no request at all, so a guide, a plan, the
  // pricing page and the homepage all shared ONE card: wordmark plus tagline,
  // indistinguishable in a shared link. `title` is the only parameter, on
  // purpose. The value of a per-page card is that it names the page, and every
  // extra knob is another way for the image to disagree with it.
  //
  // Clamped and trimmed here as well as at the call site: this is a public GET
  // and the call site is not the only possible caller.
  const title = (new URL(req.url).searchParams.get('title') ?? '').trim().slice(0, 120)

  const [interBlack, interRegular] = await Promise.all([
    loadFont('Inter', 800),
    loadFont('Inter', 400),
  ])

  const split = splitOnDoubleLetter(BRAND.name)
  const wordmark = split
    ? (
        <span>
          {split[0]}
          <span style={{ color: BRAND.og.moss }}>{split[1]}</span>
          {split[2]}
        </span>
      )
    : <span>{BRAND.name}</span>

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: BRAND.og.bg,
          padding: '64px 72px',
          position: 'relative',
          fontFamily: 'Inter',
        }}
      >
        {/* Decorative concentric-rings watermark — anchored right, partially -->
            off-canvas so the mark feels embedded rather than placed. */}
        <svg
          viewBox="0 0 1024 1024"
          width={620}
          height={620}
          style={{
            position: 'absolute',
            right: -140,
            top: 5,
            opacity: 0.08,
          }}
        >
          {/* All rings at single watermark opacity 0.08 (applied at svg level). */}
          <circle cx={512} cy={512} r={440} fill="none" stroke={BRAND.og.ink} strokeWidth={26} />
          <circle cx={512} cy={512} r={355} fill="none" stroke={BRAND.og.ink} strokeWidth={26} />
          <circle cx={512} cy={512} r={270} fill="none" stroke={BRAND.og.ink} strokeWidth={26} />
          <circle cx={512} cy={512} r={185} fill="none" stroke={BRAND.og.ink} strokeWidth={26} />
          <circle cx={512} cy={512} r={80} fill={BRAND.og.ink} />
        </svg>

        {/* Top-left: wordmark with NN moss device */}
        <div
          style={{
            fontFamily: 'Inter',
            fontSize: 48,
            fontWeight: 800,
            color: BRAND.og.ink,
            letterSpacing: '-0.03em',
            lineHeight: 1,
            display: 'flex',
          }}
        >
          {wordmark}
        </div>

        {/* Bottom-left: the page's own headline, with the tagline beneath it.
            With no title the block collapses to the tagline alone, which is
            the layout every page shared before this route read a request. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: title ? 18 : 0 }}>
          {title ? (
            <div
              style={{
                fontFamily: 'Inter',
                fontSize: title.length > 64 ? 46 : 58,
                fontWeight: 800,
                color: BRAND.og.ink,
                letterSpacing: '-0.03em',
                lineHeight: 1.1,
                maxWidth: 820,
                display: 'flex',
              }}
            >
              {title}
            </div>
          ) : null}
          <div
            style={{
              fontFamily: 'Inter',
              fontSize: 24,
              fontWeight: 400,
              color: BRAND.og.mute,
              letterSpacing: '-0.01em',
              lineHeight: 1.25,
              maxWidth: 760,
              display: 'flex',
            }}
          >
            {BRAND.tagline}
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: 'Inter', data: interBlack,   style: 'normal', weight: 800 },
        { name: 'Inter', data: interRegular, style: 'normal', weight: 400 },
      ],
    }
  )
}
