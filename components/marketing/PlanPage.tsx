// GTM-SEO-PLANS-01 — shared renderer for every SEO plan page.
//
// Renders the engine's own FREE rule-based plan (UNMODIFIED output) as crawlable
// HTML, plus the SEO template: breadcrumbs, "who it's for" intro, FAQ block with
// FAQPage + BreadcrumbList JSON-LD, and internal links to sibling plans. Voice +
// Warm Slate tokens only (no hardcoded brand string / colour).

import { isHardEffort } from '@/lib/plan/sessionRole'
import Link from 'next/link'
import { Section } from '@/components/marketing/Section'
import { BRAND } from '@/lib/brand'
import { SiteHeader } from '@/components/marketing/SiteHeader'
import { SiteFooter } from '@/components/marketing/SiteFooter'
import { AppStoreBadge } from '@/components/marketing/AppStoreBadge'
import { generateRulePlan } from '@/lib/plan/ruleEngine'
import SessionSteps from '@/components/shared/SessionSteps'
import { stepParts, type DerivedSet } from '@/lib/plan/resolveMainSet'
import { composeSession } from '@/lib/plan/sessionComposer'
import { catalogueRowFor } from '@/lib/plan/catalogueLink'
import { displayDerivedSet } from '@/lib/plan/runWalkPlan'
import { displayZonesForSession } from '@/components/dashboard/dashboardHelpers'
import { getSessionColor, getSessionLabel } from '@/lib/session-types'
import { type MarketingPlan, planAnchor, faqsFor, getPlan, planCardTitle } from '@/lib/marketing/plans'
import { PHASE_LABEL, phaseNote } from '@/lib/marketing/planNotes'
import type { Session, Week } from '@/types/plan'
import { weekVolumeLabel } from '@/lib/plan/weekVolume'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.zonna.run'

const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const DAY_LABEL: Record<string, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' }

