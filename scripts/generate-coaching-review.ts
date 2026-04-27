// Generate coaching review packets for Claude Desktop analysis.
// Three canonical test cases (5K / 10K / HM) → markdown files in coaching-review/.
//
// Run: NODE_ENV=production npx tsx scripts/generate-coaching-review.ts
//
// Workflow:
//   1. Run this script
//   2. Open coaching-review/INDEX.md in Claude Desktop
//   3. Paste each case file when prompted
//   4. Capture feedback into the backlog as engine improvements
//
// The output is committed: every engine change produces a visible diff in
// coaching language, which is the point.

import fs from 'node:fs'
import path from 'node:path'
import { generateRulePlan, type Tier } from '../lib/plan/ruleEngine'
import type { GeneratorInput, Plan } from '../types/plan'

interface Case {
  id: string
  title: string
  persona: string
  tier: Tier
  input: Omit<GeneratorInput, 'plan_start'> & { plan_start: string }
  questions: string[]
}

const PLAN_START = '2026-04-27'

const cases: Case[] = [
  {
    id: '01-5k-beginner',
    title: '5K beginner — finish goal',
    persona:
      'Sarah, 30. Returning to running after a 6-month gap due to work travel. Currently 3×/week, mostly easy 5km loops with one 8km weekend run. Wants to finish a local 5K in 12 weeks without getting injured. Desk job; can do 60 min on weekdays, longer on weekends.',
    tier: 'free',
    input: {
      race_date: '2026-07-20',
      race_distance_km: 5,
      race_name: 'Local 5K',
      goal: 'finish',
      age: 30,
      current_weekly_km: 18,
      longest_recent_run_km: 8,
      days_available: 3,
      days_cannot_train: ['mon', 'tue', 'thu', 'sat'],
      preferred_long_run_day: 'sun',
      max_weekday_mins: 60,
      max_hr: 190,
      resting_hr: 60,
      training_age: '2-5yr',
      primary_metric: 'distance',
      plan_start: PLAN_START,
    } as any,
    questions: [
      'Is the volume progression appropriately conservative for a returning runner?',
      'Is the long run scaling safe given longest_recent_run_km = 8?',
      'Should there be any quality work for a beginner finish-goal 5K, or is all-easy correct?',
      'Is the weekday/weekend split realistic given the 60 min weekday cap?',
      'What injury risks does this plan introduce for this persona?',
    ],
  },
  {
    id: '02-10k-intermediate',
    title: '10K intermediate — sub-50 time goal',
    persona:
      "Mark, 38. Software engineer, two kids. Runs 4×/week, consistent for 2 years but always pushes too hard on easy days — Zona's exact target user. Wants to break 50:00 in a local 10K, 12 weeks away. Has 60 min on weekdays, longer on weekends. Comfortable with structured quality but injury history of mild knee niggles.",
    tier: 'paid',
    input: {
      race_date: '2026-07-20',
      race_distance_km: 10,
      race_name: 'Local 10K',
      goal: 'time_target',
      target_time: '0:50:00',
      age: 38,
      current_weekly_km: 30,
      longest_recent_run_km: 12,
      days_available: 4,
      days_cannot_train: ['tue', 'thu', 'sat'],
      preferred_long_run_day: 'sun',
      max_weekday_mins: 60,
      max_hr: 185,
      resting_hr: 55,
      training_age: '2-5yr',
      hard_session_relationship: 'love',
      injury_history: ['knee'],
      terrain: 'road',
      primary_metric: 'distance',
      benchmark: { type: 'race', distance_km: 5, time: '0:23:30', benchmark_date: '2026-03-15' },
      plan_start: PLAN_START,
    } as any,
    questions: [
      "Does the plan respect the 'always goes hard on easy days' core problem? (Easy paces / HR ceilings clear enough?)",
      'Is quality session frequency right for a 38-year-old with mild knee history? (5% week-on-week cap should apply.)',
      'Are the quality sessions appropriately race-specific for sub-50 (4:55–5:00/km goal pace)?',
      'Is the taper depth appropriate for a 10K?',
      "Does the plan honour the 60-min weekday cap without sacrificing key sessions?",
    ],
  },
  {
    id: '03-hm-intermediate',
    title: 'Half marathon intermediate — 1:55 time goal',
    persona:
      'Anna, 42. Runs 4×/week, building toward a target HM in 14 weeks. Goal time 1:55:00 (~5:27/km). Currently 40 km/week with an 18 km long run. Trail-running background, comfortable with quality. Wants race-specific work to nail the pace.',
    tier: 'paid',
    input: {
      race_date: '2026-08-03',
      race_distance_km: 21.1,
      race_name: 'Target HM',
      goal: 'time_target',
      target_time: '1:55:00',
      age: 42,
      current_weekly_km: 40,
      longest_recent_run_km: 18,
      days_available: 4,
      days_cannot_train: ['mon', 'wed', 'fri'],
      preferred_long_run_day: 'sun',
      max_weekday_mins: 75,
      max_hr: 180,
      resting_hr: 50,
      training_age: '5-10yr',
      hard_session_relationship: 'love',
      injury_history: [],
      terrain: 'trail',
      primary_metric: 'distance',
      benchmark: { type: 'race', distance_km: 10, time: '0:50:30', benchmark_date: '2026-03-08' },
      plan_start: PLAN_START,
    } as any,
    questions: [
      'Are HM-pace intervals being placed correctly in peak weeks?',
      'Is the long run progression supporting race specificity (e.g. progressive long runs, MP segments)?',
      'Is the 4-day structure efficient given Mon/Wed/Fri are blocked? (Tue/Thu/Sat/Sun pattern)',
      'Is the taper appropriate for HM (typically 2 weeks)?',
      'Any classic marathon-style mistakes to avoid in an HM build?',
    ],
  },
  {
    // 2026-04-28 / L-02 — under-resourced marathon, the case that drove the
    // 2026-04-28 review. Added to the standard regression set so future
    // rounds can verify the engine still refuses (without ack) and downgrades
    // (with ack). Inputs use acknowledged_prep_warning: true so the script
    // generates a plan; without that flag, generateRulePlan would throw
    // PrepTimeError 'warn_unacknowledged' (11 weeks < 16-week marathon ok
    // threshold). Expected meta:
    //   prep_time_status: 'warned'
    //   volume_profile: 'maintenance'
    //   returning_runner_note: present
    id: '04-marathon-intermediate',
    title: 'Marathon intermediate — 4:00 time goal, 13 weeks out (warn-acknowledged)',
    persona:
      'Mike, 47. Returning runner (4 weeks at current volume) with hip injury history. 4:00 marathon goal, 13 weeks out. Currently 38 km/week, longest recent run 18 km. 4 sessions/week. The case that prompted the 2026-04-28 review: a time-targeted marathon plan should not be possible from this starting point. Engine refuses generation unless acknowledged_prep_warning is set; with acknowledgment, plan generates as maintenance with warnings. (The original review used 11 weeks, which after §44 returning-runner shift now triggers BLOCK; 13 weeks puts the case back in the warn zone the review was concerned about.)',
    tier: 'paid',
    input: {
      race_date: '2026-07-27',
      race_distance_km: 42.2,
      race_name: 'Target Marathon',
      goal: 'time_target',
      target_time: '4:00:00',
      age: 47,
      current_weekly_km: 38,
      longest_recent_run_km: 18,
      days_available: 4,
      days_cannot_train: ['mon', 'wed', 'fri'],
      preferred_long_run_day: 'sun',
      max_weekday_mins: 60,
      // resting_hr deliberately omitted to exercise the §50 fallback (max-only
      // → percent_of_max). The original review had resting_hr: 0; §55 (L-01)
      // now rejects that as invalid, so a real Case-04 submission would be
      // bounced at validation and the runner would either fix the value or
      // omit it. Omitting it here triggers §50 path 2.
      max_hr: 175,
      training_age: '5yr+',
      // weeks_at_current_volume < 8 triggers the §29 fresh-from-layoff path,
      // matching the persona's "returning runner with hip injury history".
      // This shifts the §44 prep-time warn threshold up by 2 weeks (16 → 18),
      // confirms the warn status, and surfaces the §51 returning_runner_note.
      weeks_at_current_volume: 4,
      hard_session_relationship: 'love',
      injury_history: ['hip'],
      terrain: 'road',
      primary_metric: 'distance',
      acknowledged_prep_warning: true,
      plan_start: PLAN_START,
    } as any,
    questions: [
      'Is the prep-time warning surfaced clearly in plan meta?',
      'Does the maintenance downgrade list a sensible alternative (defer race, switch to HM, change goal to finish)?',
      'Is the returning_runner_note specific about which input was scaled and why?',
      'For an 11-week marathon, are the peak long runs alternating per §47 (no two consecutive 30km MP-finish weeks)?',
      'Does the engine respect the hip injury (no hill sessions in base/build)?',
      'Is the HR fallback note (max-only, percent_of_max) clear enough that the runner knows their resting HR would improve accuracy?',
    ],
  },
]

