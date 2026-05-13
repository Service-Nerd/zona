import { ImageResponse } from 'next/og'
import { BRAND } from '@/lib/brand'

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
 * - The double-letter accent position is derived from BRAND.name at runtime;
 *   if a future rename removes the doubled letters the wordmark falls back to
 *   plain rendering.
 */

async function loadFont(family: string, weight: number): Promise<ArrayBuffer> {
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`,
    { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' } }
  ).then(r => r.text())

  const url = css.match(/src: url\((.+?)\) format\('woff2'\)/)?.[1]
  if (!url) throw new Error(`Font URL not found for ${family}`)
  return fetch(url).then(r => r.arrayBuffer())
}

function splitOnDoubleLetter(name: string): [string, string, string] | null {
  const lower = name.toLowerCase()
  for (let i = 0; i < lower.length - 1; i++) {
    if (lower[i] === lower[i + 1]) {
      return [name.slice(0, i), name.slice(i, i + 2), name.slice(i + 2)]
    }
  }
  return null
}

export async function GET() {
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

        {/* Bottom-left: tagline in --mute */}
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
