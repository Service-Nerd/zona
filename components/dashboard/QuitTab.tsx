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

import type React from 'react'
import BackButton from '@/components/shared/BackButton'
import type { Zone } from '@/components/shared/ZoneBar'
import { MICRO_LABELS } from '@/components/shared/microLabels'
import type { Week } from '@/types/plan'

function BackHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: '16px 16px 12px' }}>
      <BackButton onClick={onBack} />
      <div style={{ fontSize: '18px', fontWeight: 500, color: 'var(--text-primary)', fontFamily: 'var(--font-brand)' }}>{title}</div>
    </div>
  )
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--card-bg)', border: '0.5px solid var(--border-col)', borderRadius: '12px', padding: '16px 18px', fontSize: '13px', lineHeight: 1.8, color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>
      {children}
    </div>
  )
}

export default function QuitTab({ quitDays, raceDistanceKm, onBack }: { quitDays: number | null; raceDistanceKm?: number; onBack: () => void }) {
  const days = quitDays ?? 0
  const milestones = [
    { days: 3,  label: 'Day 3 · Nicotine clearing' },
    { days: 7,  label: 'Week 1' },
    { days: 14, label: 'Day 14 · Habit breaking' },
    { days: 30, label: 'Day 30 · Lung function' },
    { days: 60, label: 'Day 60 · Aerobic gains' },
  ]
  const raceCtx = raceDistanceKm ? `a ${raceDistanceKm}km race` : 'your race'
  return (
    <div style={{ minHeight: '100%', background: 'var(--bg)' }}>
      <BackHeader title="Quit tracker" onBack={onBack} />
      <div style={{ padding: '0 12px', paddingBottom: 'var(--space-6)' }}>
        <div style={{ background: 'var(--card-bg)', border: '0.5px solid var(--teal-bg)', borderRadius: '16px', padding: '20px', display: 'flex', alignItems: 'center', gap: 'var(--space-5)', marginBottom: 'var(--space-3)' }}>
          <div style={{ fontFamily: 'var(--font-ui)', fontSize: '3.5rem', color: 'var(--teal)', lineHeight: 1, fontWeight: 500 }}>{days}</div>
          <div style={{ flex: 1 }}>
            <div style={{ ...MICRO_LABELS.sectionLabel, fontFamily: 'var(--font-ui)', color: 'var(--teal)', marginBottom: '4px' }}>Smoke-free days</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.55 }}>Your aerobic capacity is recovering. The data will show it.</div>
            <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', marginTop: 'var(--space-3)' }}>
              {milestones.map(m => (
                <div key={m.days} style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', padding: '3px 10px', borderRadius: '20px', border: `0.5px solid ${days >= m.days ? 'var(--teal-bg)' : 'var(--border-col)'}`, color: days >= m.days ? 'var(--teal)' : 'var(--text-secondary)' }}>
                  {m.label}
                </div>
              ))}
            </div>
          </div>
        </div>
        <InfoBox>
          <strong style={{ color: 'var(--text-secondary)' }}>What quitting does to your running:</strong><br /><br />
          <span style={{ color: 'var(--accent)' }}>48 hours</span>: CO leaves bloodstream. O₂ delivery improves immediately.<br />
          <span style={{ color: 'var(--accent)' }}>Week 1–2</span>: Resting HR starts dropping. Recovery improves noticeably.<br />
          <span style={{ color: 'var(--accent)' }}>Week 3–4</span>: Aerobic efficiency measurably better. Zone 2 feels easier.<br />
          <span style={{ color: 'var(--accent)' }}>Month 2+</span>: Cardiac drift reduces. That late-run HR creep? Less of it.<br /><br />
          <strong style={{ color: 'var(--text-secondary)' }}>Quitting while training for {raceCtx}. That's an upgrade.</strong>
        </InfoBox>
      </div>
    </div>
  )
}