function fmtSession(day: string, s: any): string {
  const parts: string[] = [day]
  parts.push(s.label?.replace(/—/g, '-') ?? s.type)
  const dist = s.distance_km != null ? `${s.distance_km}km` : null
  const dur = s.duration_mins != null ? `${s.duration_mins}min` : null
  const metric = [dist, dur].filter(Boolean).join(' · ')
  if (metric) parts.push(metric)
  if (s.zone) parts.push(s.zone)
  if (s.hr_target) parts.push(`HR ${s.hr_target}`)
  if (s.pace_target) parts.push(`pace ${s.pace_target}`)
  if (s.rpe_target != null) parts.push(`RPE ${s.rpe_target}`)
  return `- **${parts[0]}** — ${parts.slice(1).join(' · ')}`
}

function renderCase(c: Case, plan: Plan): string {
  const lines: string[] = []
  lines.push(`# Case ${c.id.split('-')[0]}: ${c.title}`)
  lines.push('')
  lines.push('## Runner profile')
  lines.push('')
  lines.push(c.persona)
  lines.push('')

  lines.push('## Inputs')
  lines.push('')
  lines.push('| Field | Value |')
  lines.push('|---|---|')
  for (const [k, v] of Object.entries(c.input)) {
    if (v == null) continue
    const display = Array.isArray(v) ? `[${v.join(', ')}]`
      : typeof v === 'object' ? JSON.stringify(v)
      : String(v)
    lines.push(`| \`${k}\` | ${display} |`)
  }
  lines.push(`| \`tier\` | ${c.tier} |`)
  lines.push('')

  lines.push('## Plan summary')
  lines.push('')
  lines.push(`**${plan.weeks.length} weeks** · race: ${plan.meta.race_name} (${plan.meta.race_distance_km} km) on ${plan.meta.race_date}`)
  let fitnessLine = `Derived fitness: **${plan.meta.fitness_level}**`
  if (plan.meta.vdot) {
    fitnessLine += ` · VDOT ${plan.meta.vdot}`
    if (plan.meta.vdot_training_anchor && plan.meta.vdot_training_anchor !== plan.meta.vdot) {
      fitnessLine += ` (training anchor ${plan.meta.vdot_training_anchor}, ${plan.meta.vdot_discount_applied_pct}% conservatism discount)`
    }
  }
  lines.push(fitnessLine)
  if (plan.meta.benchmark) {
    const b = plan.meta.benchmark
    lines.push(`Benchmark: ${b.distance_km} km in ${b.time}` + (b.benchmark_date ? ` (${b.benchmark_date})` : ''))
  }
  if (plan.meta.goal_pace_per_km) lines.push(`Goal pace: **${plan.meta.goal_pace_per_km}**`)
  if (plan.meta.volume_profile) lines.push(`Volume profile: **${plan.meta.volume_profile}**`)
  if (plan.meta.compression_classification && plan.meta.compression_classification !== 'optimal') {
    lines.push(`Compression: **${plan.meta.compression_classification}**`)
  }
  if (plan.meta.volume_constraint_note) lines.push(`> ${plan.meta.volume_constraint_note}`)
  lines.push('')

  for (const w of plan.weeks) {
    const phase = w.phase ?? '—'
    const badge = w.badge ? ` (${w.badge})` : ''
    lines.push(`### Week ${w.n} — ${w.label} · *${phase}*${badge}`)
    if (w.theme) lines.push(`> ${w.theme}`)
    lines.push('')
    lines.push(`Weekly: **${w.weekly_km} km**` + (w.long_run_hrs ? ` · long: ${w.long_run_hrs}h` : ''))
    if ((w as any).tune_up_callout) lines.push(`> ${(w as any).tune_up_callout}`)
    lines.push('')
    const dayOrder = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
    for (const d of dayOrder) {
      const s = (w.sessions as any)[d]
      if (!s) continue
      lines.push(fmtSession(d, s))
      if (s.coach_notes?.length) {
        for (const n of s.coach_notes) {
          if (n) lines.push(`  - _${n}_`)
        }
      }
    }
    lines.push('')
  }

  lines.push('## Coaching questions to address')
  lines.push('')
  for (const q of c.questions) lines.push(`- ${q}`)
  lines.push('')

  lines.push('## Raw JSON')
  lines.push('')
  lines.push('<details>')
  lines.push('<summary>Input</summary>')
  lines.push('')
  lines.push('```json')
  lines.push(JSON.stringify(c.input, null, 2))
  lines.push('```')
  lines.push('</details>')
  lines.push('')
  lines.push('<details>')
  lines.push('<summary>Generated plan</summary>')
  lines.push('')
  lines.push('```json')
  lines.push(JSON.stringify(plan, null, 2))
  lines.push('```')
  lines.push('</details>')
  lines.push('')

  return lines.join('\n')
}

