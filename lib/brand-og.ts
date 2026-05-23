// SAVE-IMG-01 — shared helpers for next/og routes that render the Zonna
// wordmark. Extracted from app/api/og/route.tsx and weekly-zone-card so
// the third route (session-complete-card) doesn't add a third copy.
//
// All next/og routes run in either the edge or nodejs runtime without a
// DOM — CSS custom properties don't resolve, so colour values must come
// from BRAND.og.* (lib/brand.ts).

/**
 * Find the first doubled-letter pair in a name and split around it.
 * Used to paint the moss accent on the doubled letter in the Zonna
 * wordmark on OG images. Returns null when no doubled letter exists —
 * the caller falls back to a plain wordmark render.
 *
 * Example: 'Zonna' → ['Zo', 'nn', 'a']
 */
export function splitOnDoubleLetter(name: string): [string, string, string] | null {
  const lower = name.toLowerCase()
  for (let i = 0; i < lower.length - 1; i++) {
    if (lower[i] === lower[i + 1]) {
      return [name.slice(0, i), name.slice(i, i + 2), name.slice(i + 2)]
    }
  }
  return null
}

/**
 * Fetch an Inter weight from Google Fonts and return the woff2 buffer
 * suitable for passing into next/og's ImageResponse `fonts` array.
 *
 * Single source of truth for next/og font loading. The Googlebot UA
 * string is required — Google serves a CSS file with a `unicode-range`
 * subset to modern browsers that next/og can't parse; the Googlebot
 * path serves a plain woff2 URL.
 */
export async function loadFont(family: string, weight: number): Promise<ArrayBuffer> {
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`,
    { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' } },
  ).then(r => r.text())
  const url = css.match(/src: url\((.+?)\) format\('woff2'\)/)?.[1]
  if (!url) throw new Error(`Font URL not found for ${family} weight ${weight}`)
  return fetch(url).then(r => r.arrayBuffer())
}
