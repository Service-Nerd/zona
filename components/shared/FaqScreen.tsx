'use client'

// FAQ-01 — Common questions, a door off Support (Design Board, 2026-09-29).
//
// No new pattern is authored here, deliberately. The markup is `ui-patterns.md`
// § FAQ disclosure (native <details>/<summary>, zero-JS, the `+` rotating to `×`),
// which the homepage and /charity-runners already use; the door is ME-DOORS-01's.
// A new screen is a hard Design Board trigger even so, and the sitting's one real
// objection was Sierra's: a FAQ is a patch over a product that is not obvious. Her
// condition lives in `lib/faq.ts` as `shouldBeObviousOn`, not here.
//
// Content is `lib/faq.ts` and only `lib/faq.ts`. This file renders; it never writes
// a question. A second copy of an answer is the whole failure this module exists to
// prevent.

import { APP_FAQS, FAQ_TITLE, FAQ_SUBTITLE } from '@/lib/faq'
import PinnedBackHeader from '@/components/shared/PinnedBackHeader'

export { FAQ_TITLE, FAQ_SUBTITLE }

export interface FaqScreenProps {
  onBack: () => void
  /** The contact row lives on Support, so the last word here is a way back to it
   *  rather than a dead end. A FAQ that cannot say "this did not help" is a wall. */
  onContact?: () => void
}

export default function FaqScreen({ onBack, onContact }: FaqScreenProps) {
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      {/* BACK-ARROW-TITLE-COLLIDE-01 — a short, discrete title, so it pins WITH the arrow. */}
      <PinnedBackHeader onClick={onBack} padding="16px 20px 8px" maxWidth={480}>
        {/* 🔴 FAQ-TITLE-INVERTED-01 — THESE WERE THE WRONG WAY ROUND, AND THE FOUNDER SAW IT.
            `FAQ_TITLE` ("Common questions") rendered as a tiny uppercase EYEBROW and
            `FAQ_SUBTITLE` ("The ones people actually ask.") rendered as the 26px screen
            title. So the runner tapped a door labelled *Common questions* and arrived at a
            screen headlined *The ones people actually ask.*
            ⚠️ `ME-DOORS-01` states the rule being broken, in as many words: *"a door's row
            label and the screen's own title are the same string by definition: the runner
            taps a word and expects to arrive at it."* Nothing enforced it, so
            `faqTitleOrder.test.ts` now does — for every door, not just this one.
            ⚠️ The eyebrow is GONE rather than re-pointed: title + sub is exactly what the
            six `ScreenHeader` screens render, and a third line here would be a shape this
            screen does not need. */}
        <div className="screen-header__title" style={{ marginTop: 'var(--space-4)' }}>
          {FAQ_TITLE}
        </div>
        <div className="screen-header__sub">
          {FAQ_SUBTITLE}
        </div>
      </PinnedBackHeader>

      <div style={{ padding: 'var(--space-6) 20px 48px', maxWidth: '480px', margin: '0 auto' }}>

        <div style={{
          background: 'var(--card)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--line)', boxShadow: 'var(--shadow-card)',
          overflow: 'hidden',
        }}>
          {APP_FAQS.map((f, i) => (
            <details key={f.q} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--line)' }}>
              <summary style={{
                listStyle: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                // 🔴 `gap: '12px'` here shipped in FAQ-01 and the suite was GREEN,
                // because `appSpacingScale` reads `git ls-files` and this file was
                // still UNTRACKED when I ran it. Second time in one build that an
                // unstaged file hid something. 12px IS on the scale: --space-3.
                gap: 'var(--space-3)',
                // 🔴 44px minimum target, and it is the PADDING that earns it, not a
                // height. BUTTON-GEOMETRY's floor arm was written because 18 hand-rolled
                // controls sat under 44px; a summary is a hand-rolled control.
                padding: '15px 18px', minHeight: '44px', boxSizing: 'border-box',
                fontFamily: 'var(--font-ui)', fontSize: '14px', fontWeight: 500,
                color: 'var(--ink)', lineHeight: 1.4,
              }}>
                <span>{f.q}</span>
                {/* The `+` → `×` rotation is owned by globals.css
                    (`details[open] > summary > span[aria-hidden]`), so this must stay a
                    DIRECT aria-hidden span child of summary. No class, no local rule. */}
                <span aria-hidden="true" style={{
                  color: 'var(--mute)', lineHeight: 1, flexShrink: 0,
                }}>+</span>
              </summary>
              <div style={{
                padding: '0 18px 16px',
                fontFamily: 'var(--font-ui)', fontSize: '13px',
                color: 'var(--ink-2)', lineHeight: 1.6,
              }}>
                {f.a}
              </div>
            </details>
          ))}
        </div>

        {onContact && (
          <button
            type="button"
            onClick={onContact}
            style={{
              width: '100%', marginTop: 'var(--space-5)', minHeight: '44px',
              background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)',
              textAlign: 'center',
            }}
          >
            Not answered here? Tell us.
          </button>
        )}
      </div>
    </div>
  )
}
