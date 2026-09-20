// LOCAL DESIGN HARNESS — 404s in production, not linked from anywhere, not in
// the sitemap. Same pattern as /me-preview, /onboarding-preview.
//
// WHY THIS EXISTS. The refusal screen sits behind auth AND behind a completed
// wizard AND behind a refusal, so the only way to see it for real is to be the
// runner it is failing — and the runner it fails hardest is a first-time
// charity marathoner three weeks before their codes go out. P-15's acceptance
// criteria require it walked on a device; this is what makes that possible
// without minting a code and faking a base volume.
//
// Renders the REAL `RefusalView`. A fixture with its own copy of the markup
// would drift from the screen and prove nothing, which is why the view was
// extracted rather than duplicated.

'use client'

import { notFound } from 'next/navigation'
import RefusalView from '@/components/shared/RefusalView'

/** The buttons are live handlers; keep the rendering real and the action inert. */
function Inert({ children }: { children: React.ReactNode }) {
  return (
    <div onClickCapture={e => { e.preventDefault(); e.stopPropagation() }}>
      {children}
    </div>
  )
}

function Case({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: '40px' }}>
      <h2 style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 4px' }}>
        {title}
      </h2>
      <p style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', lineHeight: 1.5, margin: '0 0 14px' }}>
        {note}
      </p>
      <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-lg)', padding: '16px', border: '1px dashed var(--line)' }}>
        <Inert>{children}</Inert>
      </div>
    </section>
  )
}

const noop = () => {}

export default function RefusalPreviewPage() {
  if (process.env.NODE_ENV === 'production') notFound()

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', padding: '28px 16px 64px', fontFamily: 'var(--font-ui)' }}>
      <h1 style={{ fontFamily: 'var(--font-brand)', fontSize: '20px', fontWeight: 700, color: 'var(--ink)', margin: '0 0 6px' }}>
        Refusal screen
      </h1>
      <p style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)', lineHeight: 1.55, margin: '0 0 32px' }}>
        Every state of `RefusalView`. The copy in the offer is authored server-side by
        `lib/plan/baseBuildCopy.ts`; the strings below are real output from it, not
        placeholders.
      </p>

      <Case
        title="1 · Refusal WITH an offer that reaches the race door"
        note="The common charity case. The base build ends above §111's door with weeks to spare, so the copy is allowed to promise a race plan at the end of it. Primary action starts the plan; adjusting the answers stays visible."
      >
        <RefusalView
          isRefusal
          message="4km a week is too low to build safely to a marathon yet. Get to about 12km a week first."
          alternatives={['Race the half at the same event', 'Give it about 12 weeks of steady easy running']}
          offer={{
            title: 'Base building',
            line: '15 weeks of base building takes you to 26 km a week, and a race plan opens up at the end of it.',
            why: 'Zonna will not sell you a race plan you cannot safely do yet. This is the one that gets you there.',
          }}
          offerFailed={false}
          onAccept={noop}
          onAdjust={noop}
        />
      </Case>

      <Case
        title="2 · Refusal WITH an offer that does NOT reach the door"
        note="The lowest-volume runner. ⚠️ The line makes NO claim about a race, because for this runner we cannot make one. If this variant ever mentions a race, the server copy has regressed."
      >
        <RefusalView
          isRefusal
          message="2km a week is too low to build safely to a marathon yet."
          alternatives={['Give it about 12 weeks of steady easy running']}
          offer={{
            title: 'Base building',
            line: '15 weeks of base building takes you to 7.5 km a week, at a rate your body can absorb.',
            why: 'Zonna will not sell you a race plan you cannot safely do yet. This is the one that gets you there.',
          }}
          offerFailed={false}
          onAccept={noop}
          onAdjust={noop}
        />
      </Case>

      <Case
        title="3 · Refusal with NO offer"
        note="A prep-time or days-per-week refusal. §118 does not serve these, so no offer card must appear and 'Adjust my answers' returns to being the full-width primary."
      >
        <RefusalView
          isRefusal
          message="10 weeks is not enough to build a marathon safely. It needs 16."
          alternatives={['Race the half at the same event', 'Pick a later marathon']}
          offer={null}
          offerFailed={false}
          onAccept={noop}
          onAdjust={noop}
        />
      </Case>

      <Case
        title="4 · Acceptance failed"
        note="The runner tapped Start and the network dropped. The offer STAYS on screen: losing the card would make a transport failure read as a second refusal."
      >
        <RefusalView
          isRefusal
          message="4km a week is too low to build safely to a marathon yet. Get to about 12km a week first."
          alternatives={[]}
          offer={{
            title: 'Base building',
            line: '15 weeks of base building takes you to 26 km a week, and a race plan opens up at the end of it.',
            why: 'Zonna will not sell you a race plan you cannot safely do yet. This is the one that gets you there.',
          }}
          offerFailed
          onAccept={noop}
          onAdjust={noop}
        />
      </Case>

      <Case
        title="5 · A real fault, not a refusal"
        note="A 500 or a dropped connection. Keeps the honest 'something went wrong' framing and the 'Try again' label. This path is untouched by P-15 and must stay that way."
      >
        <RefusalView
          isRefusal={false}
          message="Could not reach the server. Check your connection."
          alternatives={[]}
          offer={null}
          offerFailed={false}
          onAccept={noop}
          onAdjust={noop}
        />
      </Case>
    </main>
  )
}
