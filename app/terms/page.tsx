import type { Metadata } from 'next'
import Link from 'next/link'
import { BRAND, PRICING } from '@/lib/brand'

export const metadata: Metadata = {
  title: `Terms of Service — ${BRAND.name}`,
  description: `The terms governing use of ${BRAND.name}.`,
}

export default function TermsPage() {
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
        <span style={{
          fontFamily: 'var(--font-brand)',
          fontSize: '20px',
          fontWeight: 500,
          letterSpacing: '0.08em',
          color: 'var(--accent)',
        }}>
          {BRAND.name}
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
            Terms of Service
          </h1>
          <p style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '14px',
            color: 'var(--text-secondary)',
            lineHeight: 1.7,
            margin: '0 0 8px',
          }}>
            The agreement between you and {BRAND.name}. Plain English throughout. If something is unclear, email us — we will explain it.
          </p>
          <div style={{
            fontFamily: 'var(--font-ui)',
            fontSize: '11px',
            color: 'var(--text-muted)',
            letterSpacing: '0.04em',
          }}>
            Last updated: May 2026
          </div>
        </div>

        <Section title="Acceptance">
          <P>By creating an account or using {BRAND.name} (&quot;the service&quot;), you agree to these terms. If you do not agree, do not use the service.</P>
          <P>You must be at least 14 years old to use {BRAND.name}. If you are under 18, you confirm that a parent or guardian has reviewed these terms with you.</P>
        </Section>

        <Section title="Who we are">
          <P>{BRAND.name} is operated by Russ (service-nerd), based in the United Kingdom. The service is available at <strong>zona.app</strong> {/* TODO: update to vetra.run when domain migrates */} and via the App Store and Google Play.</P>
          <P>Contact: <A href="mailto:support@zona.app">support@zona.app</A> {/* TODO: update to vetra.run when domain migrates */}.</P>
        </Section>

        <Section title="Your account">
          <P>You are responsible for keeping your account credentials secure and for activity that happens under your account. Tell us immediately if you suspect unauthorised access.</P>
          <P>You agree to provide accurate information when signing up and to keep that information current. One person, one account.</P>
        </Section>

        <Section title="The service">
          <P>{BRAND.name} provides personalised running training plans, session tracking, and coaching feedback. The service relies on data you provide (race, fitness, HR zones) and, optionally, data from connected sources (Strava, Apple Health).</P>
          <P>Training advice from {BRAND.name} is informational only. It is not medical advice. You alone are responsible for deciding whether a session is safe for you on any given day. If you have any health condition, are recovering from injury, or have not exercised in a long time, consult a doctor before starting a training plan.</P>
        </Section>

        <Section title="Free and paid tiers">
          <P>{BRAND.name} has two tiers: a free tier and a paid subscription. The free tier provides generic training plans, session display, session logging, and pace/HR targets. The paid subscription unlocks AI-generated plans, dynamic plan reshaping, Strava and Apple Health intelligence, AI session feedback, and weekly coaching reports. The full list of paid features is shown on the upgrade screen at the time of purchase.</P>
          <P>New accounts include a {PRICING.trialDays}-day free trial of the paid tier. The trial begins on first sign-up, runs once per account, and downgrades automatically to the free tier if you do not subscribe.</P>
        </Section>

        <Section title="Subscription terms">
          <SubHead>Price and billing period</SubHead>
          <P>Paid plans are billed at <strong>{PRICING.monthly.label}</strong> or <strong>{PRICING.annual.label}</strong> ({PRICING.annual.perMonthDisplay} equivalent), in {PRICING.currency}. Prices include applicable taxes where required by law.</P>

          <SubHead>Trial</SubHead>
          <P>Your first subscription includes the {PRICING.trialDays}-day free trial described above. You will not be charged during the trial. If you do not cancel before the trial ends, your subscription begins automatically at the price you selected. Any unused portion of the trial is forfeited at the moment a paid subscription is purchased.</P>

          <SubHead>Auto-renewal</SubHead>
          <P>Subscriptions renew automatically at the end of each billing period (monthly or annual) at the then-current price unless you cancel at least 24 hours before the end of the current period.</P>

          <SubHead>Payment</SubHead>
          <P>If you subscribe through the App Store, payment is charged to your Apple ID at confirmation of purchase, and renewals are charged to your Apple ID within 24 hours before the end of the current period. If you subscribe through our website, payment is charged to your selected payment method via our payment processor (Stripe).</P>

          <SubHead>Cancellation</SubHead>
          <P>You can cancel at any time. Cancellation takes effect at the end of the current billing period — you keep paid access until then. <strong>If you subscribed through the App Store</strong>, manage and cancel your subscription in iOS <em>Settings → [your name] → Subscriptions</em>. <strong>If you subscribed through our website</strong>, cancel from the Profile screen in the app or by emailing <A href="mailto:support@zona.app">support@zona.app</A>.</P>

          <SubHead>Refunds</SubHead>
          <P>App Store purchases are subject to Apple&apos;s refund policy — refund requests go to Apple, not to us. For website purchases, refunds are at our discretion: contact <A href="mailto:support@zona.app">support@zona.app</A> within 14 days of a renewal charge if you believe it was made in error and we will review it.</P>

          <SubHead>Price changes</SubHead>
          <P>If we change the subscription price, we will notify you by email or in-app at least 30 days before the change takes effect, so you have time to cancel before being charged the new price.</P>
        </Section>

        <Section title="Acceptable use">
          <P>You agree not to:</P>
          <ul style={{ margin: '0 0 16px', padding: '0 0 0 20px' }}>
            {[
              'Use the service for anything illegal or to harm others',
              'Attempt to access another user’s account or data',
              'Reverse-engineer, decompile, or attempt to extract the source code of the service',
              'Scrape, copy, or redistribute training plans, coaching content, or other paid material',
              'Resell or sublicense access to the service',
              'Use the service to build a competing product',
              'Interfere with the service or its security',
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
          <P>We may suspend or terminate accounts that violate these rules.</P>
        </Section>

        <Section title="Your data">
          <P>How we collect, store, and use your personal data is described in our <A href="/privacy">Privacy Policy</A>. You retain ownership of training data you generate (sessions, plans, feedback). You grant us a limited licence to store and process this data for the sole purpose of providing the service to you.</P>
          <P>You can export or delete your data at any time. See the Privacy Policy for details.</P>
        </Section>

        <Section title="Intellectual property">
          <P>{BRAND.name} — including the software, the training plan engine, the coaching content, the brand, the design system, and the underlying methodology — is owned by us and protected by copyright and other intellectual property laws. We grant you a personal, non-exclusive, non-transferable licence to use the service for your own training, subject to these terms.</P>
          <P>Nothing in these terms transfers ownership of any intellectual property to you.</P>
        </Section>

        <Section title="Third-party services">
          <P>The service integrates with third-party platforms (Strava, Apple Health, Google sign-in, Apple sign-in, Anthropic, Supabase, Stripe, RevenueCat, Apple App Store). Your use of those platforms is governed by their own terms. We are not responsible for outages, errors, or policy changes on those platforms.</P>
        </Section>

        <Section title="Health and safety disclaimer">
          <P><strong>{BRAND.name} is not a medical device or a healthcare service.</strong> Training plans, coaching feedback, readiness signals, and session targets are generated from algorithms and your self-reported data. They are guidance, not prescriptions.</P>
          <P>You are solely responsible for monitoring how you feel during exercise and for deciding to stop, slow down, or skip a session. Stop immediately and seek medical attention if you experience chest pain, severe shortness of breath, dizziness, fainting, or any other concerning symptom.</P>
          <P>Consult a qualified healthcare professional before starting any new training programme — particularly if you have a heart condition, high blood pressure, are pregnant, are recovering from an injury, or have not exercised regularly in the past 12 months.</P>
        </Section>

        <Section title="Disclaimers">
          <P>The service is provided &quot;as is&quot; and &quot;as available&quot;. To the fullest extent permitted by law, we disclaim all warranties, express or implied, including warranties of merchantability, fitness for a particular purpose, accuracy, and non-infringement.</P>
          <P>We do not guarantee that the service will be uninterrupted, error-free, or that any specific training outcome (race time, fitness improvement, injury prevention) will result from using it.</P>
        </Section>

        <Section title="Limitation of liability">
          <P>To the fullest extent permitted by law, {BRAND.name} and its operators will not be liable for any indirect, incidental, consequential, special, or punitive damages — including loss of profits, loss of data, or personal injury — arising from your use of the service.</P>
          <P>Our total aggregate liability to you for any claim arising from these terms or the service will not exceed the amount you have paid us in the 12 months preceding the event giving rise to the claim, or £100, whichever is greater.</P>
          <P>Nothing in these terms limits liability for death or personal injury caused by negligence, fraud, or any liability that cannot be excluded by law.</P>
        </Section>

        <Section title="Termination">
          <P>You can stop using the service at any time and delete your account from the Profile screen.</P>
          <P>We may suspend or terminate your access if you breach these terms, if continued operation creates legal or security risk, or if we discontinue the service. We will give reasonable notice unless immediate action is required to protect the service or other users.</P>
          <P>On termination, your right to use the service ends. Sections that by their nature should survive termination — including intellectual property, disclaimers, limitation of liability, and governing law — survive.</P>
        </Section>

        <Section title="Changes to these terms">
          <P>We may update these terms from time to time. If changes are material, we will notify you by email or in-app at least 14 days before they take effect. The &quot;last updated&quot; date at the top of this page reflects the most recent revision.</P>
          <P>Continued use of {BRAND.name} after changes take effect constitutes acceptance of the updated terms.</P>
        </Section>

        <Section title="Governing law">
          <P>These terms are governed by the laws of England and Wales. Any dispute arising from these terms or the service will be subject to the exclusive jurisdiction of the courts of England and Wales, except that you may bring claims in the courts of your country of residence where local consumer-protection law gives you that right.</P>
        </Section>

        <Section title="Contact">
          <P>For questions about these terms:</P>
          <div style={{
            background: 'var(--card-bg)',
            border: '0.5px solid var(--border-col)',
            borderRadius: '12px',
            padding: '20px',
            marginTop: '16px',
          }}>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--text-primary)', marginBottom: '4px', fontWeight: 500 }}>{BRAND.name}</div>
            {/* TODO: update to vetra.run when domain migrates */}
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
