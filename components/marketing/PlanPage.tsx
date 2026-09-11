// GTM-SEO-PLANS-01 — shared renderer for every SEO plan page.
//
// Renders the engine's own FREE rule-based plan (UNMODIFIED output) as crawlable
// HTML, plus the SEO template: breadcrumbs, "who it's for" intro, FAQ block with
// FAQPage + BreadcrumbList JSON-LD, and internal links to sibling plans. Voice +
// Warm Slate tokens only (no hardcoded brand string / colour).

import Link from 'next/link'
import { BRAND } from '@/lib/brand'
import { SiteHeader } from '@/components/marketing/SiteHeader'
import { SiteFooter } from '@/components/marketing/SiteFooter'
import { WaitlistForm } from '@/components/marketing/WaitlistForm'
import { generateRulePlan } from '@/lib/plan/ruleEngine'
import { stepParts } from '@/lib/plan/resolveMainSet'
import { type MarketingPlan, planAnchor, faqsFor, getPlan, planCardTitle } from '@/lib/marketing/plans'
import type { Session, Week } from '@/types/plan'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.zonna.run'
const SECTION_MAX = 760

const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const DAY_LABEL: Record<string, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' }

const QUALITY_TYPES = new Set(['quality', 'intervals', 'tempo', 'hard'])
const isQualitySession = (s: Session) => QUALITY_TYPES.has(s.type)

/**
 * The hard session, as something a runner can actually follow.
 *
 * Previously this rendered `describeDerivedSet()` — one flat sentence — and
 * only when `derived_set` existed. Two problems, both measured across the nine
 * live pages (73 quality sessions):
 *
 *  1. A 13-step pyramid came out as 433 unbroken characters. Nobody reads that
 *     standing in a kitchen deciding whether to go out. Steps are now rows.
 *  2. 11 of 73 (15%) rendered NOTHING, because a 5K time trial has no
 *     catalogue row and so no derived set. Every one of those 11 already
 *     carried `coach_notes` — including "Warm up easy for 10 minutes, then
 *     5 km as hard as you can hold" — which this page simply never read.
 *     100% of quality sessions carry coach_notes; none were being shown.
 *
 * Grammar is NOT re-derived here — `stepParts()` in resolveMainSet.ts stays the
 * single owner of "jog" / "uphill" / "no faster than". This picks the layout.
 */
