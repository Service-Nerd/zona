// SITE-STAGED-PLAN-01 — the page for someone who has never run.
//
// 🏃 Coaching Board 2026-11-06, §116 Amendment 10: *"the base-build block a staged
// refusal returns may be rendered on a public page; the race it stages may not be
// claimed there."* 🧭 Design Board 2026-11-06, SHIP WITH AMENDMENT (5).
//
// 🔴 WHY THIS IS A SIBLING OF `PlanPage` AND NOT A BRANCH INSIDE IT. 🧭 Zhuo:
// *"the nine are 'pick your race, here is the plan'. A reader arrives knowing
// their distance. This page's reader does not have a distance; they have a doubt.
// Dropping it into the same template means inheriting an H1 that names a race we
// may not claim, a stat row whose numbers are wrong, and a hub that files it next
// to Sub-4 marathon."* Every question the item asked about layout was a symptom of
// forcing it into the wrong container.
//
// ⚠️ THE ENGINE HAS REFUSED 0% SINCE 2026-10-25 AND THE SITE NEVER SAID SO.
// 🎪 Collins: *"the single most distinctive thing this product does has been true
// and invisible for twelve days, while the site sold nine race plans to people who
// already run."*
//
// ⚠️ WHAT THIS PAGE MAY NOT DO, and the list is the ruling:
//   · claim the race. No race date, no countdown, no week count beyond the block,
//     no breadcrumb naming a distance. `target_found` is TRUE on this plan — a
//     real block exists 13 weeks past the checkpoint — which makes the rule bind
//     HARDER, not less: a page that can see it is more tempted to claim it.
//   · say "couch" (🎓 Sierra: the category's word, and mildly contemptuous about
//     the person it describes, who does not use it about themselves).
//   · say "marathon" in the slug or the h1 (🎪 Collins: the moment it appears the
//     reader anchors on it and the page becomes a marathon page that undersells
//     itself).

import Link from 'next/link'
import { Section } from '@/components/marketing/Section'
import { SiteHeader } from '@/components/marketing/SiteHeader'
import { SiteFooter } from '@/components/marketing/SiteFooter'
import { AppStoreBadge } from '@/components/marketing/AppStoreBadge'
import { BRAND } from '@/lib/brand'
import { generateMarketingPlan, stagedRaceOfPlan } from '@/lib/marketing/marketingPlan'
import { getPlan, type MarketingPlan } from '@/lib/marketing/plans'
import { formatDuration } from '@/lib/format'
import type { Session, Week } from '@/types/plan'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.zonna.run'
const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

/** 🔴 THE UNIT CHANGES, AND THAT IS THE STORY RATHER THAN A FOOTNOTE.
 *
 *  ✋ Silvanto: *"do not put a footnote under the table. Change the column. Weeks
 *  1–7 are measured in minutes, so the column shows minutes for those weeks and
 *  kilometres from the week they start covering measurable ground. The transition
 *  IS the story. A footnote explains an absence; a changed unit shows a
 *  progression."*
 *
 *  📱 Wroblewski, on the same point from the other side: *"at 375px a ten-row table
 *  with a unit that changes partway needs a column header that changes with it, or
 *  the reader reads 30 as kilometres."* So the table is drawn as two sections, each
 *  with its own header — not one table with a quiet switch inside it.
 *
 *  ⚠️ DERIVED, NEVER ASSUMED. The boundary is read off the plan: the first week
 *  whose sessions carry a `distance_km`. Hardcoding week 8 would be a number that
 *  rots the first time the engine changes the ramp. */
function splitAtFirstMeasuredWeek(weeks: Week[]): { minutes: Week[]; measured: Week[] } {
  const i = weeks.findIndex(w =>
    DAY_ORDER.some(d => (w.sessions[d] as Session | undefined)?.distance_km != null))
  if (i < 0) return { minutes: weeks, measured: [] }
  return { minutes: weeks.slice(0, i), measured: weeks.slice(i) }
}

function sessionsOf(w: Week): Session[] {
  return DAY_ORDER.map(d => w.sessions[d]).filter(Boolean) as Session[]
}

/** The one figure a week is about: its session length, or its session distance. */
function weekFigure(w: Week, measured: boolean): string {
  const ss = sessionsOf(w)
  if (!measured) {
    const mins = ss.map(s => s.duration_mins).filter((n): n is number => n != null)
    return mins.length ? (formatDuration(Math.max(...mins)) ?? '') : ''
  }
  const km = ss.map(s => s.distance_km).filter((n): n is number => n != null)
  return km.length ? `${Math.max(...km).toFixed(1)} km` : ''
}

