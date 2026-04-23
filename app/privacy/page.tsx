import type { Metadata } from 'next'
import Link from 'next/link'
import { BRAND } from '@/lib/brand'

export const metadata: Metadata = {
  title: 'Privacy Policy — Zona',
  description: 'How Zona collects, uses, and protects your data.',
}

export default function PrivacyPage() {
  return (
    <div
      data-theme="dark"
      style={{
        minHeight: '100dvh',
        background: 'var(--bg)',
        padding: '0 0 80px',
      }}
    >
      {/* Header bar */}
      <div style={{
        borderBottom: '0.5px solid var(--border-col)',
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        background: 'var(--bg)',
        zIndex: 10,
      }}>
        <span style={{
          fontFamily: 'var(--font-brand)',
          fontSize: '20px',
          fontWeight: 500,
          letterSpacing: '0.08em',
          color: 'var(--accent)',
        }}>
          Zona
        </span>
        <Link
          href="/auth/login"
          style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '11px',
            color: 'var(--text-muted)',
            textDecoration: 'none',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          ← Back
        </Link>
      </div>

      {/* Content */}
      <div style={{
        maxWidth: '640px',
        margin: '0 auto',
        padding: '48px 24px 0',
      }}>

        {/* Title block */}
        <div style={{ marginBottom: '48px' }}>
          <div style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '10px',
            color: 'var(--accent)',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            marginBottom: '12px',
          }}>
            Legal
          </div>
          <h1 style={{
            fontFamily: 'var(--font-brand)',
            fontSize: '32px',
            fontWeight: 500,
            color: 'var(--text-primary)',
            letterSpacing: '-0.5px',
            lineHeight: 1.15,
            margin: '0 0 16px',
          }}>
            Privacy Policy
          </h1>
          <p style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '14px',
            color: 'var(--text-secondary)',
            lineHeight: 1.7,
            margin: '0 0 8px',
          }}>
            We built Zona to help you train smarter, not to harvest your data. This policy explains what we collect, why, and what you can do about it. Plain English throughout — no legal fog.
          </p>
          <div style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '11px',
            color: 'var(--text-muted)',
            letterSpacing: '0.04em',
          }}>
            Last updated: April 2026
          </div>
        </div>

        <Section title="Who we are">
          <P>Zona is a running training application operated by Russ (service-nerd). The app is available at <strong>zona.app</strong> and via the App Store and Google Play.</P>
          <P>For any privacy-related queries, contact us at <A href="mailto:support@zona.app">support@zona.app</A>.</P>
        </Section>

        <Section title="What we collect">
          <P>We collect the minimum needed to run the app. Nothing more.</P>
          <SubHead>Account data</SubHead>
          <P>When you sign up, we store your email address and an encrypted password (if using email sign-in), or a reference to your Google or Apple account (if using OAuth). We also store your first name, last name, and any profile details you choose to add.</P>
          <SubHead>Training data</SubHead>
          <P>To deliver a personalised training plan, we store: your race date, race distance, weekly training volume, HR zones (resting HR, max HR), fitness level, and plan preferences. This data is provided by you during plan generation and is stored in your account.</P>
          <SubHead>Session data</SubHead>
          <P>When you log a training session, we store: completion status, RPE (rate of perceived exertion, 1–10), fatigue tags, distance, duration, and — where available from Strava — your average heart rate. This is used to provide coaching feedback and track your progress.</P>
          <SubHead>Usage data</SubHead>
          <P>We do not currently collect analytics or behavioural data beyond what is required for core app functionality. When analytics are added, this policy will be updated.</P>
        </Section>

        <Section title="Strava">
          <P>If you connect Strava, Zona requests read-only access to your Strava activities. Specifically: <strong>Zona will read your Strava activities to provide coaching insights.</strong> We do not write to Strava, we do not access your social connections, and we do not share your Strava data with third parties.</P>
          <P>Your Strava access token is stored securely in your account. You can disconnect Strava at any time from the Profile screen — this deletes the stored token immediately.</P>
        </Section>

        <Section title="How we use your data">
          <ul style={{ margin: '0 0 16px', padding: '0 0 0 20px' }}>
            {[
              'To generate and display your personalised training plan',
              'To provide session-level coaching feedback (effort flags, Zona voice responses)',
              'To display your progress over time (session history, fatigue trends)',
              'To connect your Strava activities to your training plan',
              'To send transactional emails (account confirmation, password reset)',
            ].map((item, i) => (
              <li key={i} style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '14px',
                color: 'var(--text-secondary)',
                lineHeight: 1.7,
                marginBottom: '6px',
              }}>{item}</li>
            ))}
          </ul>
          <P>We do not sell your data. We do not use your data for advertising. We do not share your data with third parties except as described below.</P>
        </Section>

        <Section title="Third parties">
          <SubHead>Supabase</SubHead>
          <P>Our database and authentication are provided by Supabase, Inc. Your data is stored on Supabase infrastructure (AWS, EU region). Supabase is GDPR-compliant. <A href="https://supabase.com/privacy">Supabase privacy policy →</A></P>
          <SubHead>Anthropic (Claude AI)</SubHead>
          <P>When you use the AI coaching features, session data is sent to Anthropic's API to generate a coaching response. Anthropic does not use API inputs to train their models by default. <A href="https://www.anthropic.com/privacy">Anthropic privacy policy →</A></P>
          <SubHead>Strava</SubHead>
          <P>If connected, Strava activity data is fetched via the Strava API and stored in your Zona account. <A href="https://www.strava.com/legal/privacy">Strava privacy policy →</A></P>
          <SubHead>Vercel</SubHead>
          <P>The app is hosted on Vercel. Request logs may be retained by Vercel per their standard policies. <A href="https://vercel.com/legal/privacy-policy">Vercel privacy policy →</A></P>
        </Section>

        <Section title="Data retention">
          <P>We keep your data for as long as your account is active. If you delete your account, all associated data is permanently deleted within 30 days — including your plan, session history, and Strava connection.</P>
          <P>Supabase authentication records are deleted immediately on account deletion.</P>
        </Section>

        <Section title="Your rights (GDPR)">
          <P>If you are based in the UK or European Economic Area, you have the following rights under GDPR:</P>
          <ul style={{ margin: '0 0 16px', padding: '0 0 0 20px' }}>
            {[
              'Right of access — request a copy of all data we hold about you',
              'Right to rectification — correct inaccurate or incomplete data',
              'Right to erasure — request deletion of your data ("right to be forgotten")',
              'Right to portability — receive your data in a structured, machine-readable format',
              'Right to object — object to processing of your data for specific purposes',
              'Right to withdraw consent — where processing is based on consent, you may withdraw it at any time',
            ].map((item, i) => (
              <li key={i} style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '14px',
                color: 'var(--text-secondary)',
                lineHeight: 1.7,
                marginBottom: '6px',
              }}>{item}</li>
            ))}
          </ul>
          <P>To exercise any of these rights, email <A href="mailto:support@zona.app">support@zona.app</A>. We will respond within 30 days.</P>
        </Section>

        <Section title="Your rights (CCPA)">
          <P>If you are a California resident, you have rights under the California Consumer Privacy Act (CCPA):</P>
          <ul style={{ margin: '0 0 16px', padding: '0 0 0 20px' }}>
            {[
              'Right to know what personal information we collect and how it is used',
              'Right to delete personal information we have collected',
              'Right to opt out of the sale of personal information (we do not sell your data)',
              'Right to non-discrimination for exercising your CCPA rights',
            ].map((item, i) => (
              <li key={i} style={{
                fontFamily: 'var(--font-ui)',
                fontSize: '14px',
                color: 'var(--text-secondary)',
                lineHeight: 1.7,
                marginBottom: '6px',
              }}>{item}</li>
            ))}
          </ul>
          <P>To exercise these rights, email <A href="mailto:support@zona.app">support@zona.app</A>.</P>
        </Section>

        <Section title="Account deletion">
          <P>You can delete your account at any time from the Profile screen in the app. Deletion is permanent and removes all associated data: your plan, session history, Strava connection, and account credentials.</P>
          <P>If you are unable to delete via the app, email <A href="mailto:support@zona.app">support@zona.app</A> and we will delete your account within 7 days.</P>
        </Section>

        <Section title="Children">
          <P>Zona is not directed at children under 13. We do not knowingly collect personal data from anyone under 13. If you believe a child under 13 has provided us with personal data, please contact <A href="mailto:support@zona.app">support@zona.app</A> and we will delete it promptly.</P>
        </Section>

        <Section title="Cookies and local storage">
          <P>Zona uses browser local storage (not cookies) to persist your theme preference and Strava session token on your device. This data stays on your device and is not transmitted to our servers.</P>
          <P>We do not use tracking cookies or third-party advertising cookies.</P>
        </Section>

        <Section title="Changes to this policy">
          <P>If we make material changes to this policy, we will notify you by email or via an in-app notice before the changes take effect. The "last updated" date at the top of this page reflects the most recent revision.</P>
          <P>Continued use of Zona after changes constitutes acceptance of the updated policy.</P>
        </Section>

        <Section title="Contact">
          <P>For any questions about this policy or how your data is handled:</P>
          <div style={{
            background: 'var(--card-bg)',
            border: '0.5px solid var(--border-col)',
            borderRadius: '12px',
            padding: '20px',
            marginTop: '16px',
          }}>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-primary)', marginBottom: '4px', fontWeight: 500 }}>Zona</div>
            <A href="mailto:support@zona.app">support@zona.app</A>
          </div>
        </Section>

        {/* Footer */}
        <div style={{
          marginTop: '64px',
          paddingTop: '24px',
          borderTop: '0.5px solid var(--border-col)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <span style={{
            fontFamily: 'var(--font-brand)',
            fontSize: '16px',
            fontWeight: 500,
            letterSpacing: '0.08em',
            color: 'var(--accent)',
          }}>Zona</span>
          <span style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '10px',
            color: 'var(--text-muted)',
            opacity: 0.5,
          }}>
            {BRAND.brandStatement}
          </span>
        </div>

      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '48px' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '20px',
        paddingBottom: '12px',
        borderBottom: '0.5px solid var(--border-col)',
      }}>
        <div style={{ width: '3px', height: '16px', background: 'var(--accent)', borderRadius: '2px', flexShrink: 0 }} />
        <h2 style={{
          fontFamily: 'var(--font-brand)',
          fontSize: '16px',
          fontWeight: 500,
          color: 'var(--text-primary)',
          letterSpacing: '-0.2px',
          margin: 0,
        }}>
          {title}
        </h2>
      </div>
      {children}
    </div>
  )
}

function SubHead({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: 'var(--font-ui)',
      fontSize: '11px',
      fontWeight: 500,
      color: 'var(--text-primary)',
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      marginBottom: '6px',
      marginTop: '20px',
    }}>
      {children}
    </div>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      fontFamily: 'var(--font-ui)',
      fontSize: '14px',
      color: 'var(--text-secondary)',
      lineHeight: 1.75,
      margin: '0 0 14px',
    }}>
      {children}
    </p>
  )
}

function A({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      style={{
        color: 'var(--accent)',
        textDecoration: 'underline',
        textUnderlineOffset: '2px',
        fontFamily: 'var(--font-ui)',
        fontSize: '14px',
      }}
    >
      {children}
    </a>
  )
}