function renderIndex(cases: Case[]): string {
  return `# Zona Plan Coaching Review

You are a senior running coach with 15+ years of experience training non-elite
runners — people with day jobs, families, and a tendency to overtrain. Your
job is to review three AI-generated training plans and give honest, actionable
feedback to the engine team.

## Context

Zona is a training app for runners who always go hard on their easy days.
Core positioning: *"Training plans that stop you overtraining."* The engine
follows a written constitution (\`docs/canonical/CoachingPrinciples.md\`)
covering volume progression, intensity distribution, long-run rules, taper
depth, recovery cadence, life-first scheduling, and injury caps.

You are not reviewing whether the engine matched the constitution
mechanically — that's enforced by \`lib/plan/invariants.ts\`. You are reviewing
whether the **resulting plan would coach the runner well in real life**.

## How to review each case

For each of the three cases, evaluate the plan against the runner persona.
Be honest. Be specific. Reference week numbers and session days.

### Evaluation dimensions

1. **Volume progression** — Is the ramp appropriate for the runner's history?
   Are deload weeks placed and sized well?
2. **Intensity distribution** — Is easy actually easy? Is quality
   appropriately dosed for the goal and the runner's experience?
3. **Long run shape** — Is it scaling sensibly? Is it the longest run of
   the week? Race-specific where it should be?
4. **Quality session selection** — Are the named sessions
   (e.g. "Aerobic with hills", "Long VO2max", "HM-pace intervals") the
   *right* sessions for the phase, distance, and goal?
5. **Practical adherence** — Does this plan respect the runner's life
   (weekday cap, blocked days, injury history)?
6. **Taper** — Is volume drop appropriate for the race distance? Does
   intensity stay sharp?
7. **What's missing** — Strides? Hill repeats? Race-specific simulation?
   Cross-training cues?

### Output format (for each case)

\`\`\`
## Case 0X — [title]

### Strengths (3-5 bullets)
- ...

### Concerns (3-5 bullets)
- ... (cite week N, day X)

### Specific recommendations (priority-ordered)
1. **[High]** ...
2. **[Medium]** ...
3. **[Low]** ...

### Constitutional gaps
Anything the plan does that you'd flag as a coaching error but that isn't
addressed by Zona's existing principles. Describe the gap and propose a
principle that would close it.
\`\`\`

## Cases

${cases.map((c, i) => `${i + 1}. [${c.title}](./${c.id}.md)`).join('\n')}

## How to use this review

When you're done with all three cases, the team will:
1. Triage each recommendation into the backlog.
2. For each "constitutional gap" you identified, write or amend a section
   in \`docs/canonical/CoachingPrinciples.md\`, promote any new numerics
   to \`GENERATION_CONFIG\`, and add a corresponding mechanical check to
   \`lib/plan/invariants.ts\`.
3. Re-run \`scripts/generate-coaching-review.ts\` after engine changes
   and diff the output to verify the changes addressed the feedback.
`
}

const outDir = path.resolve(__dirname, '..', 'coaching-review')
fs.mkdirSync(outDir, { recursive: true })

for (const c of cases) {
  const plan = generateRulePlan(c.input as any, c.tier)
  const md = renderCase(c, plan)
  fs.writeFileSync(path.join(outDir, `${c.id}.md`), md)
  console.log(`✓ ${c.id}.md (${plan.weeks.length} weeks)`)
}

fs.writeFileSync(path.join(outDir, 'INDEX.md'), renderIndex(cases))
console.log(`✓ INDEX.md`)
console.log(`\nWrote ${cases.length + 1} files to ${outDir}/`)