function WeekRows({ weeks, measured }: { weeks: Week[]; measured: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
      {weeks.map(w => {
        const ss = sessionsOf(w)
        return (
          <div key={w.n} style={{
            display: 'flex', alignItems: 'baseline', gap: 'var(--space-4)',
            padding: 'var(--space-3) 0', borderTop: '1px solid var(--line)',
          }}>
            <span style={{
              width: '68px', flexShrink: 0, fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--mute)',
            }}>Week {w.n}</span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--fs-body)', color: 'var(--ink)' }}>
              {ss.length} {ss.length === 1 ? 'session' : 'sessions'}
              {' · '}
              <span style={{ color: 'var(--mute)' }}>{ss[0]?.zone ?? ''}</span>
            </span>
            <span style={{
              flexShrink: 0, fontFamily: 'var(--font-brand)', fontSize: 'var(--fs-body-lg)',
              fontWeight: 700, color: 'var(--ink)', fontVariantNumeric: 'tabular-nums',
            }}>{weekFigure(w, measured)}</span>
          </div>
        )
      })}
    </div>
  )
}

export function StagedPlanPage({ plan }: { plan: MarketingPlan }) {
  const { plan: generated } = generateMarketingPlan(plan)
  const staged = stagedRaceOfPlan(generated)
  const weeks = generated.weeks.filter(w => w.n >= 1)
  const { minutes, measured } = splitAtFirstMeasuredWeek(weeks)

  // 🔴 THE HERO IS THE ENGINE'S OWN SENTENCE, READ OFF THE PLAN, NOT TYPED HERE.
  // ✋ Silvanto: *"that sentence is the page. It is the engine speaking to someone
  // who is frightened, and it tells them to walk BEFORE they need to. No
  // competitor's landing page says that, because saying it requires having built
  // something that decides it."* Reading it rather than quoting it is also what
  // stops it drifting: change the catalogue and this page changes with it.
  const firstSession = sessionsOf(weeks[0] ?? ({ sessions: {} } as unknown as Week))[0]
  const firstInstruction = firstSession?.detail ?? null

  const sessionsPerWeek = Array.from(new Set(weeks.map(w => sessionsOf(w).length)))
  const firstDuration = firstSession?.duration_mins
  const zone = firstSession?.zone

  // No BreadcrumbList naming a distance (amendment 1). The page is its own thing.
  const ld = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: APP_URL },
      { '@type': 'ListItem', position: 2, name: 'Plans', item: `${APP_URL}/plans` },
      { '@type': 'ListItem', position: 3, name: 'Never run before', item: `${APP_URL}/plans/${plan.slug}` },
    ],
  }

  return (
    <main style={{ background: 'var(--bg)', color: 'var(--ink)', minHeight: '100vh', fontFamily: 'var(--font-ui)' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <SiteHeader current="plans" />

      {/* ── The sentence, first ─────────────────────────────────────────── */}
      <Section width="read" rhythm="none" innerStyle={{ padding: 'var(--sect-y-hero) 24px 0' }}>
        <p style={{
          fontFamily: 'var(--font-brand)', fontSize: 'var(--fs-sm)', fontWeight: 700,
          letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--moss-strong)',
          margin: '0 0 var(--space-4)',
        }}>
          Never run before
        </p>

        <h1 style={{
          fontFamily: 'var(--font-brand)', fontSize: 'var(--fs-h1)', fontWeight: 800,
          lineHeight: 1.08, letterSpacing: '-0.02em', color: 'var(--ink)', margin: '0 0 var(--space-5)',
        }}>
          {plan.h1}
        </h1>

        {firstInstruction && (
          <p style={{
            fontFamily: 'var(--font-brand)', fontSize: 'var(--fs-lead-lg)', fontWeight: 600,
            lineHeight: 1.4, color: 'var(--ink)', margin: '0 0 var(--space-3)',
            paddingLeft: 'var(--space-4)', borderLeft: '3px solid var(--s-easy)',
          }}>
            {firstInstruction}
          </p>
        )}
        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--mute)', margin: '0 0 var(--space-5)' }}>
          Week one, the first session. Written by the same engine that writes every other plan here.
        </p>

        {/* Amendment 3 — different stats, all measured off the plan above. */}
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 'var(--space-3) var(--space-5)',
          fontSize: 'var(--fs-sm)', fontWeight: 600, color: 'var(--ink-2)',
        }}>
          <span>{sessionsPerWeek.join(' to ')} runs a week</span>
          {firstDuration != null && <span>{formatDuration(firstDuration)} to start</span>}
          {zone && <span>Every one in {zone}</span>}
        </div>
      </Section>

      {/* ── Whose plan this is (amendment 2, Willy — body, not grey) ────── */}
      <Section width="read" rhythm="none" innerStyle={{ padding: 'var(--space-6) 24px 0' }}>
        <p style={{ fontSize: 'var(--fs-body-lg)', lineHeight: 1.6, color: 'var(--ink-2)', margin: 0 }}>
          This is one person&rsquo;s plan, not a template. The engine built it for someone running{' '}
          <strong style={{ color: 'var(--ink)' }}>nothing at all</strong> today, aged{' '}
          <strong style={{ color: 'var(--ink)' }}>40</strong>, with{' '}
          <strong style={{ color: 'var(--ink)' }}>no injury history</strong>, who can train{' '}
          <strong style={{ color: 'var(--ink)' }}>three days a week</strong>. Change any of those and you get a
          different plan: an injury in your history or another decade on the clock both move it, and the app
          asks you before it builds anything.
        </p>
      </Section>

      {/* ── Weeks measured in minutes ───────────────────────────────────── */}
      {minutes.length > 0 && (
        <Section width="read" rhythm="none" innerStyle={{ padding: 'var(--space-7) 24px 0' }}>
          <h2 style={{
            fontFamily: 'var(--font-brand)', fontSize: 'var(--fs-h4)', fontWeight: 800,
            color: 'var(--ink)', letterSpacing: '-0.01em', margin: '0 0 var(--space-2)',
          }}>
            The first {minutes.length} weeks are minutes, not kilometres
          </h2>
          <p style={{ fontSize: 'var(--fs-body)', lineHeight: 1.6, color: 'var(--mute)', margin: '0 0 var(--space-4)' }}>
            There is no distance column here because distance is not the job yet. You go out for the time on the
            row and walk whenever you need to. Chasing a kilometre in week one is the thing these weeks exist to
            stop.
          </p>
          <WeekRows weeks={minutes} measured={false} />
        </Section>
      )}

      {/* ── Weeks measured in kilometres ────────────────────────────────── */}
      {measured.length > 0 && (
        <Section width="read" rhythm="none" innerStyle={{ padding: 'var(--space-7) 24px 0' }}>
          <h2 style={{
            fontFamily: 'var(--font-brand)', fontSize: 'var(--fs-h4)', fontWeight: 800,
            color: 'var(--ink)', letterSpacing: '-0.01em', margin: '0 0 var(--space-2)',
          }}>
            Then the kilometres start
          </h2>
          <p style={{ fontSize: 'var(--fs-body)', lineHeight: 1.6, color: 'var(--mute)', margin: '0 0 var(--space-4)' }}>
            Week {measured[0]?.n} is the first week you cover measured ground. Two of these weeks are lighter than
            the one before on purpose: the easy weeks are where the work lands.
          </p>
          <WeekRows weeks={measured} measured />
        </Section>
      )}

      {/* ── The door, not the gate ──────────────────────────────────────── */}
      {/* 🔴 AMENDMENT 5, AND IT IS SIMS'S WORDING ALMOST VERBATIM. In the app the
          checkpoint is a DOOR; on a page it is a CLIFF unless the page says what
          is at the edge. 🎓 Sierra: *"this must not read as a test they might
          fail. 'Get to N km a week and then we'll see' is a hurdle, and this
          reader has spent a lifetime not clearing hurdles."* "Which may be less"
          is the kindest thing on the page and it survives the copy edit. */}
      <Section width="read" rhythm="none" innerStyle={{ padding: 'var(--space-7) 24px 0' }}>
        <div style={{
          background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-card)', padding: 'var(--space-5)',
        }}>
          <h2 style={{
            fontFamily: 'var(--font-brand)', fontSize: 'var(--fs-h4)', fontWeight: 800,
            color: 'var(--ink)', letterSpacing: '-0.01em', margin: '0 0 var(--space-3)',
          }}>
            What happens at the end
          </h2>
          <p style={{ fontSize: 'var(--fs-body-lg)', lineHeight: 1.6, color: 'var(--ink-2)', margin: 0 }}>
            Week {staged?.checkpointWeek ?? weeks.length} is not a finish line and it is not a test. It is where
            the next plan gets built, from what you actually ran, which may be less than this. Nothing here
            assumes you will be further along than you are.
          </p>
        </div>
      </Section>

      {/* ── The plan is free; the app is the app ────────────────────────── */}
      <Section width="read" rhythm="none" innerStyle={{ padding: 'var(--space-7) 24px var(--sect-y)' }}>
        <h2 style={{
          fontFamily: 'var(--font-brand)', fontSize: 'var(--fs-h4)', fontWeight: 800,
          color: 'var(--ink)', letterSpacing: '-0.01em', margin: '0 0 var(--space-2)',
        }}>
          Take it as it is
        </h2>
        <p style={{ fontSize: 'var(--fs-body-lg)', lineHeight: 1.6, color: 'var(--ink-2)', margin: '0 0 var(--space-5)' }}>
          Every session is above. No signup, no email. {BRAND.name} does the same thing with your own numbers,
          and keeps the zone ceiling on every run so the easy days stay easy.
        </p>
        <AppStoreBadge />

        <p style={{ fontSize: 'var(--fs-sm)', color: 'var(--mute)', margin: 'var(--space-6) 0 0' }}>
          Already running a bit?{' '}
          {/* ⚠️ The LABEL comes from the related plan's own `distanceLabel`, not from
              de-slugging: `slug.replace(/-/g,' ')` rendered "half marathon 12 week",
              which reads as a typo and is the hand-copy class this repo keeps
              catching. `getPlan` is the owner of a slug → plan lookup. */}
          {plan.related.map(getPlan).filter((p): p is MarketingPlan => !!p).map((rel, i) => (
            <span key={rel.slug}>
              {i > 0 && ' · '}
              <Link href={`/plans/${rel.slug}`} style={{ color: 'var(--moss-strong)', textDecoration: 'none' }}>
                {rel.distanceLabel}
              </Link>
            </span>
          ))}
        </p>
      </Section>

      <SiteFooter />
    </main>
  )
}
