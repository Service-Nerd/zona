'use client'

// DASHBOARD-SCREEN-EXTRACT-01 — lifted verbatim out of `DashboardClient.tsx`.
//
// It was a module-level function in a 14,447-line file, so it closed over nothing and
// this move changes no behaviour. What it changes is REACH: nothing could import it,
// so it could not be rendered by a harness, a mounting test, or anything but a live
// signed-in session. Fourteen screens were in that position.
//
// ⚠️ The body below is UNCHANGED. If it needs editing, edit it in a separate commit,
// so the move stays reviewable as a move.

import BackButton from '@/components/shared/BackButton'
import Button from '@/components/ui/Button'
import { BRAND } from '@/lib/brand'
import type { Plan } from '@/types/plan'
import { App as CapacitorApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { Z_LAYERS } from '@/lib/ui/zLayers'
import { useEffect, useState } from 'react'
import { useScrolledContainer } from '@/lib/ui/useScrolledContainer'

// client (common on desktop web, where mailto: silently no-ops). Mirrors the
// /support web page register and the DeleteAccountScreen sub-view structure.
const SUPPORT_EMAIL = 'support@zonna.run'

export default function SupportScreen({ onBack, email, hasPaidAccess, trialDaysLeft }: {
  onBack: () => void
  email?: string
  hasPaidAccess?: boolean
  trialDaysLeft?: number | null
}) {
  const { ref: pinRef, scrolled: pinScrolled } = useScrolledContainer(true)
  const [copied, setCopied] = useState(false)
  const [appInfo, setAppInfo] = useState<{ version: string; build: string } | null>(null)

  const platform = Capacitor.getPlatform() // 'ios' | 'android' | 'web'
  const tier = hasPaidAccess ? ((trialDaysLeft ?? 0) > 0 ? 'Trial' : 'Pro') : 'Free'

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    CapacitorApp.getInfo()
      .then(info => setAppInfo({ version: info.version, build: info.build }))
      .catch(() => { /* not critical — email still sends without it */ })
  }, [])

  const versionLabel = appInfo ? `${appInfo.version} (${appInfo.build})` : platform

  function buildMailto() {
    const versionTag = appInfo?.version ? `v${appInfo.version}` : platform
    const subject = `${BRAND.name} support · ${versionTag}`
    const body = [
      '',
      '',
      '———',
      `Sent from ${BRAND.name} ${versionLabel} · ${platform}`,
      `Account: ${email || '(not available)'}`,
      `Plan: ${tier}`,
      '(This helps us help you; feel free to delete it.)',
    ].join('\n')
    return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  function handleEmail() {
    window.location.href = buildMailto()
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL)
    } catch {
      /* address is selectable on screen as the fallback-to-the-fallback */
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ minHeight: '100%', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      {/* 🔴 BACK-ARROW-FLOAT-04 — PINNED AS A GROUP, NOT FLOATED. This is the OTHER
          arrow family `useScrolledContainer` already names (`BACK-HEADER-OWNER-01`): arrow
          and title in one row. Floating the arrow alone would tear it off its title, which
          is exactly the wizard mistake the founder caught. Same treatment as the session
          and post-run headers. */}
      <div
        ref={pinRef}
        className={`pinned-chrome${pinScrolled ? ' pinned-chrome--scrolled' : ''}`}
        style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                 padding: '16px 16px 8px', zIndex: Z_LAYERS.screenHeader }}
      >
        <BackButton onClick={onBack} />
        {/* SUBPAGE-TYPE-SCALE-01 — the documented screen-title role, from its owner. */}
        <div className="screen-header__title">
          Contact support
        </div>
      </div>

      <div style={{ padding: '8px 16px 40px', display: 'flex', flexDirection: 'column', gap: 'var(--space-5)', flex: 1 }}>
        {/* Intro + expectation-setting (the anxiety-killer line) */}
        <div style={{ background: 'var(--card)', boxShadow: 'var(--shadow-card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)', padding: '16px', display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '15px', color: 'var(--ink)', lineHeight: 1.55 }}>
            Something not working, or a question about your plan? Tell us.
          </div>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)', lineHeight: 1.55 }}>
            A real person reads this. Usually within two days.
          </div>
        </div>

        {/* Primary CTA — email */}
        <Button variant="primary" fullWidth
          onClick={handleEmail}>
          Email us
        </Button>

        {/* Fallback — copy address (covers no-mail-client case) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', lineHeight: 1.5 }}>
            No mail app set up? Copy the address and write to us from anywhere.
          </div>
          <div style={{ background: 'var(--card)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--line)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', gap: 'var(--space-3)' }}>
            <span style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--ink)', fontWeight: 500, userSelect: 'all', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {SUPPORT_EMAIL}
            </span>
            <button
              onClick={handleCopy}
              style={{ flexShrink: 0, padding: '5px 12px', borderRadius: '10px', border: `1px solid ${copied ? 'var(--moss)' : 'var(--line)'}`, background: copied ? 'var(--moss-soft)' : 'transparent', color: copied ? 'var(--moss)' : 'var(--mute)', fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'color 0.15s, background 0.15s, border-color 0.15s' }}
              aria-label="Copy support email address"
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Transparency — what gets attached (privacy honesty, brand stance) */}
        <div style={{ marginTop: 'auto', fontFamily: 'var(--font-ui)', fontSize: '11px', color: 'var(--mute)', lineHeight: 1.6 }}>
          We add your app version, platform, and account email to the message so we can help faster. You&apos;ll see it before you send. Delete it if you&apos;d rather not.
        </div>
      </div>
    </div>
  )
}
