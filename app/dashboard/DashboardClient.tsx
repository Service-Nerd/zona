'use client'

import { useState, useEffect } from 'react'
import type { Plan, Week } from '@/types/plan'
import PlanGrid from '@/components/training/PlanGrid'
import PlanChart from '@/components/training/PlanChart'
import WeekBriefing from '@/components/training/WeekBriefing'
import StravaPanel from '@/components/strava/StravaPanel'

interface Props { plan: Plan; currentWeek: Week }

type Tab = 'briefing' | 'plan' | 'mental' | 'fueling' | 'quit' | 'strava'

const TABS: { id: Tab; label: string }[] = [
  { id: 'briefing', label: 'This Week' },
  { id: 'plan',     label: 'Full Plan' },
  { id: 'mental',   label: 'Mental Toolkit' },
  { id: 'fueling',  label: 'Fueling' },
  { id: 'quit',     label: 'Quit Tracker' },
  { id: 'strava',   label: '⚡ Strava' },
]

const QUIT_DATE = new Date('2026-04-03T00:00:00')

export default function DashboardClient({ plan, currentWeek }: Props) {
  const [tab, setTab]           = useState<Tab>('briefing')
  const [quitDays, setQuitDays] = useState(1)
  const [resetPhrase, setResetPhrase] = useState('')

  useEffect(() => {
    const days = Math.max(1, Math.floor((Date.now() - QUIT_DATE.getTime()) / 86400000))
    setQuitDays(days)
    try {
      const p = localStorage.getItem('rts_phrase'); if (p) setResetPhrase(p)
    } catch {}
  }, [])

  function saveMental(val: string) {
    setResetPhrase(val)
    try { localStorage.setItem('rts_phrase', val) } catch {}
  }

  const longestRunKm = Math.max(...plan.weeks.map(w => w.weekly_km ?? 0).filter(Boolean))

  return (
    <>
      {/* Race banner */}
      <div style={{ background: 'linear-gradient(135deg,#1a0800,#0f0f0f)', border: '1px solid var(--orange)', borderLeft: '4px solid var(--orange)', borderRadius: '6px', padding: '16px 22px', marginBottom: '22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '1.6rem', color: 'var(--orange)', letterSpacing: '0.05em' }}>Race to the Stones</div>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.66rem', color: 'var(--text-dim)', marginTop: '2px', letterSpacing: '0.06em' }}>
            Saturday 11 July 2026 &nbsp;·&nbsp; The Ridgeway &nbsp;·&nbsp; Make-A-Wish UK &nbsp;·&nbsp; {plan.meta.athlete}
          </div>
        </div>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '2.6rem', color: 'var(--orange)', lineHeight: 1, textAlign: 'right' }}>
          100<span style={{ display: 'block', fontSize: '0.62rem', fontFamily: "'DM Mono',monospace", color: 'var(--text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>kilometres</span>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: '8px', marginBottom: '22px' }}>
        {[
          { value: '50k',    label: 'Longest Race',      sub: 'May 2025 · 7 hours' },
          { value: `${plan.weeks.find(w => w.type === 'current')?.weekly_km ?? '—'}k`, label: 'Weekly km Target', sub: 'Current week' },
          { value: '3:40',   label: 'Longest Long Run',  sub: 'Zone 2 · Canal towpath' },
          { value: String(quitDays), label: 'Smoke-Free Days', sub: 'Engine upgrading ↑', green: true },
          { value: String(plan.meta.resting_hr), label: 'Resting HR', sub: `Max ~${plan.meta.max_hr} bpm` },
        ].map(({ value, label, sub, green }) => (
          <div key={label} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderTop: '2px solid var(--orange)', borderRadius: '6px', padding: '12px 14px' }}>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '1.9rem', color: 'var(--orange)', lineHeight: 1 }}>{value}</div>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.6rem', color: 'var(--text-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: '3px' }}>{label}</div>
            <div style={{ fontSize: '0.7rem', color: green ? 'var(--green)' : 'var(--muted)', marginTop: '2px' }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '2px', borderBottom: '1px solid var(--border)', marginBottom: '20px', flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.68rem', letterSpacing: '0.1em', textTransform: 'uppercase', padding: '10px 16px', cursor: 'pointer', color: tab === t.id ? 'var(--orange)' : 'var(--text-dim)', border: 'none', borderBottom: `2px solid ${tab === t.id ? 'var(--orange)' : 'transparent'}`, marginBottom: '-1px', background: 'none', transition: 'all 0.2s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'briefing' && <WeekBriefing week={currentWeek} />}

      {tab === 'plan' && (
        <>
          <PlanChart weeks={plan.weeks} />
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.63rem', color: 'var(--text-dim)', marginBottom: '12px', letterSpacing: '0.06em', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
            <span>MIDWEEK: 2× quality/easy Zone 2 &nbsp;·&nbsp; STRENGTH: Upper Mon / Lower Wed &nbsp;·&nbsp; SAT: back-to-back where noted</span>
            <span style={{ color: 'var(--muted)', fontSize: '0.58rem' }}>v{plan.meta.version} · {plan.meta.last_updated}</span>
          </div>
          <PlanGrid weeks={plan.weeks} />
        </>
      )}

      {tab === 'mental' && <MentalTab resetPhrase={resetPhrase} onSave={saveMental} />}
      {tab === 'fueling' && <FuelingTab />}
      {tab === 'quit' && <QuitTab quitDays={quitDays} />}
      {tab === 'strava' && <StravaPanel />}
    </>
  )
}