const isQualitySession = (s: Session) => isHardEffort(s)

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
      marginTop: 7, padding: 'var(--space-3) var(--space-3)', background: 'var(--bg-soft)',
      borderRadius: 8, borderLeft: '2px solid var(--s-quality)',
    }}>
      {set && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {set.blocks.map((b, bi) => (
            <div key={bi} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
              {b.repeat > 1 && (
                <span style={{
                  flexShrink: 0, fontSize: 'var(--fs-caption)', fontWeight: 800, paddingTop: 1,
                  color: 'var(--warn-strong)', fontVariantNumeric: 'tabular-nums',
                }}>{b.repeat}&times;</span>
              )}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                {b.steps.map((st, si) => {
                  const { action, target } = stepParts(st)
                  const isWork = st.role === 'work'
                  return (
                    <div key={si} style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: 'var(--fs-sm)', fontWeight: isWork ? 600 : 400,
                        color: isWork ? 'var(--ink)' : 'var(--mute)',
                      }}>{action}</span>
                      {/* COPY-REPTEXT-01 — a real space, not just the flex gap.
                          `gap: 8` separates these visually and NOTHING separates
                          them in the text, so `textContent` read
                          "1600 mat 4:25-4:35 /km", and the next step ran on as
                          "/kmjog 1:30at no faster than". That is what a copy-paste
                          produces, what a text extractor indexes, and what some
                          screen-reader modes announce. One character, no visual
                          change: the gap still owns the spacing. */}
                      {target && (' ')}
                      {target && (
                        <span style={{ fontSize: 'var(--fs-caption)', color: isWork ? 'var(--ink-2)' : 'var(--mute)' }}>
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
          fontSize: 'var(--fs-caption)', lineHeight: 1.5, color: 'var(--mute)',
          ...(set ? { marginTop: 9, paddingTop: 9, borderTop: '1px solid var(--line)' } : {}),
        }}>{howTo}</div>
      )}
    </div>
  )
}

/**
 * SITE-SESSION-STEPS-01 (Design Board, 2026-11-05) — the plan pages show the
 * session structure the APP shows, because it is the same component.
 *
 * 🔴 WHAT WAS HERE. A local `MainSet`: one `--bg-soft` inset, a 2px rail, and
 * rows of action-then-target. It took its grammar from the real `stepParts()`,
 * so the WORDS could not drift — and the SHAPE already had. The app moved to
 * per-phase cards with numbered steps on a connector line, a silhouette, a zone
 * range and block totals (SESSION-STRUCTURE-REDESIGN, then
 * SESSION-STEP-LEGIBILITY-01 and SESSION-STEP-SLOTS-01). This page kept the
 * September drawing.
 *
 * 🎓 Sierra's reason, which is the whole ruling: *"nine complete plans, free, no
 * signup, and the structure a reader meets is one grey inset with
 * action-then-target rows. The app teaches a runner to READ a session. That is
 * perceptual expertise we have built and are not transferring, on the surface
 * we give away."*
 *
 * ⚠️ `realComponents.test.ts` governed the HOMEPAGE only, which is why this
 * drifted under 47 green marketing gates. It covers this file now.
 *
 * ⚠️ NO CLIENT COST. `SessionSteps` and everything it composes are server
 * components with zero hooks, and a plan page is a `revalidate` server page. The
 * `onInfo` prop is deliberately omitted: it opens the zone sheet in the app, and
 * a static page has no sheet to open. The component already treats it as
 * optional, so the ⓘ simply does not render.
 */
function SessionStructureBlock({ s }: { s: Session }) {
  const structure = composeSession({ session: s, catalogueRow: catalogueRowFor(s) })
  if (!structure) return null
  const dz = displayZonesForSession(s)
  return (
    <div style={{ marginTop: 'var(--space-3)' }}>
      <SessionSteps
        structure={structure}
        derivedSet={(displayDerivedSet(s, structure) as DerivedSet | null) ?? null}
        sessionType={s.type}
        displayZones={dz?.zones ?? []}
        zoneRangeLabel={dz?.rangeLabel ?? structure.main.zone}
        /* The session's own anchor, not a reader preference: this page has no
           signed-in runner. A beginner plan is duration-anchored and a
           distance-anchored session carries km (SESSION-KM-01). */
        metric={s.distance_km != null ? 'distance' : 'duration'}
        preferredUnits="km"
        sessionDistanceKm={s.distance_km ?? null}
        catalogueId={(s as { catalogue_id?: string }).catalogue_id}
        silhouetteColour={getSessionColor(s)}
      />
    </div>
  )
}


/**
 * The ONE session whose full structure the page shows.
 *
 * 🧭 SITE-SESSION-STEPS-01, amended on rendered evidence (Design Board,
 * re-sat 2026-11-05). The first ruling said "mount `SessionSteps` on
 * /plans/[slug]" and the sitting that made it had rendered nothing. Built as
 * ruled and measured on `/plans/sub-4-hour-marathon-plan`:
 *
 *   desktop 1440 ..... 11.9 screens -> 19.9   (+67%)
 *   phone 375 ........ 15.7 screens -> 26.0   (+66%)
 *   one structure block, phone ......... 629px
 *   the day row it hangs off ............ 44px
 *
 * A session's structure card came out **14x the row it belongs to** and nearly
 * a full phone screen, thirteen times over, inside a document whose job is
 * "read the whole plan". 🎓 Sierra, withdrawing her own prescription: *"the
 * transfer happens on the FIRST one. A reader who studies one session structure
 * has the skill; the twelfth teaches nothing and costs ten screens."*
 * ✋ Silvanto: *"the structure deserves a moment; thirteen moments is no moment."*
 *
 * So: once, in its own band, before the week table — teach the reading, then
 * hand over the plan. The week table keeps `MainSet`, the compact treatment.
 *
 * ⚠️ DETERMINISTIC, because a plan page is statically generated and must not
 * differ between builds: the FIRST quality session carrying a resolved v2 set
 * (ADR-019).
 *
 * ⚠️ MEASURED ACROSS ALL NINE PUBLISHED PLANS RATHER THAN ASSUMED, because the
 * first version of this comment claimed the exemplar is always the first
 * quality session a reader meets and that is TRUE FOR 5 OF 9. In the other four
 * the first quality session is the **5K time trial**, which has no v2 set
 * because it has no reps to show — one continuous maximal effort
 * (SESSION-COLOUR-TT-01). Skipping it is the right behaviour and not a
 * coincidence: a structure card for a session with no structure teaches
 * nothing. Returns null when a plan has no v2 session at all, and the band does
 * not render.
 */
function exemplarSession(weeks: Week[]): { s: Session; weekN: number } | null {
  for (const w of weeks) {
    for (const d of DAY_ORDER) {
      const s = w.sessions[d]
      if (s && isQualitySession(s) && s.derived_set) return { s, weekN: w.n }
    }
  }
  return null
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

  const exemplar = exemplarSession(weeks)

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
      <nav aria-label="Breadcrumb" style={{ maxWidth: 'var(--measure-page)', margin: '0 auto', padding: '0 24px' }}>
        <ol style={{ display: 'flex', gap: 8, listStyle: 'none', padding: 0, margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--mute)', flexWrap: 'wrap' }}>
          <li><Link href="/" style={{ color: 'var(--mute)', textDecoration: 'none' }}>Home</Link></li>
          <li aria-hidden>›</li>
          <li><Link href="/plans" style={{ color: 'var(--mute)', textDecoration: 'none' }}>Plans</Link></li>
          <li aria-hidden>›</li>
          <li style={{ color: 'var(--ink-2)' }}>{plan.distanceLabel} · {plan.weeks}-week</li>
        </ol>
      </nav>

      {/* ── Hero: the diagnosis ─────────────────────────────────────────── */}
      {/* SITE-WAVE-1a-ii — adopted the shared Section 2026-09-22 (Design Board
          sitting one). ZERO VISUAL DELTA is this wave's contract: width="full"
          + rhythm="none" hand the inner div exactly the maxWidth, margin and
          padding the raw element had, and the outer band declares the `--bg`
          it already inherited from <main>.
          The win is that `surface=` now EXISTS on this page, so wave 1b can
          spend a ground here. It could not before.
          FOR WAVE 1B: the rhythm below is preserved, not endorsed. */}
      <Section width="read" rhythm="none"
        innerStyle={{ padding: '24px 24px 8px' }}>
        <p style={{ fontFamily: 'var(--font-brand)', fontSize: 'var(--fs-sm)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--moss-strong)', margin: '0 0 16px' }}>
          You&rsquo;re trying hard. That&rsquo;s the problem.
        </p>
        <h1 style={{ fontFamily: 'var(--font-brand)', fontSize: 'var(--fs-h1)', fontWeight: 800, lineHeight: 1.08, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 var(--space-4)' }}>
          {plan.h1}
        </h1>
        <p style={{ fontSize: 'var(--fs-lead-lg)', lineHeight: 1.55, color: 'var(--ink-2)', margin: '0 0 var(--space-5)', maxWidth: 600 }}>{plan.heroSub}</p>

        <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', marginTop: 4 }}>
          {[
            { v: String(plan.weeks), l: 'weeks' },
            { v: String(plan.daysPerWeek), l: 'days / week' },
            { v: 'Every run', l: 'zoned' },
          ].map(({ v, l }) => (
            <div key={l}>
              <div style={{ fontFamily: 'var(--font-brand)', fontSize: 'var(--fs-metric)', fontWeight: 800, color: 'var(--ink)', lineHeight: 1 }}>{v}</div>
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--mute)', marginTop: 4 }}>{l}</div>
            </div>
          ))}
        </div>

        <p style={{ fontSize: 'var(--fs-body-lg)', lineHeight: 1.55, color: 'var(--ink-2)', margin: 'var(--space-5) 0 0', maxWidth: 620 }}>{plan.whoFor}</p>
      </Section>

      {/* ── The zone idea (differentiator, on the page) ─────────────────── */}
      <Section width="read" rhythm="none"
        innerStyle={{ padding: '32px 24px' }}>
        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, padding: 'var(--space-5) var(--space-5)' }}>
          <h2 style={{ fontSize: 'var(--fs-lead-lg)', fontWeight: 700, color: 'var(--ink)', margin: '0 0 var(--space-3)' }}>Why so much easy?</h2>
          <p style={{ fontSize: 'var(--fs-body-lg)', lineHeight: 1.6, color: 'var(--ink-2)', margin: 0 }}>
            You can&rsquo;t outrun your easy days. Run easy when it&rsquo;s easy so you can run hard
            when it&rsquo;s hard. Going medium-hard on everything, the grey middle, is
            where amateur runners stall and where injuries come from. This plan puts a ceiling on
            your easy runs and saves the effort for the one day a week that earns it.
          </p>
        </div>
      </Section>

      {/* ── What a session looks like ───────────────────────────────────
           SITE-SESSION-STEPS-01. One session, in full, in the app's own
           component — then the plan. A reader who studies this can read every
           row in the table below; a reader who meets the table first has to
           learn the notation from a one-line summary.

           `surface="page"`, deliberately: W-08 gives this site three grounds,
           the white spotlight is spent once per page, and `SessionSteps`
           already brings its own white cards. A band around them would be
           card-in-card. */}
      {exemplar && (
        <Section width="read" rhythm="none"
          innerStyle={{ padding: 'var(--space-5) 24px var(--space-2)' }}>
          <h2 style={{ fontSize: 'var(--fs-h4)', fontWeight: 800, color: 'var(--ink)', margin: '0 0 4px', letterSpacing: '-0.01em' }}>
            What a session looks like
          </h2>
          <p style={{ fontSize: 'var(--fs-body)', color: 'var(--mute)', margin: '0 0 var(--space-4)' }}>
            {exemplar.s.label ?? getSessionLabel(exemplar.s.type)}, week {exemplar.weekN}. Every quality session in the plan is laid out this way in the app.
          </p>
          <SessionStructureBlock s={exemplar.s} />
        </Section>
      )}

      {/* ── The plan, week by week ──────────────────────────────────────── */}
      <Section width="read" rhythm="none"
        innerStyle={{ padding: '4px 24px 8px' }}>
        <h2 style={{ fontSize: 'var(--fs-h4)', fontWeight: 800, color: 'var(--ink)', margin: '0 0 4px', letterSpacing: '-0.01em' }}>The plan, week by week</h2>
        <p style={{ fontSize: 'var(--fs-body)', color: 'var(--mute)', margin: '0 0 var(--space-5)' }}>Free. Take it exactly as it is.</p>

        {groups.map((g, gi) => {
          // MKT-PLAN-PHASE-NOTE-01 — derived from the weeks below it, never a
          // constant: the base note used to promise "no hard running yet" over
          // a block containing the §78 time trial.
          const meta = { label: PHASE_LABEL[g.key] ?? g.key, note: phaseNote(g.key, g.weeks) }
          return (
            <div key={gi} style={{ marginBottom: 28 }}>
              <div style={{ marginBottom: 12 }}>
                <h3 style={{ fontFamily: 'var(--font-brand)', fontSize: 'var(--fs-caption)', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--moss-strong)', margin: 0 }}>{meta.label}</h3>
                {meta.note && <p style={{ fontSize: 'var(--fs-body)', lineHeight: 1.5, color: 'var(--ink-2)', margin: '4px 0 0' }}>{meta.note}</p>}
              </div>

              {g.weeks.map(w => {
                const isDeload = w.type === 'deload' || w.badge === 'deload'
                const isRaceWeek = w.type === 'race' || w.badge === 'race'
                const daySessions = DAY_ORDER
                  .map(d => ({ d: d as string, s: w.sessions[d] }))
                  .filter(x => x.s != null) as { d: string; s: Session }[]
                return (
                  <div key={w.n} style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 14, padding: 'var(--space-4) var(--space-4)', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                      <div>
                        <span style={{ fontFamily: 'var(--font-brand)', fontSize: 'var(--fs-lead)', fontWeight: 800, color: 'var(--ink)' }}>Week {w.n}</span>
                        {isDeload && <span style={{ marginLeft: 8, fontSize: 'var(--fs-eyebrow)', fontWeight: 700, color: 'var(--s-recov-strong)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Recovery</span>}
                        {isRaceWeek && <span style={{ marginLeft: 8, fontSize: 'var(--fs-eyebrow)', fontWeight: 700, color: 'var(--s-race-strong)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Race week</span>}
                        <span style={{ display: 'block', fontSize: 'var(--fs-sm)', color: 'var(--mute)', marginTop: 2 }}>{w.label}</span>
                      </div>
                      {/* §121 Amendment 1 — race week shows what the runner TRAINS and
                          what they RACE, separately and with the race NAMED. This page
                          used to render `{trainingKm} km + race`, which was right about
                          the subtraction and vague about the thing subtracted; the
                          shared owner returns "15 km + 21.1 km race" so the wizard
                          preview, the plan screen and this page cannot drift.
                          ⚠️ NO `?? \`${km} km\`` FALLBACK. The first cut had one and
                          PREF-SWEEP-01 caught it: a unit glyph welded to an
                          interpolated value bypasses lib/format.ts, which ADR-015
                          makes the sole owner of every distance string. The fallback
                          was also unreachable — `weekVolumeLabel` returns null only
                          when `formatDistance` does. */}
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <span style={{ fontFamily: 'var(--font-brand)', fontSize: 'var(--fs-lead-lg)', fontWeight: 800, color: 'var(--ink)' }}>{weekVolumeLabel(w)}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {daySessions.map(({ d, s }) => (
                        <div key={d} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                          <span style={{ width: 3, alignSelf: 'stretch', minHeight: 34, borderRadius: 2, background: accentFor(s), flexShrink: 0 }} aria-hidden />
                          <span style={{ width: 34, flexShrink: 0, fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--mute)', paddingTop: 1 }}>{DAY_LABEL[d]}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--ink)' }}>{s.label}</span>
                              {s.zone && <span style={{ fontSize: 'var(--fs-eyebrow)', fontWeight: 700, color: 'var(--ink-2)', background: 'var(--bg-soft)', padding: '2px var(--space-2)', borderRadius: 999, letterSpacing: '0.02em' }}>{s.zone}</span>}
                            </div>
                            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--mute)', marginTop: 2 }}>
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
      </Section>

      {/* ── The honesty section ─────────────────────────────────────────── */}
      <Section width="read" rhythm="none"
        innerStyle={{ padding: '20px 24px 8px' }}>
        <div style={{ borderLeft: '3px solid var(--moss)', paddingLeft: 18, margin: '8px 0' }}>
          <h2 style={{ fontSize: 'var(--fs-h4)', fontWeight: 800, color: 'var(--ink)', margin: '0 0 12px', letterSpacing: '-0.01em' }}>This is the flat version.</h2>
          <p style={{ fontSize: 'var(--fs-lead)', lineHeight: 1.6, color: 'var(--ink-2)', margin: '0 0 12px', maxWidth: 620 }}>
            This plan doesn&rsquo;t know you. It doesn&rsquo;t know your Tuesday got busy, what your
            resting heart rate is doing, or that your last race said you&rsquo;re fitter than you think.
          </p>
          <p style={{ fontSize: 'var(--fs-lead)', lineHeight: 1.6, color: 'var(--ink-2)', margin: 0, maxWidth: 620 }}>
            The app does. It sets your real heart-rate zones, moves sessions when life breaks the
            week, and rebuilds the plan off a mid-block time trial. This page is the template.
            The app is the coach.
          </p>
        </div>
      </Section>

      {/* ── CTA ──────────────────────────────────────────────────────────
          COPY-CTA-01 — this was a WAITLIST, and the app has been on the App
          Store since launch. "Leave your email and I'll tell you when to
          start" asked the most interested reader on the page to wait for
          something that already exists, and put a form between them and a
          download. The badge is the action now; the waitlist component stays
          in the repo, unused, for the next pre-launch surface. */}
      <Section width="read" rhythm="none"
        innerStyle={{ padding: '28px 24px 8px' }}>
        <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 16, padding: 'var(--space-5) var(--space-5)' }}>
          <h2 style={{ fontSize: 'var(--fs-h4)', fontWeight: 800, color: 'var(--ink)', margin: '0 0 var(--space-2)' }}>The plan above is yours. No catch.</h2>
          <p style={{ fontSize: 'var(--fs-body-lg)', lineHeight: 1.55, color: 'var(--ink-2)', margin: '0 0 var(--space-4)', maxWidth: 520 }}>
            This one is fixed. The app builds the same plan around your zones, your week and your
            race date, and two weeks of it costs nothing.
          </p>
          <AppStoreBadge />
          <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--mute)', margin: '16px 0 0' }}>
            Or <Link href="/pricing" style={{ color: 'var(--moss-strong)', fontWeight: 600, textDecoration: 'none' }}>see what free covers first &rarr;</Link>
          </p>
        </div>
      </Section>

      {/* ── FAQ ─────────────────────────────────────────────────────────── */}
      <Section width="read" rhythm="none"
        innerStyle={{ padding: '28px 24px 8px' }}>
        <h2 style={{ fontSize: 'var(--fs-h4)', fontWeight: 800, color: 'var(--ink)', margin: '0 0 16px', letterSpacing: '-0.01em' }}>Questions</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {faqs.map((f, i) => (
            <div key={i} style={{ padding: 'var(--space-4) 0', borderTop: i === 0 ? 'none' : '1px solid var(--line)' }}>
              <h3 style={{ fontSize: 'var(--fs-body-lg)', fontWeight: 700, color: 'var(--ink)', margin: '0 0 var(--space-2)' }}>{f.q}</h3>
              <p style={{ fontSize: 'var(--fs-body)', lineHeight: 1.55, color: 'var(--ink-2)', margin: 0, maxWidth: 640 }}>{f.a}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Related plans (internal links) ──────────────────────────────── */}
      {related.length > 0 && (
        <Section width="read" rhythm="none"
          innerStyle={{ padding: '28px 24px 8px' }}>
          <h2 style={{ fontSize: 'var(--fs-lead-lg)', fontWeight: 700, color: 'var(--ink)', margin: '0 0 var(--space-4)' }}>Other free plans</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {related.map(r => (
              <Link key={r.slug} href={`/plans/${r.slug}`} style={{ textDecoration: 'none' }}>
                <div style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 12, padding: 'var(--space-4) var(--space-4)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 'var(--fs-body-lg)', fontWeight: 600, color: 'var(--ink)' }}>{planCardTitle(r)}</span>
                  <span style={{ fontSize: 'var(--fs-body-lg)', color: 'var(--moss-strong)' }} aria-hidden>→</span>
                </div>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <SiteFooter />
    </main>
  )
}
