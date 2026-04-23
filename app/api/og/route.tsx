import { ImageResponse } from 'next/og'
import { BRAND } from '@/lib/brand'

const OG = BRAND.og

export const runtime = 'edge'

async function loadFont(family: string, weight: number): Promise<ArrayBuffer> {
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`,
    { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' } }
  ).then(r => r.text())

  const url = css.match(/src: url\((.+?)\) format\('woff2'\)/)?.[1]
  if (!url) throw new Error(`Font URL not found for ${family}`)
  return fetch(url).then(r => r.arrayBuffer())
}

export async function GET() {
  const [spaceGrotesk] = await Promise.all([
    loadFont('Space Grotesk', 700),
  ])

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          background: OG.navy,
          padding: '64px 72px',
          position: 'relative',
        }}
      >
        {/* Left accent bar — mirrors session card visual language */}
        <div
          style={{
            position: 'absolute',
            top: 0, left: 0, bottom: 0,
            width: '6px',
            background: OG.teal,
          }}
        />

        {/* Wordmark */}
        <div
          style={{
            fontFamily: 'Space Grotesk',
            fontSize: '52px',
            fontWeight: 700,
            color: OG.teal,
            letterSpacing: '0.06em',
            marginBottom: '20px',
            lineHeight: 1,
          }}
        >
          {BRAND.name}
        </div>

        {/* Tagline */}
        <div
          style={{
            fontFamily: 'Space Grotesk',
            fontSize: '44px',
            fontWeight: 700,
            color: OG.offWhite,
            letterSpacing: '-0.5px',
            lineHeight: 1.15,
            maxWidth: '900px',
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
        {
          name: 'Space Grotesk',
          data: spaceGrotesk,
          style: 'normal',
          weight: 700,
        },
      ],
    }
  )
}
