import { BRAND } from '@/lib/brand'

/**
 * Wordmark — renders the brand wordmark with the NN-moss visual device.
 *
 * Architecture rules honoured:
 * - Brand string sourced from BRAND.name (lib/brand.ts) — never hardcoded.
 * - All colour values reference CSS custom properties from app/globals.css.
 *   The only inline RGBA literal is the variant-specific NN tint on white
 *   surfaces; there is no token for "55% opacity white" in globals.css and
 *   the spec calls for that exact value (see step 4 of the rebrand brief).
 * - The double-letter accent position is derived from BRAND.name at runtime,
 *   not hardcoded. If a future brand rename produces a name without "nn",
 *   the component falls back to plain text rendering.
 *
 * Size tokens map to a five-step scale tuned to existing wordmark surfaces:
 *   xs  14px — bottom-bar / today-nav wordmark
 *   sm  20px — sticky page-header wordmarks (privacy, terms)
 *   md  32px — boot/splash/welcome/plan-ready brand surfaces
 *   lg  48px — OG image / large brand moments
 *   xl  56px — hero display
 *
 * Typography is fixed by the spec: Inter 800 (`var(--font-brand)`),
 * letter-spacing -0.03em, line-height 1. No callsite overrides type.
 */

export type WordmarkSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
export type WordmarkVariant = 'default' | 'light' | 'moss'

const SIZE_PX: Record<WordmarkSize, number> = {
  xs: 14,
  sm: 20,
  md: 32,
  lg: 48,
  xl: 56,
}

interface WordmarkProps {
  size?: WordmarkSize
  variant?: WordmarkVariant
  className?: string
  title?: string
  style?: React.CSSProperties
}

/**
 * Locate the first run of two consecutive identical letters in `name`
 * (case-insensitive). Returns the split [prefix, doubleLetters, suffix]
 * preserving the original casing, or null if no double exists.
 */
function splitOnDoubleLetter(name: string): [string, string, string] | null {
  const lower = name.toLowerCase()
  for (let i = 0; i < lower.length - 1; i++) {
    if (lower[i] === lower[i + 1]) {
      return [name.slice(0, i), name.slice(i, i + 2), name.slice(i + 2)]
    }
  }
  return null
}

export function Wordmark({
  size = 'md',
  variant = 'default',
  className,
  title,
  style,
}: WordmarkProps) {
  const fontSize = SIZE_PX[size]

  // Variant colour mapping. `default` reads on warm-slate surfaces; `light`
  // and `moss` both target white-on-dark surfaces (photo backgrounds and the
  // moss accent surface respectively) — they share rendering but are kept as
  // distinct semantic variants so callsites declare intent.
  let baseColor: string
  let accentColor: string
  switch (variant) {
    case 'light':
    case 'moss':
      baseColor = 'var(--card)'
      accentColor = 'rgba(255, 255, 255, 0.55)'
      break
    case 'default':
    default:
      baseColor = 'var(--ink)'
      accentColor = 'var(--moss)'
  }

  const rootStyle: React.CSSProperties = {
    fontFamily: 'var(--font-brand)',
    fontWeight: 800,
    fontSize: `${fontSize}px`,
    letterSpacing: '-0.03em',
    lineHeight: 1,
    color: baseColor,
    display: 'inline-block',
    ...style,
  }

  const split = splitOnDoubleLetter(BRAND.name)
  if (!split) {
    return (
      <span className={className} style={rootStyle} title={title ?? BRAND.name}>
        {BRAND.name}
      </span>
    )
  }

  const [prefix, accent, suffix] = split

  return (
    <span className={className} style={rootStyle} title={title ?? BRAND.name}>
      {prefix}
      <span style={{ color: accentColor }}>{accent}</span>
      {suffix}
    </span>
  )
}

export default Wordmark