// ── Inline tab components ─────────────────────────────────────────────────

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '6px', padding: '16px 18px', fontSize: '0.84rem', lineHeight: 1.75, color: 'var(--text-dim)', marginBottom: '16px' }}>
      {children}
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '1.15rem', letterSpacing: '0.07em', color: 'var(--text)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
      {children}
      <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
    </div>
  )
}

function MentalTab({ resetPhrase, onSave }: { resetPhrase: string; onSave: (v: string) => void }) {
  const tools = [
    { icon: '🧱', title: 'The Box', text: "Don't think about 100km. Next checkpoint only. That's your entire world. Everything outside the box doesn't exist yet. Shrink it right down and stay in it." },
    { icon: '🔁', title: 'The Reset Phrase', text: 'Pick one phrase now, before race day. Short. Yours. Not borrowed from a poster. Use it the moment the voice starts. Write it below — then use it on long runs so it\'s automatic by July.' },
    { icon: '📉', title: 'Feeling ≠ Fact', text: '"I can\'t do this" is a feeling. Not information. Your legs are still moving — that\'s information. The feeling will pass in 10–15 minutes if you stay controlled. It always does.' },
    { icon: '🍬', title: 'The Fuel Check', text: '80% of dark patches are underfueling in a trench coat. Before you spiral mentally, eat something. Wait 8 minutes. Most "crises" at hour 10 are 200 calories away from being fine.' },
    { icon: '🤝', title: 'The Why Card', text: "Make-A-Wish. Write it on your hand if you have to. When you want to stop, think about why you started. Not your ego. Not your time. The kids. That one doesn't move when everything else does." },
    { icon: '🚶', title: 'Walk = Strategy', text: 'The elites walk the uphills at RTTS. Walking a climb at km 72 is a tactic, not a failure. Give yourself permission now, before you need it.' },
  ]
  return (
    <>
      <InfoBox>
        The dark patch is coming. Probably around <span style={{ color: 'var(--orange)' }}>km 65–75</span>. It's not a sign you're broken — it's a sign you've been going long enough to feel something real. You already know it's coming. Which means we can prepare for it.
      </InfoBox>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '10px', marginBottom: '20px' }}>
        {tools.map(t => (
          <div key={t.title} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderTop: '2px solid var(--grey)', borderRadius: '6px', padding: '16px' }}>
            <div style={{ fontSize: '1.3rem', marginBottom: '7px' }}>{t.icon}</div>
            <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '1rem', letterSpacing: '0.05em', color: 'var(--orange)', marginBottom: '5px' }}>{t.title}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', lineHeight: 1.65 }}>{t.text}</div>
          </div>
        ))}
      </div>
      <div style={{ background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '14px' }}>
        <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.62rem', color: 'var(--orange)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>Your Reset Phrase</div>
        <textarea value={resetPhrase} onChange={e => onSave(e.target.value)} placeholder="What's the phrase you'll use when it gets dark at km 70? Make it yours." style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--text)', fontFamily: "'DM Sans',sans-serif", fontSize: '0.84rem', lineHeight: 1.7, resize: 'vertical', minHeight: '60px', outline: 'none' }} />
      </div>
    </>
  )
}

