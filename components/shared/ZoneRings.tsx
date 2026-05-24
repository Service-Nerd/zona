// ZoneRings — Zonna shared component (Pattern 22).
//
// Brand-mark-as-data-display. The four concentric rings of the Zonna mark
// each represent one HR zone bucket for the week:
//
//   Outer  → Z1 (recovery)   colour: --s-recov
//   Next   → Z2 (aerobic)    colour: --s-easy
//   Next   → Z3 (tempo)      colour: --s-quality
//   Inner  → Z4-5 (hard)     colour: --s-inter
//   Centre → moss dot        colour: --moss  (brand-constant — never data-driven)
//
// Each ring is drawn as a full stroke in --line, with a coloured arc overlaid
// from 12 o'clock clockwise to (pct * 360°). Fill style is "arc" not
// "thickness" by design (Phase decision): thickness-as-data distorts the
// brand mark's silhouette; arc-fill keeps every ring's shape intact and only
// the coverage varies. The brand mark stays recognisable at any data shape.
//
// Source data: aggregated hr_pct_z1 / hr_pct_z2 / hr_pct_z3 / hr_pct_z4_5
// from run_analysis across the week's completed runs, load-km weighted —
// same weighting as RestraintCard's discipline score so the two never
// disagree about what dominated the week.
//
// State model mirrors RestraintCard (Pattern 11): live / pending / locked,
// plus a separate skeleton component for the loading window.
//
// See docs/canonical/ui-patterns.md § ZoneRings (Pattern 22).

type ZoneSlice = { z1: number; z2: number; z3: number; z45: number }

type LiveProps = {
  state?: 'live'
  /** Section label — default "This week in zones" */
  label?: string
  /** Per-zone time percentages (0–100). Sum should be ~100 but the component is tolerant. */
  pctByZone: ZoneSlice
  /** Meta shown top-right — e.g. "across 3 runs" */
  meta?: string
}

type PendingProps = {
  state: 'pending'
  label?: string
}

type LockedProps = {
  state: 'locked'
  label?: string
  onUpgrade?: () => void
}

type Props = LiveProps | PendingProps | LockedProps

// ── Geometry ──────────────────────────────────────────────────────────────
// All numbers in SVG user units. Component renders at 160×160 by default;
// the parent controls layout dimensions via the wrapping flex container.
const SIZE         = 160
const CENTRE       = SIZE / 2
const STROKE_WIDTH = 9        // ring stroke thickness — fixed, never data-driven
const RING_GAP     = 4        // gap between adjacent rings
const DOT_RADIUS   = 7        // central moss dot — brand-constant element

// Outer-to-inner radii. Z1 outermost, Z4-5 innermost (per design call).
const RADII = {
  z1:  CENTRE - STROKE_WIDTH / 2 - 2,                                                   // outermost
  z2:  CENTRE - STROKE_WIDTH * 1.5 - RING_GAP - 2,
  z3:  CENTRE - STROKE_WIDTH * 2.5 - RING_GAP * 2 - 2,
  z45: CENTRE - STROKE_WIDTH * 3.5 - RING_GAP * 3 - 2,
}

const ZONE_COLOURS = {
  z1:  'var(--s-recov)',
  z2:  'var(--s-easy)',
  z3:  'var(--s-quality)',
  z45: 'var(--s-inter)',
}

// ── Pure helpers ──────────────────────────────────────────────────────────

/** Convert a 0–100 percentage to a stroke-dashoffset for the given radius.
 *  Arc starts at 12 o'clock and grows clockwise. */
function arcOffsetFor(radius: number, pct: number): { dashArray: string; dashOffset: number } {
  const circumference = 2 * Math.PI * radius
  const clamped       = Math.max(0, Math.min(100, pct))
  const filledLen     = (clamped / 100) * circumference
  return {
    dashArray:  `${filledLen} ${circumference - filledLen}`,
    dashOffset: 0,
  }
}

// ── Subcomponents ─────────────────────────────────────────────────────────

