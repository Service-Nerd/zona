// GTM-SITE-02 item 3 — the frame that real app surfaces sit in on the website.
//
// The homepage renders `SessionCard`, `CoachNoteBlock` and `ZoneRings`
// themselves rather than imitations of them. Those components are built to sit
// on the app's `--bg` ground, and two of the three bring their own white card
// and shadow. Dropping one straight onto the marketing page would leave it
// floating with no context; wrapping it in another white card would be a card
// inside a card and two stacked shadows, which the design system bans.
//
// So the frame is an INSET, not a card: `--bg-soft`, one hairline, no shadow of
// its own. It reproduces the ground the surface has in the app, which is the
// point. The caption says which screen you are looking at, because a component
// lifted out of its screen has lost that.
//
// Deliberately carries no colour, no accent and no type of its own beyond the
// caption. Anything it added would be website chrome sitting on a product still
// and the still is the asset.

export function ProductStill({
  caption,
  children,
}: {
  /** Which screen this is, in the app's own words. Kept short. */
  caption: string
  children: React.ReactNode
}) {
  return (
    <figure style={{ margin: 0 }}>
      <figcaption
        style={{
          fontSize: '10px',
          fontWeight: 700,
          color: 'var(--mute)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          marginBottom: '10px',
        }}
      >
        {caption}
      </figcaption>
      <div
        style={{
          background: 'var(--bg-soft)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius-lg, 12px)',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        {children}
      </div>
    </figure>
  )
}
