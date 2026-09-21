// Content export for the nine published /plans/* pages.
//
// `npm run export:plans` writes `zonna-plans-export.md` and `.json` at the repo
// root (both gitignored). For writing carousel copy, decks or anything else
// off-site that has to agree with what the pages actually say.
//
// ⚠️ THERE IS NO STORED PLAN TO READ. The pages generate live from
// `generateRulePlan` at render time, so the only way to get the content is to
// make the same call they make. This script is that call, and nothing else:
// if it and the page ever disagree, the bug is here.
//
// Safe to snapshot: the plan content is byte-identical on every one of the 53
// dates a page publishes on (the anchor slides but the offsets are fixed), so
// an export stays in sync with the site until the ENGINE changes. Re-run after
// any change to `lib/plan/*` or `lib/marketing/plans.ts`.

import { MARKETING_PLANS, planAnchor, faqsFor } from '@/lib/marketing/plans'
import { phaseNote, PHASE_LABEL } from '@/lib/marketing/planNotes'
import { generateRulePlan } from '@/lib/plan/ruleEngine'
import { writeFileSync } from 'node:fs'

const DAY = ['mon','tue','wed','thu','fri','sat','sun'] as const
const DAY_LABEL: Record<string,string> = { mon:'Mon',tue:'Tue',wed:'Wed',thu:'Thu',fri:'Fri',sat:'Sat',sun:'Sun' }
const md: string[] = [], json: any[] = []

md.push('# Zonna free plans — full content export',
  '',
  `Generated ${new Date().toISOString().slice(0,10)} from the live engine, the same call the pages make.`,
  'Content is identical on every publishing date (checked across 53 anchors), so this matches the site.',
  '')

for (const p of MARKETING_PLANS) {
  const { planStart, raceDate } = planAnchor(p.dayOffset)
  const plan = generateRulePlan(p.input(raceDate) as any, 'free', planStart)
  const weeks = plan.weeks.filter(w => w.n >= 1)
  const inp: any = p.input(raceDate)

  md.push(`---`, ``, `## ${p.distanceLabel} · ${p.weeks} weeks — /plans/${p.slug}`, ``,
    `**H1:** ${p.h1}`, ``, `**Who it is for:** ${p.whoFor}`, ``,
    `**The runner it is built for:** ${inp.current_weekly_km} km/week now, longest recent run ${inp.longest_recent_run_km} km, ${inp.days_available} days available, ${inp.fitness_level}${inp.target_time ? `, goal ${inp.target_time}` : ''}.`, ``)

  // phase groups, so the carousel can use the same section breaks the page does
  const groups: {key:string; weeks:any[]}[] = []
  for (const w of weeks) {
    const k = w.phase ?? 'base'; const last = groups[groups.length-1]
    if (last && last.key === k) last.weeks.push(w); else groups.push({ key:k, weeks:[w] })
  }

  for (const g of groups) {
    md.push(`### ${PHASE_LABEL[g.key] ?? g.key} — weeks ${g.weeks[0].n} to ${g.weeks[g.weeks.length-1].n}`, ``,
      `> ${phaseNote(g.key, g.weeks)}`, ``)
    for (const w of g.weeks) {
      const badge = ((w as any).type === 'deload' || (w as any).badge === 'deload') ? ' · RECOVERY'
        : ((w as any).type === 'race' || (w as any).badge === 'race') ? ' · RACE WEEK' : ''
      md.push(`**Week ${w.n} — ${(w as any).weekly_km} km${badge}** · ${w.label}`, ``)
      for (const d of DAY) {
        const s: any = (w.sessions as any)[d]
        if (!s) continue
        const amt = s.distance_km != null ? `${s.distance_km} km` : s.duration_mins != null ? `${s.duration_mins} min` : ''
        md.push(`- ${DAY_LABEL[d]} · **${s.label}**${amt ? ` · ${amt}` : ''}${s.zone ? ` · ${s.zone}` : ''}${s.description ? `  \n  ${s.description}` : ''}`)
      }
      md.push(``)
    }
  }

  md.push(`### FAQs on this page`, ``)
  for (const f of faqsFor(p)) md.push(`**${f.q}**  `, f.a, ``)

  json.push({
    slug: p.slug, url: `https://www.zonna.run/plans/${p.slug}`,
    distance: p.distanceLabel, weeks: p.weeks, daysPerWeek: p.daysPerWeek,
    h1: p.h1, whoFor: p.whoFor, builtFor: { ...inp, race_date: undefined },
    plan: weeks.map(w => ({
      n: w.n, phase: w.phase, label: w.label, weekly_km: (w as any).weekly_km,
      recovery: (w as any).type === 'deload' || (w as any).badge === 'deload',
      sessions: DAY.map(d => {
        const s: any = (w.sessions as any)[d]
        return s ? { day: d, type: s.type, label: s.label, distance_km: s.distance_km ?? null,
                     duration_mins: s.duration_mins ?? null, zone: s.zone ?? null, description: s.description ?? null } : null
      }).filter(Boolean),
    })),
  })
}

writeFileSync('/Users/russe/rts-training-hub/zonna-plans-export.md', md.join('\n'))
writeFileSync('/Users/russe/rts-training-hub/zonna-plans-export.json', JSON.stringify(json, null, 2))
console.log('written:', md.length, 'md lines,', json.length, 'plans')
