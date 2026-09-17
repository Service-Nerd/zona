// LOCAL DESIGN HARNESS — 404s in production (see the guard below), not linked
// from anywhere, not in the sitemap.
//
// Exists because the Me screen's identity card and profile form sit behind
// auth, a plan, and a tab: the only way to SEE the missing-name state was to
// be signed in as an account that had one. That is exactly how the founder's
// own first and last name shipped as the placeholders and read, on a test
// account, as data the app already held.
//
// Renders the real components with fixture props. If you change IdentityCard
// or ProfileSection, check this page.

'use client'

import { useState } from 'react'
import { notFound } from 'next/navigation'
import { IdentityCard } from '@/components/shared/IdentityCard'
import { ProfileSection, focusProfileNameField } from '@/components/shared/ProfileSection'

const CASES: {
  title: string
  note: string
  initials: string
  firstName: string
  lastName: string
  tierLabel: string
}[] = [
  {
    title: 'No name — the state this page exists for',
    note: 'Tappable row, chevron, and a reason. Was a dead grey "Your name" label with nothing to tap. Tap it: the first-name field below should scroll into view and take focus.',
    initials: 'T', firstName: '', lastName: '', tierLabel: 'Trial',
  },
  {
    title: 'No name, no plan — avatar falls back to the email',
    note: 'Every earlier source is empty here. The circle used to render blank: plan.meta.athlete is an empty STRING, so the old ?? fallback never fired.',
    initials: 'R', firstName: '', lastName: '', tierLabel: 'Free',
  },
  {
    title: 'First name only',
    note: 'What an email signup now produces. One initial, no chevron, not tappable.',
    initials: 'R', firstName: 'Russell', lastName: '', tierLabel: 'Pro',
  },
  {
    title: 'Full name',
    note: 'The Google / Apple path, unchanged.',
    initials: 'RS', firstName: 'Russell', lastName: 'Shear', tierLabel: 'Pro',
  },
  {
    title: 'Long name — overflow',
    note: 'Both lines ellipsis rather than wrapping the card taller.',
    initials: 'AB', firstName: 'Alexandrina', lastName: 'Featherstonehaugh-Cholmondeley', tierLabel: 'Trial',
  },
]

export default function MePreviewPage() {
  // Never reachable in production. NODE_ENV is inlined at build time, so this
  // is dead-stripped.
  if (process.env.NODE_ENV === 'production') notFound()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName]   = useState('')

  return (
    <main style={{ background: 'var(--bg)', minHeight: '100vh', padding: '28px 16px 64px', fontFamily: 'var(--font-ui)' }}>
      <h1 style={{ fontFamily: 'var(--font-brand)', fontSize: '20px', fontWeight: 600, color: 'var(--ink)', margin: '0 0 6px' }}>
        Me screen — identity + profile
      </h1>
      <p style={{ fontSize: '12px', color: 'var(--mute)', lineHeight: 1.6, margin: '0 0 24px', maxWidth: '420px' }}>
        Real components, fixture props. Dev only.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '420px' }}>
        {CASES.map(c => (
          <div key={c.title} style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
              {c.title}
            </div>
            <div style={{ background: 'var(--bg)', padding: '12px', borderRadius: '10px' }}>
              <IdentityCard
                initials={c.initials}
                firstName={c.firstName}
                lastName={c.lastName}
                tierLabel={c.tierLabel}
                onAddName={focusProfileNameField}
              />
            </div>
            <p style={{ fontSize: '12px', color: 'var(--mute)', lineHeight: 1.5, margin: '10px 0 0' }}>{c.note}</p>
          </div>
        ))}

        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
            Profile form — live
          </div>
          <div style={{ background: 'var(--bg)', padding: '12px', borderRadius: '10px' }}>
            <ProfileSection
              firstName={firstName}
              lastName={lastName}
              email="test@test.com"
              onSave={(fn, ln) => { setFirstName(fn); setLastName(ln) }}
            />
          </div>
          <p style={{ fontSize: '12px', color: 'var(--mute)', lineHeight: 1.5, margin: '10px 0 0' }}>
            Placeholders are the product&apos;s name, not a person&apos;s. Save writes back into the first card above.
          </p>
        </div>
      </div>
    </main>
  )
}