function Eyebrow({ label, meta }: { label: string; meta?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '16px',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-ui)',
          fontSize: '10px',
          fontWeight: 700,
          color: 'var(--mute)',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </span>
      {meta && (
        <span
          style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '10px',
            fontWeight: 400,
            color: 'var(--mute)',
            letterSpacing: '0.02em',
          }}
        >
          {meta}
        </span>
      )}
    </div>
  )
}

/** One concentric ring — track in --line, coloured arc on top. */
function Ring({
  radius,
  pct,
  colour,
  active,
}: {
  radius: number
  pct:    number
  colour: string
  /** When false (pending / locked), the arc is suppressed — only the track shows. */
  active: boolean
}) {
  const { dashArray, dashOffset } = arcOffsetFor(radius, pct)
  return (
    <g>
      {/* Track — always rendered so the brand mark's silhouette is constant */}
      <circle
        cx={CENTRE}
        cy={CENTRE}
        r={radius}
        fill="none"
        stroke="var(--line)"
        strokeWidth={STROKE_WIDTH}
      />
      {/* Coloured arc — starts at 12 o'clock (rotate -90°), grows clockwise */}
      {active && pct > 0 && (
        <circle
          cx={CENTRE}
          cy={CENTRE}
          r={radius}
          fill="none"
          stroke={colour}
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          strokeDasharray={dashArray}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${CENTRE} ${CENTRE})`}
          style={{ transition: 'stroke-dasharray 0.4s ease' }}
        />
      )}
    </g>
  )
}

function BrandDot({ muted = false }: { muted?: boolean }) {
  return (
    <circle
      cx={CENTRE}
      cy={CENTRE}
      r={DOT_RADIUS}
      fill={muted ? 'var(--mute)' : 'var(--moss)'}
      style={{ opacity: muted ? 0.4 : 1 }}
    />
  )
}

/** Per-zone numeric strip beneath the rings: "8 · 62 · 22 · 6". */
function NumericStrip({ pct }: { pct: ZoneSlice }) {
  const items: { key: keyof ZoneSlice; label: string; colour: string }[] = [
    { key: 'z1',  label: 'Z1', colour: ZONE_COLOURS.z1 },
    { key: 'z2',  label: 'Z2', colour: ZONE_COLOURS.z2 },
    { key: 'z3',  label: 'Z3', colour: ZONE_COLOURS.z3 },
    { key: 'z45', label: 'Z4-5', colour: ZONE_COLOURS.z45 },
  ]
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: '10px',
        marginTop: '18px',
      }}
    >
      {items.map((item) => (
        <div
          key={item.key}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '3px',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '9px',
              fontWeight: 700,
              color: item.colour,
              letterSpacing: '0.10em',
              textTransform: 'uppercase',
            }}
          >
            {item.label}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-ui)',
              fontSize: '15px',
              fontWeight: 700,
              color: 'var(--ink)',
              fontVariantNumeric: 'tabular-nums',
              letterSpacing: '-0.02em',
            }}
          >
            {Math.round(pct[item.key])}
            <span style={{ fontSize: '10px', fontWeight: 600, color: 'var(--mute)', marginLeft: '1px' }}>%</span>
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────

export function ZoneRingsSkeleton({ label = 'This week in zones' }: { label?: string }) {
  return (
    <div
      aria-busy="true"
      style={{
        background: 'var(--card)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px',
      }}
    >
      <Eyebrow label={label} />
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
          <Ring radius={RADII.z1}  pct={0} colour={ZONE_COLOURS.z1}  active={false} />
          <Ring radius={RADII.z2}  pct={0} colour={ZONE_COLOURS.z2}  active={false} />
          <Ring radius={RADII.z3}  pct={0} colour={ZONE_COLOURS.z3}  active={false} />
          <Ring radius={RADII.z45} pct={0} colour={ZONE_COLOURS.z45} active={false} />
          <BrandDot muted />
        </svg>
      </div>
      <div
        style={{
          marginTop: '18px',
          height: '32px',
          borderRadius: '4px',
          background: 'var(--bg-soft)',
          opacity: 0.5,
        }}
      />
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────

export default function ZoneRings(props: Props) {
  const label = props.label ?? 'This week in zones'

  // ── LOCKED — free user ────────────────────────────────────────────────
  if (props.state === 'locked') {
    return (
      <div
        style={{
          background: 'var(--bg-soft)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px',
        }}
      >
        <Eyebrow label={label} />
        <div style={{ display: 'flex', justifyContent: 'center', opacity: 0.45 }}>
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
            <Ring radius={RADII.z1}  pct={0} colour={ZONE_COLOURS.z1}  active={false} />
            <Ring radius={RADII.z2}  pct={0} colour={ZONE_COLOURS.z2}  active={false} />
            <Ring radius={RADII.z3}  pct={0} colour={ZONE_COLOURS.z3}  active={false} />
            <Ring radius={RADII.z45} pct={0} colour={ZONE_COLOURS.z45} active={false} />
            <BrandDot muted />
          </svg>
        </div>
        <div
          style={{
            marginTop: '18px',
            fontFamily: 'var(--font-ui)',
            fontSize: '13px',
            fontWeight: 400,
            color: 'var(--mute)',
            lineHeight: 1.55,
            textAlign: 'center',
          }}
        >
          Where your week actually went — by zone. Connect Strava and upgrade to see it.
        </div>
        {props.onUpgrade && (
          <div style={{ marginTop: '14px', textAlign: 'center' }}>
            <button
              onClick={props.onUpgrade}
              style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--moss)',
                background: 'none',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
              }}
            >
              Unlock view →
            </button>
          </div>
        )}
      </div>
    )
  }

  // ── PENDING — paid/trial pre-data ─────────────────────────────────────
  if (props.state === 'pending') {
    return (
      <div
        style={{
          background: 'var(--card)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-lg)',
          padding: '20px',
        }}
      >
        <Eyebrow label={label} />
        <div style={{ display: 'flex', justifyContent: 'center', opacity: 0.6 }}>
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
            <Ring radius={RADII.z1}  pct={0} colour={ZONE_COLOURS.z1}  active={false} />
            <Ring radius={RADII.z2}  pct={0} colour={ZONE_COLOURS.z2}  active={false} />
            <Ring radius={RADII.z3}  pct={0} colour={ZONE_COLOURS.z3}  active={false} />
            <Ring radius={RADII.z45} pct={0} colour={ZONE_COLOURS.z45} active={false} />
            <BrandDot muted />
          </svg>
        </div>
        <div
          style={{
            marginTop: '18px',
            fontFamily: 'var(--font-ui)',
            fontSize: '13px',
            fontWeight: 400,
            color: 'var(--ink-2)',
            lineHeight: 1.45,
            textAlign: 'center',
          }}
        >
          Your zone map fills in as runs land. Kit&rsquo;s reading.
        </div>
      </div>
    )
  }

  // ── LIVE — paid/trial with ≥1 analysed run ────────────────────────────
  const { pctByZone, meta } = props
  return (
    <div
      style={{
        background: 'var(--card)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px',
      }}
    >
      <Eyebrow label={label} meta={meta} />
      <div style={{ display: 'flex', justifyContent: 'center' }}>
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label={`Time in zones: Z1 ${Math.round(pctByZone.z1)}%, Z2 ${Math.round(pctByZone.z2)}%, Z3 ${Math.round(pctByZone.z3)}%, Z4-5 ${Math.round(pctByZone.z45)}%`}
        >
          <Ring radius={RADII.z1}  pct={pctByZone.z1}  colour={ZONE_COLOURS.z1}  active />
          <Ring radius={RADII.z2}  pct={pctByZone.z2}  colour={ZONE_COLOURS.z2}  active />
          <Ring radius={RADII.z3}  pct={pctByZone.z3}  colour={ZONE_COLOURS.z3}  active />
          <Ring radius={RADII.z45} pct={pctByZone.z45} colour={ZONE_COLOURS.z45} active />
          <BrandDot />
        </svg>
      </div>
      <NumericStrip pct={pctByZone} />
    </div>
  )
}