function FuelingTab() {
  const protocol = [
    { timing: 'Pre-run · 90 min before', what: 'Porridge + banana + coffee', why: "Slow carbs, familiar, not ambitious. Don't experiment on race morning. Ever." },
    { timing: '0–60 minutes',            what: 'Water only',                  why: "Glycogen tanks are full. Let your body warm up before loading it with fuel." },
    { timing: 'Every 45 min after',      what: '1 gel OR real food',           why: '~60g carbs/hr target. Alternate gel + real food to avoid sweet fatigue.' },
    { timing: 'Every 20–30 min',         what: 'Small sips — water or electrolyte', why: "Don't wait for thirst. By then you're already behind." },
    { timing: 'Hour 3+',                 what: 'Salty real food',              why: 'Pretzels, salted nuts, cheese. Sweet fatigue is real. Salt craving = your body talking.' },
    { timing: 'Aid stations · race day', what: 'Eat at every single one',       why: "You'll never regret eating at a checkpoint. You will regret skipping one at km 80." },
  ]
  return (
    <>
      <InfoBox>
        Real food + gels is the right call. The goal now is <span style={{ color: 'var(--orange)' }}>stress-testing your gut before June</span> so there are zero surprises on race day.
      </InfoBox>
      <SectionTitle>Long Run Protocol</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '10px', marginBottom: '18px' }}>
        {protocol.map(p => (
          <div key={p.timing} style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: '6px', padding: '14px' }}>
            <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.62rem', color: 'var(--orange)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '5px' }}>{p.timing}</div>
            <div style={{ fontSize: '0.88rem', fontWeight: 500, marginBottom: '4px', color: 'var(--white)' }}>{p.what}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', lineHeight: 1.55 }}>{p.why}</div>
          </div>
        ))}
      </div>
      <InfoBox>
        <strong style={{ color: 'var(--text)' }}>Must be confirmed before June:</strong><br /><br />
        · Your preferred gel brand + flavour (test at least 3 options)<br />
        · Your real food combo — dates? banana? something savoury?<br />
        · Electrolyte drink vs plain water<br />
        · Eating on the move vs brief stops<br /><br />
        <span style={{ color: 'var(--red)', fontWeight: 500 }}>Hard rule: nothing new on race day. Not one single thing.</span>
      </InfoBox>
    </>
  )
}

function QuitTab({ quitDays }: { quitDays: number }) {
  const milestones = [
    { days: 3,  label: 'Day 3 — Nicotine clearing' },
    { days: 7,  label: 'Week 1 🎉' },
    { days: 14, label: 'Day 14 — Habit breaking' },
    { days: 30, label: 'Day 30 — Lung function improving' },
    { days: 99, label: 'Race Day — Job done' },
  ]
  return (
    <>
      <div style={{ background: 'var(--card)', border: '1px solid var(--green)', borderLeft: '3px solid var(--green)', borderRadius: '6px', padding: '20px 22px', display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <div style={{ fontFamily: "'Bebas Neue',sans-serif", fontSize: '3.5rem', color: 'var(--green)', lineHeight: 1 }}>{quitDays}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.62rem', color: 'var(--green)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '4px' }}>🚭 Smoke-Free — Day Counter</div>
          <div style={{ fontSize: '0.83rem', color: 'var(--text-dim)', lineHeight: 1.55 }}>Started: 3 April 2026. Your aerobic efficiency is already quietly improving.</div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
            {milestones.map(m => (
              <div key={m.days} style={{ fontFamily: "'DM Mono',monospace", fontSize: '0.58rem', padding: '3px 10px', borderRadius: '20px', border: `1px solid ${quitDays >= m.days ? 'var(--green)' : 'var(--border)'}`, color: quitDays >= m.days ? 'var(--green)' : 'var(--muted)', background: quitDays >= m.days ? 'rgba(57,217,138,0.08)' : 'transparent' }}>
                {m.label}
              </div>
            ))}
          </div>
        </div>
      </div>
      <InfoBox>
        <strong style={{ color: 'var(--text)' }}>What quitting does to your running:</strong><br /><br />
        <span style={{ color: 'var(--orange)' }}>48 hours</span> — CO leaves bloodstream. O₂ delivery improves immediately.<br />
        <span style={{ color: 'var(--orange)' }}>Week 1–2</span> — Resting HR starts dropping. Recovery improves noticeably.<br />
        <span style={{ color: 'var(--orange)' }}>Week 3–4</span> — Aerobic efficiency measurably better. Zone 2 feels easier.<br />
        <span style={{ color: 'var(--orange)' }}>Month 2+</span> — Cardiac drift on long runs reduces. That late-run HR creep? Less of it.<br /><br />
        <strong style={{ color: 'var(--text)' }}>You quit 99 days before a 100km race. That's not a coincidence. That's an upgrade.</strong>
      </InfoBox>
    </>
  )
}
