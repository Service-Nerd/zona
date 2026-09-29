// LOCAL DESIGN HARNESS — 404s in production, not linked from anywhere, not in the sitemap.
//
// FAQ-01. Exists for the same reason `/preferences-preview` does: the FAQ door sits behind
// auth, a plan and a tab, so the only way to SEE it is to be signed in. Every micro-label
// wave this week that was verified by READING later turned out to be wrong, and the two
// blind spots that mattered most were found by rendering a page like this one.
//
// ⚠️ It renders the REAL component with the REAL content module. A preview that rebuilds
// the markup it previews is testing a different program (recorded 2026-09-26).

'use client'

import { notFound } from 'next/navigation'
import FaqScreen from '@/components/shared/FaqScreen'
import { APP_FAQS, WEB_FAQS } from '@/lib/faq'
import { MICRO_LABELS } from '@/components/shared/microLabels'

export default function FaqPreview() {
  if (process.env.NODE_ENV === 'production') notFound()

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100vh' }}>
      <div style={{ maxWidth: '420px', margin: '0 auto' }}>
        <div style={{ ...MICRO_LABELS.dataLabel, color: 'var(--mute)', padding: '16px 20px 0' }}>
          {APP_FAQS.length} in app · {WEB_FAQS.length} on /support
        </div>
        {/* Both handlers are live so the contact hand-off can be clicked, not just seen.
            `onContact` exists because a FAQ that cannot say "this did not help" is a wall. */}
        <FaqScreen
          onBack={() => console.log('[faq-preview] back')}
          onContact={() => console.log('[faq-preview] contact')}
        />
      </div>
    </div>
  )
}
