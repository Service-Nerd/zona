'use client'

// FOUNDER-01 — Founder note page accessible from Me → "Why Zonna exists".
//
// Static content. Single page. Editorial layout per ui-patterns.md
// frontend-design brief 2026-05-23:
//
//   eyebrow → lead → body → pull-line (3px moss rail) → body →
//   brand-statement stamp → footer caption + mailto.
//
// Body max-width 360px to hit ~52ch line length — editorial best
// practice on mobile. No photo at v1 (voice is the asset, not the
// face). No CTA — the page ends on BRAND.brandStatement.
//
// Copy is DRAFT — written to the spine in the spec; Russ will
// rewrite the line-by-line before final.

import { BRAND } from '@/lib/brand'

export default function FounderNoteScreen({ onBack }: { onBack: () => void }) {
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      {/* Back arrow — 44pt tap target, --bg-soft round button per Session
          Detail header pattern in ui-patterns.md § Screen Templates. */}
      <div style={{ padding: '16px 16px 8px' }}>
        <button
          onClick={onBack}
          aria-label="Back"
          style={{
            width: '44px', height: '44px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: 'none', borderRadius: '50%',
            background: 'var(--bg-soft)',
            color: 'var(--ink)',
            cursor: 'pointer',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M13 4L7 10L13 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div style={{ padding: '8px 20px 48px', maxWidth: '480px', margin: '0 auto' }}>

        {/* Eyebrow — matches Pattern 10 / Pattern 17 tracking. */}
        <div style={{
          fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 700,
          color: 'var(--mute)', letterSpacing: '0.14em', textTransform: 'uppercase',
          marginBottom: '14px',
        }}>
          Why {BRAND.name} exists
        </div>

        {/* Lead — single sentence, larger, sets up the problem in plain language. */}
        <p style={{
          fontFamily: 'var(--font-brand)', fontSize: '22px', fontWeight: 700,
          color: 'var(--ink)', letterSpacing: '-0.3px', lineHeight: 1.3,
          maxWidth: '360px',
          margin: '0 0 24px',
        }}>
          The runner had a problem.
        </p>

        {/* Body — editorial paragraphs. Inter 400, 15px, line-height 1.65,
            paragraph-spacing 14px. Max-width 360px → ~52ch line length. */}
        <div style={{
          fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 400,
          color: 'var(--ink-2)', lineHeight: 1.65,
          maxWidth: '360px',
        }}>
          <p style={{ margin: '0 0 14px' }}>
            Heart rate spiking before the warm-up was done. Every easy run
            creeping into Zone 3. A plateau that wouldn't move, no matter
            how many sessions went in.
          </p>

          <p style={{ margin: '0 0 14px' }}>
            The diagnosis took embarrassingly long: easy days weren't easy.
            Hard days weren't hard. Everything ended up in the same grey
            middle — medium-hard on Monday, medium-hard on Saturday,
            medium-hard on race day.
          </p>

          <p style={{ margin: '0 0 24px' }}>
            So the runner built a tool. Ran a 52K with it. Started training
            for a 100K.
          </p>
        </div>

        {/* Pull-line — thesis. 3px moss rail anatomy borrowed from
            Pattern 16b § Companion (signals "this is the thesis" using
            the same visual vocabulary as AI-coached lines, without
            claiming AI authorship). */}
        <div style={{
          position: 'relative',
          paddingLeft: '16px',
          margin: '0 0 24px',
          maxWidth: '360px',
        }}>
          <span aria-hidden="true" style={{
            position: 'absolute', left: 0, top: '4px', bottom: '4px',
            width: '3px', background: 'var(--moss)', borderRadius: '2px',
          }} />
          <p style={{
            fontFamily: 'var(--font-brand)', fontSize: '18px', fontWeight: 600,
            color: 'var(--moss)', letterSpacing: '-0.2px', lineHeight: 1.35,
            margin: 0,
          }}>
            You&apos;re trying hard. That&apos;s the problem.
          </p>
        </div>

        {/* Continuation — names the audience without flattering it. */}
        <p style={{
          fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 400,
          color: 'var(--ink-2)', lineHeight: 1.65,
          maxWidth: '360px',
          margin: '0 0 32px',
        }}>
          {BRAND.name} is for the runners who blur their zones. Day-job
          runners who go medium-hard on everything, never truly push,
          never truly recover. The plan won&apos;t let you do that any more.
        </p>

        {/* Hairline + brand statement stamp. Same eyebrow anatomy as
            BRAND.voiceAnchor on SessionCompleteCard — quiet, present. */}
        <div style={{ height: '1px', background: 'var(--line)', margin: '0 0 20px', maxWidth: '360px' }} />
        <div style={{
          fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 700,
          color: 'var(--mute)', letterSpacing: '0.14em', textTransform: 'uppercase',
          marginBottom: '32px',
        }}>
          {BRAND.brandStatement}
        </div>

        {/* Footer — small caption + mailto. 44pt tap target on the link. */}
        <div style={{ height: '1px', background: 'var(--line)', margin: '0 0 16px', maxWidth: '360px' }} />
        <div style={{
          fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 500,
          color: 'var(--ink-2)', lineHeight: 1.6,
          marginBottom: '4px',
        }}>
          Russ Shear &middot; Founder
        </div>
        <a
          href="mailto:russ@zonna.run"
          style={{
            display: 'inline-flex', alignItems: 'center',
            minHeight: '44px',
            fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 500,
            color: 'var(--moss)',
            textDecoration: 'underline', textUnderlineOffset: '3px',
          }}
        >
          russ@zonna.run
        </a>
      </div>
    </div>
  )
}
