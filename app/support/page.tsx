import type { Metadata } from 'next'
import Link from 'next/link'
import { BRAND } from '@/lib/brand'
import { Wordmark } from '@/components/ui/Wordmark'

export const metadata: Metadata = {
  title: `Support — ${BRAND.name}`,
  description: `Get help with ${BRAND.name} — contact, account, subscription, and data questions.`,
}

export default function SupportPage() {
  return (
    <div
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
        <Wordmark size="sm" />
        <Link
          href="/"
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
            Help
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
            Support
          </h1>
          <p style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '14px',
            color: 'var(--text-secondary)',
            lineHeight: 1.7,
            margin: '0 0 8px',
          }}>
            Something not working, or a question about your account? Email us — a real person reads it.
          </p>
        </div>

        {/* Contact card — primary, above the fold */}
        <Section title="Contact us">
          <P>The fastest way to reach us is email. We aim to reply within two working days.</P>
          <div style={{
            background: 'var(--card-bg)',
            border: '0.5px solid var(--border-col)',
            borderRadius: '12px',
            padding: '20px',
            marginTop: '16px',
          }}>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-primary)', marginBottom: '4px', fontWeight: 500 }}>{BRAND.name} Support</div>
            <A href="mailto:support@zonna.run">support@zonna.run</A>
          </div>
        </Section>

        <Section title="Managing your subscription">
          <SubHead>Cancel or change your plan</SubHead>
          <P>If you subscribed through the App Store, manage or cancel your subscription in iOS <em>Settings → [your name] → Subscriptions → {BRAND.name}</em>. Cancellation takes effect at the end of the current billing period — you keep paid access until then.</P>
          <SubHead>Free trial</SubHead>
          <P>New accounts include a free trial of the paid tier. You will not be charged during the trial, and it downgrades automatically to the free tier if you do not subscribe. Full terms are in the <A href="/terms">Terms of Service</A>.</P>
          <SubHead>Refunds</SubHead>
          <P>App Store purchases are handled by Apple — request refunds through your Apple account. For anything that looks like a billing error, email <A href="mailto:support@zonna.run">support@zonna.run</A> and we will look into it.</P>
        </Section>

        <Section title="Your account & data">
          <SubHead>Export or delete your data</SubHead>
          <P>You can delete your account and all associated data from the Profile screen in the app. If you would like a copy of your data first, email us and we will send it.</P>
          <SubHead>Sign-in trouble</SubHead>
          <P>{BRAND.name} signs you in with Apple or Google. If you cannot get in, email <A href="mailto:support@zonna.run">support@zonna.run</A> from the address linked to your account and we will help you recover access.</P>
        </Section>

        <Section title="Health & safety">
          <P>{BRAND.name} provides training guidance, not medical advice. Stop exercising and seek medical attention if you feel chest pain, severe breathlessness, dizziness, or any other concerning symptom. Consult a doctor before starting a new training plan if you have a health condition or have not exercised regularly in the past 12 months. Full disclaimer in the <A href="/terms">Terms of Service</A>.</P>
        </Section>

        <Section title="More">
          <P>
            <A href="/privacy">Privacy Policy</A> · <A href="/terms">Terms of Service</A>
          </P>
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
          }}>{BRAND.name}</span>
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