function MainSet({ s }: { s: Session }) {
  const set = s.derived_set
  const howTo = s.coach_notes?.[0]
  if (!set && !howTo) return null

  return (
    <div style={{
      marginTop: 7, padding: '10px 12px', background: 'var(--bg-soft)',
      borderRadius: 8, borderLeft: '2px solid var(--s-quality)',
    }}>
      {set && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {set.blocks.map((b, bi) => (
            <div key={bi} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
              {b.repeat > 1 && (
                <span style={{
                  flexShrink: 0, fontSize: 12.5, fontWeight: 800, paddingTop: 1,
                  color: 'var(--s-quality)', fontVariantNumeric: 'tabular-nums',
                }}>{b.repeat}&times;</span>
              )}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {b.steps.map((st, si) => {
                  const { action, target } = stepParts(st)
                  const isWork = st.role === 'work'
                  return (
                    <div key={si} style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: 13, fontWeight: isWork ? 600 : 400,
                        color: isWork ? 'var(--ink)' : 'var(--mute)',
                      }}>{action}</span>
                      {target && (
                        <span style={{ fontSize: 12.5, color: isWork ? 'var(--ink-2)' : 'var(--mute)' }}>
                          {target}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      {howTo && (
        <div style={{
          fontSize: 12.5, lineHeight: 1.5, color: 'var(--mute)',
          ...(set ? { marginTop: 9, paddingTop: 9, borderTop: '1px solid var(--line)' } : {}),
        }}>{howTo}</div>
      )}
    </div>
  )
}

function accentFor(s: Session): string {
  const label = (s.label ?? '').toLowerCase()
  if (s.role === 'long_run' || label.includes('long run')) return 'var(--s-long)'
  switch (s.type) {
    case 'long': return 'var(--s-long)'
    case 'intervals':
    case 'hard': return 'var(--s-inter)'
    case 'quality':
    case 'tempo': return 'var(--s-quality)'
    case 'race': return 'var(--s-race)'
    case 'recovery': return 'var(--s-recov)'
    case 'strength': return 'var(--s-strength)'
    case 'cross-train': return 'var(--s-cross)'
    case 'rest': return 'transparent'
    default: return 'var(--s-easy)'
  }
}

const PHASE_META: Record<string, { label: string; note: string }> = {
  base: { label: 'Base', note: 'All easy. Building the engine — no hard running yet, and that is the point.' },
  build: { label: 'Build', note: 'Quality arrives. One hard session a week; the rest stays genuinely easy.' },
  peak: { label: 'Peak', note: 'The sharpest weeks. Hold the zone on the hard days, protect the easy ones.' },
  taper: { label: 'Taper', note: 'Less volume, same intensity. Arrive fresh, not flat.' },
  foundation: { label: 'Foundation', note: 'Settling in before the plan proper begins.' },
  maintenance_base: { label: 'Base', note: 'Steady aerobic work.' },
  maintenance_restoration: { label: 'Recovery', note: 'Backing off on purpose.' },
}

const phaseKey = (w: Week): string => w.phase ?? 'base'

export function PlanPage({ plan }: { plan: MarketingPlan }) {
  const { planStart, raceDate } = planAnchor(plan.dayOffset)
  const generated = generateRulePlan(plan.input(raceDate), 'free', planStart)
  const weeks = generated.weeks.filter(w => w.n >= 1)
  const faqs = faqsFor(plan)
  const planUrl = `${APP_URL}/plans/${plan.slug}`
  const related = plan.related.map(getPlan).filter((p): p is MarketingPlan => !!p)

  // Group consecutive weeks by phase.
  const groups: { key: string; weeks: Week[] }[] = []
  for (const w of weeks) {
    const k = phaseKey(w)
    const last = groups[groups.length - 1]
    if (last && last.key === k) last.weeks.push(w)
    else groups.push({ key: k, weeks: [w] })
  }

  const ld = [
    {
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: faqs.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    },
    {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: APP_URL },
        { '@type': 'ListItem', position: 2, name: 'Plans', item: `${APP_URL}/plans` },
        { '@type': 'ListItem', position: 3, name: `${plan.distanceLabel} · ${plan.weeks}-week`, item: planUrl },
      ],
    },
  ]

  return (
    <main style={{ background: 'var(--bg)', color: 'var(--ink)', minHeight: '100vh', fontFamily: 'var(--font-ui)' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />

      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      <SiteHeader current="plans" />

      {/* ── Breadcrumbs ─────────────────────────────────────────────────── */}
      <nav aria-label="Breadcrumb" style={{ maxWidth: SECTION_MAX, margin: '0 auto', padding: '0 24px' }}>
        <ol style={{ display: 'flex', gap: 8, listStyle: 'none', padding: 0, margin: 0, fontSize: 13, color: 'var(--mute)', flexWrap: 'wrap' }}>
          <li><Link href="/" style={{ color: 'var(--mute)', textDecoration: 'none' }}>Home</Link></li>
          <li aria-hidden>›</li>
          <li><Link href="/plans" style={{ color: 'var(--mute)', textDecoration: 'none' }}>Plans</Link></li>
          <li aria-hidden>›</li>
          <li style={{ color: 'var(--ink-2)' }}>{plan.distanceLabel} · {plan.weeks}-week</li>
        </ol>
      </nav>

      {/* ── Hero: the diagnosis ─────────────────────────────────────────── */}
      <section style={{ maxWidth: SECTION_MAX, margin: '0 auto', padding: '24px 24px 8px' }}>
        <p style={{ fontFamily: 'var(--font-brand)', fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--moss)', margin: '0 0 16px' }}>
          You&rsquo;re trying hard. That&rsquo;s the problem.
        </p>
        <h1 style={{ fontFamily: 'var(--font-brand)', fontSize: 'clamp(28px, 5.5vw, 44px)', fontWeight: 800, lineHeight: 1.08, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 18px' }}>
          {plan.h1}
        </h1>
        <p style={{ fontSize: 18, lineHeight: 1.55, color: 'var(--ink-2)', margin: '0 0 22px', maxWidth: 600 }}>{plan.heroSub}</p>

        <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', marginTop: 4 }}>
          {[
            { v: String(plan.weeks), l: 'weeks' },
            { v: String(plan.daysPerWeek), l: 'days / week' },
            { v: 'Every run', l: 'zoned' },
          ].map(({ v, l }) => (
            <div key={l}>
              <div style={{ fontFamily: 'var(--font-brand)', fontSize: 26, fontWeight: 800, color: 'var(--ink)', lineHeight: 1 }}>{v}</div>
              <div style={{ fontSize: 13, color: 'var(--mute)', marginTop: 4 }}>{l}</div>
            </div>
          ))}
        </div>

        <p style={{ fontSize: 15, lineHeight: 1.55, color: 'var(--ink-2)', margin: '22px 0 0', maxWidth: 620 }}>{plan.whoFor}</p>
      </section>

      {/* ── The zone idea (differentiator, on the page) ─────────────────── */}
      <section style={{ maxWidth: SECTION_MAX, margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, padding: '24px 22px' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', margin: '0 0 10px' }}>Why so much easy?</h2>
          <p style={{ fontSize: 15.5, lineHeight: 1.6, color: 'var(--ink-2)', margin: 0 }}>
            You can&rsquo;t outrun your easy days. Run easy when it&rsquo;s easy so you can run hard
            when it&rsquo;s hard. Going medium-hard on everything &mdash; the grey middle &mdash; is
            where amateur runners stall and where injuries come from. This plan puts a ceiling on
            your easy runs and saves the effort for the one day a week that earns it.
          </p>
        </div>
      </section>

      {/* ── The plan, week by week ──────────────────────────────────────── */}
      <section style={{ maxWidth: SECTION_MAX, margin: '0 auto', padding: '4px 24px 8px' }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', margin: '0 0 4px', letterSpacing: '-0.01em' }}>The plan, week by week</h2>
        <p style={{ fontSize: 14, color: 'var(--mute)', margin: '0 0 20px' }}>Free. Take it exactly as it is.</p>

        {groups.map((g, gi) => {
          const meta = PHASE_META[g.key] ?? { label: g.key, note: '' }
          return (
            <div key={gi} style={{ marginBottom: 28 }}>
              <div style={{ marginBottom: 12 }}>
                <h3 style={{ fontFamily: 'var(--font-brand)', fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--moss)', margin: 0 }}>{meta.label}</h3>
                {meta.note && <p style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--ink-2)', margin: '4px 0 0' }}>{meta.note}</p>}
              </div>

              {g.weeks.map(w => {
                const isDeload = w.type === 'deload' || w.badge === 'deload'
                const isRaceWeek = w.type === 'race' || w.badge === 'race'
                const daySessions = DAY_ORDER
                  .map(d => ({ d: d as string, s: w.sessions[d] }))
                  .filter(x => x.s != null) as { d: string; s: Session }[]
                return (
                  <div key={w.n} style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: '16px 18px', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                      <div>
                        <span style={{ fontFamily: 'var(--font-brand)', fontSize: 16, fontWeight: 800, color: 'var(--ink)' }}>Week {w.n}</span>
                        {isDeload && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: 'var(--s-recov)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Recovery</span>}
                        {isRaceWeek && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, color: 'var(--s-race)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Race week</span>}
                        <span style={{ display: 'block', fontSize: 13, color: 'var(--mute)', marginTop: 2 }}>{w.label}</span>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <span style={{ fontFamily: 'var(--font-brand)', fontSize: 18, fontWeight: 800, color: 'var(--ink)' }}>{w.weekly_km}</span>
                        <span style={{ fontSize: 12, color: 'var(--mute)', marginLeft: 3 }}>km</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {daySessions.map(({ d, s }) => (
                        <div key={d} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                          <span style={{ width: 3, alignSelf: 'stretch', minHeight: 34, borderRadius: 2, background: accentFor(s), flexShrink: 0 }} aria-hidden />
                          <span style={{ width: 34, flexShrink: 0, fontSize: 13, fontWeight: 600, color: 'var(--mute)', paddingTop: 1 }}>{DAY_LABEL[d]}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--ink)' }}>{s.label}</span>
                              {s.zone && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-2)', background: 'var(--bg-soft)', padding: '2px 7px', borderRadius: 999, letterSpacing: '0.02em' }}>{s.zone}</span>}
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--mute)', marginTop: 2 }}>
                              {[s.distance_km ? `${s.distance_km} km` : null, s.duration_mins ? `${s.duration_mins} min` : null, s.pace_target || null].filter(Boolean).join('  ·  ')}
                            </div>
                            {isQualitySession(s) && <MainSet s={s} />}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </section>

      {/* ── The honesty section ─────────────────────────────────────────── */}
      <section style={{ maxWidth: SECTION_MAX, margin: '0 auto', padding: '20px 24px 8px' }}>
        <div style={{ borderLeft: '3px solid var(--moss)', paddingLeft: 18, margin: '8px 0' }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', margin: '0 0 12px', letterSpacing: '-0.01em' }}>This is the flat version.</h2>
          <p style={{ fontSize: 16, lineHeight: 1.6, color: 'var(--ink-2)', margin: '0 0 12px', maxWidth: 620 }}>
            This plan doesn&rsquo;t know you. It doesn&rsquo;t know your Tuesday got busy, what your
            resting heart rate is doing, or that your last race said you&rsquo;re fitter than you think.
          </p>
          <p style={{ fontSize: 16, lineHeight: 1.6, color: 'var(--ink-2)', margin: 0, maxWidth: 620 }}>
            The app does. It sets your real heart-rate zones, moves sessions when life breaks the
            week, and rebuilds the plan off a mid-block time trial. This page is the template.
            The app is the coach.
          </p>
        </div>
      </section>

      {/* ── Soft CTA (email → adaptive version; NOT a wall) ─────────────── */}
      <section style={{ maxWidth: SECTION_MAX, margin: '0 auto', padding: '28px 24px 8px' }}>
        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, padding: '26px 22px' }}>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--ink)', margin: '0 0 6px' }}>The plan above is yours. No catch.</h2>
          <p style={{ fontSize: 15, lineHeight: 1.55, color: 'var(--ink-2)', margin: '0 0 18px', maxWidth: 520 }}>
            Want the version that adapts to you &mdash; your zones, your week, your race? Leave your
            email and we&rsquo;ll tell you when to start.
          </p>
          <WaitlistForm />
          <p style={{ fontSize: 13.5, color: 'var(--mute)', margin: '16px 0 0' }}>
            Already sold? <a href={BRAND.appStore.url} style={{ color: 'var(--moss)', fontWeight: 600, textDecoration: 'none' }}>Start free in the app →</a>
          </p>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────── */}
      <section style={{ maxWidth: SECTION_MAX, margin: '0 auto', padding: '28px 24px 8px' }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--ink)', margin: '0 0 16px', letterSpacing: '-0.01em' }}>Questions</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {faqs.map((f, i) => (
            <div key={i} style={{ padding: '14px 0', borderTop: i === 0 ? 'none' : '1px solid var(--line)' }}>
              <h3 style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--ink)', margin: '0 0 6px' }}>{f.q}</h3>
              <p style={{ fontSize: 14.5, lineHeight: 1.55, color: 'var(--ink-2)', margin: 0, maxWidth: 640 }}>{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Related plans (internal links) ──────────────────────────────── */}
      {related.length > 0 && (
        <section style={{ maxWidth: SECTION_MAX, margin: '0 auto', padding: '28px 24px 8px' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--ink)', margin: '0 0 14px' }}>Other free plans</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {related.map(r => (
              <Link key={r.slug} href={`/plans/${r.slug}`} style={{ textDecoration: 'none' }}>
                <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--ink)' }}>{planCardTitle(r)}</span>
                  <span style={{ fontSize: 15, color: 'var(--moss)' }} aria-hidden>→</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <SiteFooter />
    </main>
  )
}
