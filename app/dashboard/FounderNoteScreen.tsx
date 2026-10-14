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
import { MICRO_LABELS } from '@/components/shared/microLabels'
import { FOUNDER_STORY } from '@/lib/marketing/founderStory'
import PinnedBackHeader from '@/components/shared/PinnedBackHeader'

export default function FounderNoteScreen({ onBack }: { onBack: () => void }) {
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      {/* BACK-ARROW-TITLE-COLLIDE-01 — the arrow sits in an opaque band. The "title"
          here is an eyebrow plus an essay lead, so it stays in the flow and scrolls under
          the band's EDGE rather than under a disc, mid-word. */}
      <PinnedBackHeader onClick={onBack} maxWidth={480} />

      <div style={{ padding: '8px 20px 48px', maxWidth: '480px', margin: '0 auto' }}>

        {/* Eyebrow. 🔴 This comment used to say "matches Pattern 10 / Pattern 17
            tracking" while rendering 11px/0.14em against the eyebrow's
            10px/0.08em — a claim of conformance beside a non-conforming value
            (MICRO-LABEL-BRAND-STAMP-01). It now matches because it IS the role. */}
        <div style={{ ...MICRO_LABELS.eyebrow,
          fontFamily: 'var(--font-ui)',
          color: 'var(--mute)',
          marginBottom: 'var(--space-4)',
        }}>
          Why {BRAND.name} exists
        </div>

        {/* Lead — single sentence, larger, sets up the problem in plain language. */}
        {/* SUBPAGE-TYPE-SCALE-01 — the documented screen-title role, from its owner. */}
        <p className="screen-header__title" style={{ margin: 0 }}>
          {FOUNDER_STORY.opener}
        </p>

        {/* Body — editorial paragraphs. Inter 400, 15px, line-height 1.65,
            paragraph-spacing 14px. Max-width 360px → ~52ch line length. */}
        <div style={{
          fontFamily: 'var(--font-ui)', fontSize: '15px', fontWeight: 400,
          color: 'var(--ink-2)', lineHeight: 1.65,
          maxWidth: '360px',
        }}>
          {/* GTM-SITE-03 — narrative from the single owner. The TREATMENT
              here (no photograph) stays divergent from /about on purpose:
              in the app the voice is the asset, on the web a charity vetting
              a stranger needs a face. */}
          {FOUNDER_STORY.paragraphs.map((para, i) => (
            <p key={i} style={{ margin: i === FOUNDER_STORY.paragraphs.length - 1 ? '0 0 24px' : '0 0 14px' }}>
              {para}
            </p>
          ))}
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
          {/* 🔴 THE MOSS GOES IN THE RAIL, NOT THE SENTENCE (FOUNDER-TYPE-18PX-01,
              Design Board 2026-10-14, founder device review: *"the visual on this page
              does not look right"*).

              ⚠️ `--moss` carrying this sentence measured **3.24:1** on `--bg`, against
              AA's 4.5 — sampled from the founder's own screenshot, not inferred. Every
              other line on the page is `--ink-2` at 9.95. **The one sentence the page
              exists to deliver was the faintest text on it**, which is a hierarchy
              inversion, not a colour preference (Silvanto).

              🔑 THE WEBSITE HAD ALREADY SETTLED IT AND NOBODY TOLD THE APP. `/about`
              renders **this same `BRAND.coreTruth` string in this same 3px pull-rail**
              at `--fs-h4` / 700 / `--ink`, with the rail in `--moss-strong`. A 3px rail
              is a GRAPHIC at 3:1 and passes; moss carrying prose is TEXT at 4.5:1 and
              does not. Adopting that treatment beats darkening the green, and it is a
              precedent ratified by shipping rather than a new design.

              📐 IT WRAPS TO TWO LINES ON A 402pt PHONE AND THAT IS ACCEPTED, MEASURED.
              Canvas-measured at Inter: the sentence is 334px at 18/600 and 376px at 20/700,
              against a rail column of 344px at 402pt and **319px at 375pt**. ⚠️ The first run of this measurement was taken BEFORE `document.fonts.ready` and read 326/364 — canvas had fallen back off Inter. So it ALREADY
              wrapped on every 375pt phone at the old size; the founder simply owns a 402.
              A thesis on two lines is ordinary typography and the rail spans both (it is
              `top: 4px; bottom: 4px`, not a fixed height). Legibility at 9.95:1 is worth
              one wrap on one device class.

              🔑 THE TYPE COMES FROM THE OWNER, `.section-headline` — not retyped here.
              The first cut DID retype it inline and `appScreenTitle.test.ts` went red
              twice: it owns >=20px inline type on a pushed screen as "a hand-rolled
              screen title" and it pins the compact row's documented text. 🏪 **Collins
              had made exactly that a condition of the ruling** and the first cut ignored
              it; the gate is what enforced his condition. **Layout stays local** — the
              rail below is the call site's.

              ⛔ 18px IS NOT A LEVEL — permanent. 17 → 18 is 1.059×, below the 1.077×
              that killed 13px the day before. 20 is the declared level and the row now
              names this role. */}
          <span aria-hidden="true" style={{
            position: 'absolute', left: 0, top: '4px', bottom: '4px',
            width: '3px', background: 'var(--moss-strong)', borderRadius: '2px',
          }} />
          <p className="section-headline">
            {BRAND.coreTruth}
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
        <div style={{ ...MICRO_LABELS.eyebrow,
          fontFamily: 'var(--font-ui)',
          color: 'var(--mute)',
          marginBottom: 'var(--space-6)',
        }}>
          {BRAND.brandStatement}
        </div>

        {/* Footer — small caption + mailto. 44pt tap target on the link. */}
        <div style={{ height: '1px', background: 'var(--line)', margin: '0 0 16px', maxWidth: '360px' }} />
        {/* 12/400, not 12/500: the scale declares 12px at weight 400 only
            (Card secondary, Screen subtitle, Muted / hint). No 500 is authored here. */}
        <div style={{
          fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 400,
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
            // `--moss-strong`, never `--moss`: this is the only tappable thing on the
            // page besides the back arrow, and a link is the worst text to render below
            // AA (Wroblewski, the DANGER-TEXT-CONTRAST-01 argument). 3.24 -> 4.82.
            fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 400,
            color: 'var(--moss-strong)',
            textDecoration: 'underline', textUnderlineOffset: '3px',
          }}
        >
          russ@zonna.run
        </a>
      </div>
    </div>
  )
}
