import { NextRequest, NextResponse } from 'next/server'
import type { Plan, GeneratorInput } from '@/types/plan'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function nextMonday(from: Date): string {
  const d = new Date(from)
  const day = d.getDay()
  const daysUntilMonday = day === 1 ? 7 : (8 - day) % 7
  d.setDate(d.getDate() + daysUntilMonday)
  return d.toISOString().split('T')[0]
}

function weeksBetween(start: string, end: string): number {
  const ms = new Date(end).getTime() - new Date(start).getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24 * 7))
}

function primaryMetric(input: GeneratorInput): 'distance' | 'duration' {
  if (input.fitness_level === 'beginner') return 'duration'
  if (input.race_distance_km >= 50) return 'duration'
  return 'distance'
}

// ─── Guard rails ─────────────────────────────────────────────────────────────

function validate(input: GeneratorInput, planStart: string): string | null {
  const weeks = weeksBetween(planStart, input.race_date)
  if (weeks < 3) return 'Race is fewer than 3 weeks away. Cannot generate a safe plan.'
  if (input.race_distance_km >= 42 && weeks < 6) return 'Race is fewer than 6 weeks away for a marathon or longer. Cannot generate a safe plan.'
  if (input.days_available < 2) return 'At least 2 training days per week are required.'
  return null
}

// ─── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a specialist running coach for ZONA, a calm and disciplined training app. Your job is to generate personalised training plans as structured JSON.

OUTPUT RULES — non-negotiable:
- Return ONLY a raw JSON object. No markdown. No code fences. No explanation. No prose before or after.
- The JSON must be valid and parseable with JSON.parse().
- Every field name must exactly match the schema below.
- Do not invent fields that are not in the schema.

═══════════════════════════════════════
ZONA PLAN JSON SCHEMA
═══════════════════════════════════════

{
  "meta": {
    // Required
    "athlete": string,
    "race_name": string,
    "race_date": string,             // ISO date "YYYY-MM-DD"
    "race_distance_km": number,
    "plan_start": string,            // ISO date, always a Monday
    "resting_hr": number,
    "max_hr": number,
    "zone2_ceiling": number,
    "version": "1.0",
    "last_updated": string,          // ISO date
    "notes": string,                 // one-line plan summary
    "primary_metric": "distance" | "duration",
    "generated_at": string,          // ISO timestamp
    "generator_version": "1.0",

    // Athlete profile (store for reshaper)
    "fitness_level": "beginner" | "intermediate" | "experienced",
    "goal": "finish" | "time_target",
    "target_time"?: string,
    "days_available": number,
    "training_style"?: string,
    "hard_session_relationship"?: string,
    "motivation_type"?: string,
    "injury_history"?: string[],
    "terrain"?: string,

    // Confidence score
    "confidence_score": number,      // 1–10
    "confidence_risks": string[]     // up to 3 plain-English risks

    // Omit: handle, charity, quit_date — not applicable to generated plans
  },

  "weeks": [
    {
      "n": number,                   // 1-indexed
      "date": string,                // ISO date of Monday that week starts
      "label": string,               // short descriptive label e.g. "Base — easy return"
      "theme": string,               // one coaching sentence for this week
      "type": "normal" | "deload" | "race",
      "phase": "base" | "build" | "peak" | "taper",
      "badge"?: "deload" | "race",
      "long_run_hrs": number | null, // decimal hours, null for non-run weeks
      "weekly_km": number,           // total including easy runs; 0 for rest weeks
      "weekly_duration_mins"?: number,
      "sessions": {
        // Only include days that have a session. Omit rest days entirely.
        "mon"?: Session,
        "tue"?: Session,
        "wed"?: Session,
        "thu"?: Session,
        "fri"?: Session,
        "sat"?: Session,
        "sun"?: Session
      }
    }
  ]
}

Session schema:
{
  "type": "easy" | "quality" | "strength" | "rest" | "race",
  "label": string,                   // short title e.g. "Easy run — Zone 2"
  "detail": null,                    // always null for generated plans
  "distance_km"?: number,
  "duration_mins"?: number,
  "primary_metric"?: "distance" | "duration",
  "zone"?: string,                   // e.g. "Zone 2" or "Zone 3–4"
  "hr_target"?: string,              // e.g. "< 145 bpm"
  "pace_target"?: string,            // e.g. "6:30–7:00 /km"
  "rpe_target"?: number,             // 1–10
  "coach_notes"?: [string, string?, string?]  // max 3 bullet points — plain, direct coaching language
}

═══════════════════════════════════════
COACHING RULES
═══════════════════════════════════════

PLAN LENGTH BY DISTANCE:
- 5K / 10K: 8–12 weeks
- Half Marathon: 12–16 weeks
- Marathon: 16–20 weeks
- 50K: 16–20 weeks
- 100K: 20–24 weeks
- Cap at weeks available. If fewer weeks than minimum, generate as many as possible within guard rails.

PHASES:
- Base: Zone 2 only. No quality sessions for beginners in first 3–4 weeks.
- Build: Introduce 1 quality session/week (intermediate+). Volume increases.
- Peak: Highest volume. 1–2 quality sessions. Back-to-back long runs for ultra.
- Taper: Reduce volume 30–40% per week. Maintain intensity. Reduce long run.

TAPER LENGTH:
- 5K / 10K: 1 week
- Half Marathon: 2 weeks
- Marathon+: 2–3 weeks

VOLUME RULES:
- Weekly volume increase ≤ 10%
- Step-back week every 3–4 weeks: reduce volume 20–25%, set type = "deload", badge = "deload"
- Long run ≤ 35% of weekly volume
- Never increase volume AND intensity in the same week

INTENSITY DISTRIBUTION:
- Beginner: 90% easy / 10% hard
- Intermediate+: 80% easy / 20% hard

LONG RUN PROGRESSION:
- Increase 2–3 km/week or 5–10 mins/week
- Max increase: 20% per week
- Step-back weeks: reduce long run 15–20%
- Peak long run targets:
  - 5K: 8–10 km
  - 10K: 12–15 km
  - HM: 20–22 km
  - Marathon: 32–35 km
  - 50K: 35–40 km
  - 100K: 45–55 km

WEEKLY STRUCTURE:
- Long run on Sunday by default
- Quality sessions midweek (Tuesday or Wednesday)
- Easy runs fill remaining available days
- Strength: 2 sessions/week in base/build, 1–2 in peak, 1 in taper
- Strength sessions: label "Strength session", duration_mins 45, no distance, coach_notes one note on focus area. Content is a stub — do not invent exercises.
- Never schedule on days the athlete cannot train
- Quality session spacing: minimum 48h gap. Never day before or after long run.

SESSION TIME CAPS:
- Weekdays: respect max_weekday_mins if provided, default 90 min
- Long run: HM ≤ 120 min, Marathon ≤ 180 min, 50K ≤ 240 min, 100K ≤ 360 min

PRIMARY METRIC SELECTION:
- Beginner or ultra (50K+): suggest duration as primary_metric
- Experienced / intermediate road runners: suggest distance
- Apply at plan level (meta.primary_metric) and per-session where appropriate

QUALITY SESSION TYPES BY DISTANCE:
- 5K / 10K: Tempo 20–40 min, 400m–800m intervals
- Half Marathon: Tempo 30–50 min, cruise intervals 2–3 km
- Marathon: Marathon-pace runs, threshold runs
- 50K / 100K: Race-pace long runs, back-to-back long runs, hill reps

INJURY ADJUSTMENTS:
- achilles: no speed work or hills
- knee: avoid volume spikes >5%
- back: cap long run duration at 2h regardless of distance

HARD SESSION RELATIONSHIP:
- avoid: max 1 quality/week, keep RPE ≤ 7, note this in coach_notes
- overdo: explicitly cap at 2 quality/week max, include a coach note warning about recovery

CONFIDENCE SCORE (1–10):
- Start at 10. Deduct:
  - 2 if weeks available < recommended minimum
  - 1–2 if current weekly volume < 50% of peak target
  - 1 if days_available ≤ 3
  - 1 per significant injury
  - 1 if goal = time_target with aggressive gap
- confidence_risks: plain English, max 3. Be direct. e.g. "Current base is low for the timeline."

═══════════════════════════════════════
ZONA BRAND VOICE
═══════════════════════════════════════

ZONA is a calm, disciplined coaching app. The voice is:
- Direct and honest. Not motivational-poster language.
- Respects the athlete's intelligence.
- Acknowledges difficulty without catastrophising.
- Practical. Never vague.

Week labels: descriptive, not hype. e.g. "Base — Zone 2 discipline", "Build week 3 — first quality session", "Taper — trust the work"
Week themes: one honest coaching sentence. e.g. "HR discipline this week. Slower than feels right. That is correct."
Coach notes: plain, specific. Max 3. e.g. "Keep HR below your zone 2 ceiling throughout — walk if needed", "This is the week that builds the engine, not the race", "Eat before this run"

═══════════════════════════════════════
GUARD RAILS
═══════════════════════════════════════

If any of these conditions exist, set confidence_score ≤ 3 and note it prominently in confidence_risks. Still generate the plan — do not refuse.
- Current weekly volume = 0 and race < 10 weeks away
- Longest recent run < 30% of target peak long run
- Target time implies pace significantly faster than current fitness suggests

Do not include any athlete data you were not given. Do not fabricate race names, times, or achievements.`

// ─── Stub plan ───────────────────────────────────────────────────────────────
// Used when ANTHROPIC_API_KEY is not set. Exercises the full schema so the UI
// can be built and tested without a live API key.

function addWeeks(isoDate: string, n: number): string {
  const d = new Date(isoDate)
  d.setDate(d.getDate() + n * 7)
  return d.toISOString().split('T')[0]
}

function buildStubPlan(input: GeneratorInput, planStart: string, metric: 'distance' | 'duration', zone2: number): Plan {
  const name = input.athlete_name ?? 'Athlete'
  const raceName = input.race_name ?? 'Target Race'

  const weeks: Plan['weeks'] = [
    // ── Week 1 — Base ──────────────────────────────────────────────────────
    {
      n: 1, date: addWeeks(planStart, 0),
      label: 'Base — easy start',
      theme: 'HR discipline from day one. Slower than feels right. That is correct.',
      type: 'normal', phase: 'base',
      long_run_hrs: 1.2, weekly_km: 28, weekly_duration_mins: 175,
      sessions: {
        mon: { type: 'strength', label: 'Strength session', detail: null, duration_mins: 45, coach_notes: ['Focus on single-leg stability and glute activation — the foundation for everything that follows.'] },
        tue: { type: 'easy', label: 'Easy run — Zone 2', detail: null, distance_km: 8, duration_mins: 55, primary_metric: metric, zone: 'Zone 2', hr_target: `< ${zone2} bpm`, pace_target: '6:30–7:00 /km', rpe_target: 4, coach_notes: ['Walk immediately if HR climbs above your ceiling — no exceptions in week 1.', 'This pace will feel embarrassingly slow. That is the point.'] },
        thu: { type: 'easy', label: 'Easy run — Zone 2', detail: null, distance_km: 8, duration_mins: 55, primary_metric: metric, zone: 'Zone 2', hr_target: `< ${zone2} bpm`, pace_target: '6:30–7:00 /km', rpe_target: 4, coach_notes: ['Same effort as Tuesday. Note how HR compares at the same pace.'] },
        fri: { type: 'strength', label: 'Strength session', detail: null, duration_mins: 45, coach_notes: ['Lower body focus. Keep it controlled — you are running again Sunday.'] },
        sun: { type: 'easy', label: 'Long run — Zone 2', detail: null, distance_km: 12, duration_mins: 85, primary_metric: metric, zone: 'Zone 2', hr_target: `< ${zone2} bpm`, rpe_target: 4, coach_notes: ['Eat something 90 min before. Bring water.', 'If you finish feeling like you could do another 5 km, you got the effort right.'] },
      },
    },
    // ── Week 2 — Base ──────────────────────────────────────────────────────
    {
      n: 2, date: addWeeks(planStart, 1),
      label: 'Base — building consistency',
      theme: 'Same rules, slightly more volume. Consistency beats heroics.',
      type: 'normal', phase: 'base',
      long_run_hrs: 1.3, weekly_km: 31, weekly_duration_mins: 195,
      sessions: {
        mon: { type: 'strength', label: 'Strength session', detail: null, duration_mins: 45, coach_notes: ['Progress last week if it felt easy. Add load, not reps.'] },
        tue: { type: 'easy', label: 'Easy run — Zone 2', detail: null, distance_km: 9, duration_mins: 60, primary_metric: metric, zone: 'Zone 2', hr_target: `< ${zone2} bpm`, rpe_target: 4, coach_notes: ['Check pace vs HR against week 1. Any improvement is aerobic adaptation working.'] },
        thu: { type: 'easy', label: 'Easy run — Zone 2', detail: null, distance_km: 9, duration_mins: 60, primary_metric: metric, zone: 'Zone 2', hr_target: `< ${zone2} bpm`, rpe_target: 4 },
        fri: { type: 'strength', label: 'Strength session', detail: null, duration_mins: 45, coach_notes: ['Same as Monday. Consistency in the gym compounds quietly.'] },
        sun: { type: 'easy', label: 'Long run — Zone 2', detail: null, distance_km: 13, duration_mins: 90, primary_metric: metric, zone: 'Zone 2', hr_target: `< ${zone2} bpm`, rpe_target: 4, coach_notes: ['First long run that will start to feel long. Fuelling matters from here.'] },
      },
    },
    // ── Week 3 — Base ──────────────────────────────────────────────────────
    {
      n: 3, date: addWeeks(planStart, 2),
      label: 'Base — aerobic development',
      theme: 'Three weeks of Zone 2 done right is worth more than three months of junk miles.',
      type: 'normal', phase: 'base',
      long_run_hrs: 1.5, weekly_km: 34, weekly_duration_mins: 215,
      sessions: {
        mon: { type: 'strength', label: 'Strength session', detail: null, duration_mins: 45 },
        tue: { type: 'easy', label: 'Easy run — Zone 2', detail: null, distance_km: 10, duration_mins: 65, primary_metric: metric, zone: 'Zone 2', hr_target: `< ${zone2} bpm`, rpe_target: 4 },
        thu: { type: 'easy', label: 'Easy run — Zone 2', detail: null, distance_km: 10, duration_mins: 65, primary_metric: metric, zone: 'Zone 2', hr_target: `< ${zone2} bpm`, rpe_target: 4 },
        fri: { type: 'strength', label: 'Strength session', detail: null, duration_mins: 45 },
        sun: { type: 'easy', label: 'Long run — Zone 2', detail: null, distance_km: 14, duration_mins: 95, primary_metric: metric, zone: 'Zone 2', hr_target: `< ${zone2} bpm`, rpe_target: 4, coach_notes: ['Longest run yet. Bring a gel. Practice taking it on the move.'] },
      },
    },
    // ── Week 4 — Deload ────────────────────────────────────────────────────
    {
      n: 4, date: addWeeks(planStart, 3),
      label: 'Deload — let it land',
      theme: 'Adaptation happens in recovery, not in the session. This week counts.',
      type: 'deload', phase: 'base', badge: 'deload',
      long_run_hrs: 1.0, weekly_km: 22, weekly_duration_mins: 140,
      sessions: {
        mon: { type: 'strength', label: 'Strength session', detail: null, duration_mins: 30, coach_notes: ['Light session. Maintenance only.'] },
        tue: { type: 'easy', label: 'Easy run — Zone 2', detail: null, distance_km: 7, duration_mins: 45, primary_metric: metric, zone: 'Zone 2', hr_target: `< ${zone2} bpm`, rpe_target: 3 },
        thu: { type: 'easy', label: 'Easy run — Zone 2', detail: null, distance_km: 7, duration_mins: 45, primary_metric: metric, zone: 'Zone 2', hr_target: `< ${zone2} bpm`, rpe_target: 3 },
        sun: { type: 'easy', label: 'Long run — easy', detail: null, distance_km: 8, duration_mins: 55, primary_metric: metric, zone: 'Zone 1–2', hr_target: `< ${zone2} bpm`, rpe_target: 3, coach_notes: ['Short. Relaxed. Do not add extra because you feel good.'] },
      },
    },
    // ── Week 5 — Build ─────────────────────────────────────────────────────
    {
      n: 5, date: addWeeks(planStart, 4),
      label: 'Build — first quality session',
      theme: 'First week with structure above Zone 2. One session. The rest stays easy.',
      type: 'normal', phase: 'build',
      long_run_hrs: 1.5, weekly_km: 36, weekly_duration_mins: 225,
      sessions: {
        mon: { type: 'strength', label: 'Strength session', detail: null, duration_mins: 45, coach_notes: ['Back to full strength sessions now deload is done.'] },
        tue: { type: 'easy', label: 'Easy run — Zone 2', detail: null, distance_km: 10, duration_mins: 65, primary_metric: metric, zone: 'Zone 2', hr_target: `< ${zone2} bpm`, rpe_target: 4 },
        wed: { type: 'quality', label: 'Tempo run', detail: null, distance_km: 8, duration_mins: 50, primary_metric: metric, zone: 'Zone 3–4', hr_target: '155–165 bpm', pace_target: '5:30–5:45 /km', rpe_target: 7, coach_notes: ['2 km easy warm-up, 4 km at tempo effort, 2 km easy cool-down.', 'Comfortably hard — you should be able to say 3-word sentences.', 'First quality session. Do not chase pace. Chase effort.'] },
        fri: { type: 'strength', label: 'Strength session', detail: null, duration_mins: 45 },
        sun: { type: 'easy', label: 'Long run — Zone 2', detail: null, distance_km: 15, duration_mins: 100, primary_metric: metric, zone: 'Zone 2', hr_target: `< ${zone2} bpm`, rpe_target: 4, coach_notes: ['Longer than last build cycle. Keep HR honest — you did quality on Wednesday.'] },
      },
    },
    // ── Week 6 — Build ─────────────────────────────────────────────────────
    {
      n: 6, date: addWeeks(planStart, 5),
      label: 'Build — extending the tempo',
      theme: 'Tempo length increases. Everything else stays controlled.',
      type: 'normal', phase: 'build',
      long_run_hrs: 1.7, weekly_km: 39, weekly_duration_mins: 245,
      sessions: {
        mon: { type: 'strength', label: 'Strength session', detail: null, duration_mins: 45 },
        tue: { type: 'easy', label: 'Easy run — Zone 2', detail: null, distance_km: 11, duration_mins: 70, primary_metric: metric, zone: 'Zone 2', hr_target: `< ${zone2} bpm`, rpe_target: 4 },
        wed: { type: 'quality', label: 'Tempo run', detail: null, distance_km: 10, duration_mins: 60, primary_metric: metric, zone: 'Zone 3–4', hr_target: '155–165 bpm', pace_target: '5:30–5:45 /km', rpe_target: 7, coach_notes: ['2 km warm-up, 6 km tempo, 2 km cool-down.', 'Two minutes slower on this than Wednesday will not ruin your race. Two minutes faster might.'] },
        fri: { type: 'strength', label: 'Strength session', detail: null, duration_mins: 45 },
        sun: { type: 'easy', label: 'Long run — Zone 2', detail: null, distance_km: 17, duration_mins: 115, primary_metric: metric, zone: 'Zone 2', hr_target: `< ${zone2} bpm`, rpe_target: 4, coach_notes: ['Fuel every 40–45 minutes. Test your race-day gel.'] },
      },
    },
    // ── Week 7 — Build ─────────────────────────────────────────────────────
    {
      n: 7, date: addWeeks(planStart, 6),
      label: 'Build — cruise intervals',
      theme: 'A different quality stimulus. Shorter reps, sharper effort.',
      type: 'normal', phase: 'build',
      long_run_hrs: 1.8, weekly_km: 42, weekly_duration_mins: 265,
      sessions: {
        mon: { type: 'strength', label: 'Strength session', detail: null, duration_mins: 45 },
        tue: { type: 'easy', label: 'Easy run — Zone 2', detail: null, distance_km: 11, duration_mins: 72, primary_metric: metric, zone: 'Zone 2', hr_target: `< ${zone2} bpm`, rpe_target: 4 },
        wed: { type: 'quality', label: 'Cruise intervals', detail: null, distance_km: 10, duration_mins: 62, primary_metric: metric, zone: 'Zone 3–4', hr_target: '155–168 bpm', pace_target: '5:20–5:35 /km', rpe_target: 7, coach_notes: ['3 × 3 km at half marathon effort with 90 sec jog recovery.', 'Each rep should feel the same — do not go out hard and fade.'] },
        fri: { type: 'strength', label: 'Strength session', detail: null, duration_mins: 45 },
        sun: { type: 'easy', label: 'Long run — Zone 2', detail: null, distance_km: 18, duration_mins: 120, primary_metric: metric, zone: 'Zone 2', hr_target: `< ${zone2} bpm`, rpe_target: 4, coach_notes: ['At 2 hours this is your longest run. Respect it.', 'Do not run this faster because you feel good. You need it slow.'] },
      },
    },
    // ── Week 8 — Deload ────────────────────────────────────────────────────
    {
      n: 8, date: addWeeks(planStart, 7),
      label: 'Deload — recovery week',
      theme: 'Seven weeks of progressive work. Your body needs to absorb it.',
      type: 'deload', phase: 'build', badge: 'deload',
      long_run_hrs: 1.2, weekly_km: 28, weekly_duration_mins: 175,
      sessions: {
        mon: { type: 'strength', label: 'Strength session', detail: null, duration_mins: 30 },
        tue: { type: 'easy', label: 'Easy run — Zone 2', detail: null, distance_km: 8, duration_mins: 52, primary_metric: metric, zone: 'Zone 2', hr_target: `< ${zone2} bpm`, rpe_target: 3 },
        wed: { type: 'quality', label: 'Tempo run — short', detail: null, distance_km: 7, duration_mins: 42, primary_metric: metric, zone: 'Zone 3', hr_target: '150–160 bpm', rpe_target: 6, coach_notes: ['Keep intensity but cut volume. 2 km warm-up, 3 km tempo, 2 km cool-down.'] },
        sun: { type: 'easy', label: 'Long run — easy', detail: null, distance_km: 13, duration_mins: 88, primary_metric: metric, zone: 'Zone 1–2', hr_target: `< ${zone2} bpm`, rpe_target: 3 },
      },
    },
    // ── Week 9 — Peak ──────────────────────────────────────────────────────
    {
      n: 9, date: addWeeks(planStart, 8),
      label: 'Peak — highest volume week',
      theme: 'This is where the fitness is built. It will feel hard. That is correct.',
      type: 'normal', phase: 'peak',
      long_run_hrs: 1.9, weekly_km: 46, weekly_duration_mins: 285,
      sessions: {
        mon: { type: 'strength', label: 'Strength session', detail: null, duration_mins: 45 },
        tue: { type: 'easy', label: 'Easy run — Zone 2', detail: null, distance_km: 12, duration_mins: 78, primary_metric: metric, zone: 'Zone 2', hr_target: `< ${zone2} bpm`, rpe_target: 4 },
        wed: { type: 'quality', label: 'Tempo run', detail: null, distance_km: 12, duration_mins: 72, primary_metric: metric, zone: 'Zone 3–4', hr_target: '155–165 bpm', pace_target: '5:25–5:40 /km', rpe_target: 8, coach_notes: ['2 km warm-up, 8 km at tempo, 2 km cool-down.', 'This is your hardest quality session. Nail the pacing.'] },
        fri: { type: 'strength', label: 'Strength session', detail: null, duration_mins: 45 },
        sun: { type: 'easy', label: 'Long run — Zone 2', detail: null, distance_km: 20, duration_mins: 130, primary_metric: metric, zone: 'Zone 2', hr_target: `< ${zone2} bpm`, rpe_target: 4, coach_notes: ['Peak long run. 20 km at Zone 2 is your proof of work.', 'Gel at 40 min and 80 min. Practice your race nutrition.', 'Walk through aid station practice — slow down to eat.'] },
      },
    },
    // ── Week 10 — Peak ─────────────────────────────────────────────────────
    {
      n: 10, date: addWeeks(planStart, 9),
      label: 'Peak — second peak week',
      theme: 'One more big week. Then the taper begins.',
      type: 'normal', phase: 'peak',
      long_run_hrs: 1.8, weekly_km: 44, weekly_duration_mins: 275,
      sessions: {
        mon: { type: 'strength', label: 'Strength session', detail: null, duration_mins: 45 },
        tue: { type: 'easy', label: 'Easy run — Zone 2', detail: null, distance_km: 12, duration_mins: 78, primary_metric: metric, zone: 'Zone 2', hr_target: `< ${zone2} bpm`, rpe_target: 4 },
        wed: { type: 'quality', label: 'Cruise intervals', detail: null, distance_km: 11, duration_mins: 67, primary_metric: metric, zone: 'Zone 3–4', hr_target: '155–168 bpm', rpe_target: 7, coach_notes: ['4 × 2 km at half marathon effort with 90 sec jog recovery.'] },
        fri: { type: 'strength', label: 'Strength session', detail: null, duration_mins: 45 },
        sun: { type: 'easy', label: 'Long run — Zone 2', detail: null, distance_km: 19, duration_mins: 125, primary_metric: metric, zone: 'Zone 2', hr_target: `< ${zone2} bpm`, rpe_target: 4, coach_notes: ['1 km less than last week. This is intentional. The taper starts here.'] },
      },
    },
    // ── Week 11 — Taper ────────────────────────────────────────────────────
    {
      n: 11, date: addWeeks(planStart, 10),
      label: 'Taper — week 1',
      theme: 'Volume drops. Intensity stays. Trust the work you have done.',
      type: 'normal', phase: 'taper',
      long_run_hrs: 1.2, weekly_km: 30, weekly_duration_mins: 185,
      sessions: {
        tue: { type: 'easy', label: 'Easy run — Zone 2', detail: null, distance_km: 10, duration_mins: 65, primary_metric: metric, zone: 'Zone 2', hr_target: `< ${zone2} bpm`, rpe_target: 4, coach_notes: ['Legs may feel heavy. This is normal. Do not panic and add volume.'] },
        wed: { type: 'quality', label: 'Tempo run — short', detail: null, distance_km: 8, duration_mins: 48, primary_metric: metric, zone: 'Zone 3–4', hr_target: '155–165 bpm', rpe_target: 7, coach_notes: ['2 km warm-up, 4 km tempo, 2 km cool-down. Sharp but short.'] },
        fri: { type: 'easy', label: 'Easy run — Zone 2', detail: null, distance_km: 6, duration_mins: 40, primary_metric: metric, zone: 'Zone 2', hr_target: `< ${zone2} bpm`, rpe_target: 3 },
        sun: { type: 'easy', label: 'Long run — easy', detail: null, distance_km: 14, duration_mins: 95, primary_metric: metric, zone: 'Zone 1–2', hr_target: `< ${zone2} bpm`, rpe_target: 4, coach_notes: ['Last long run before race. Comfortable effort. Practice race-day nutrition one more time.'] },
      },
    },
    // ── Week 12 — Race ─────────────────────────────────────────────────────
    {
      n: 12, date: addWeeks(planStart, 11),
      label: 'Race week',
      theme: 'The work is done. Arrive rested, not exhausted from last-minute training.',
      type: 'race', phase: 'taper', badge: 'race',
      long_run_hrs: null, weekly_km: 8, weekly_duration_mins: 50,
      race_notes: `Race day: ${input.race_name ?? 'Target Race'}. Start conservatively. Run the first half at Zone 2. The second half is where the race begins.`,
      sessions: {
        tue: { type: 'easy', label: 'Easy shakeout', detail: null, distance_km: 4, duration_mins: 25, primary_metric: metric, zone: 'Zone 1–2', hr_target: `< ${zone2} bpm`, rpe_target: 2, coach_notes: ['4 km. Legs only. No watch targets.'] },
        thu: { type: 'easy', label: 'Easy shakeout', detail: null, distance_km: 4, duration_mins: 25, primary_metric: metric, zone: 'Zone 1–2', rpe_target: 2, coach_notes: ['4 strides at the end to wake the legs up. Nothing more.'] },
        sun: { type: 'race', label: `Race — ${input.race_name ?? 'Target Race'}`, detail: null, distance_km: input.race_distance_km, coach_notes: ['Start slow. Your goal pace should feel almost too easy for the first 5 km.', 'No new shoes, no new food, no new anything.'] },
      },
    },
  ]

  return {
    meta: {
      athlete: name,
      handle: '',
      race_name: raceName,
      race_date: input.race_date,
      race_distance_km: input.race_distance_km,
      charity: '',
      plan_start: planStart,
      quit_date: '',
      resting_hr: input.resting_hr,
      max_hr: input.max_hr,
      zone2_ceiling: zone2,
      version: '1.0',
      last_updated: new Date().toISOString().split('T')[0],
      notes: `[STUB] 12-week half marathon plan for ${name}. Replace with live generation when API key is configured.`,
      primary_metric: metric,
      fitness_level: input.fitness_level,
      goal: input.goal,
      target_time: input.target_time,
      days_available: input.days_available,
      training_style: input.training_style,
      hard_session_relationship: input.hard_session_relationship,
      motivation_type: input.motivation_type,
      injury_history: input.injury_history,
      terrain: input.terrain,
      generated_at: new Date().toISOString(),
      generator_version: '1.0',
      confidence_score: 7,
      confidence_risks: ['Stub plan — not personalised to your inputs', 'Switch to live generation by adding ANTHROPIC_API_KEY'],
    },
    weeks,
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const input: GeneratorInput = await req.json()

    // Compute plan start (next Monday from today)
    const planStart = nextMonday(new Date())

    // Guard rails — check before calling API
    const guardError = validate(input, planStart)
    if (guardError) {
      return NextResponse.json({ error: guardError }, { status: 422 })
    }

    const zone2 = input.zone2_ceiling ?? 145
    const metric = primaryMetric(input)
    const totalWeeks = weeksBetween(planStart, input.race_date)

    // Stub mode — no API key configured
    if (!process.env.ANTHROPIC_API_KEY) {
      const plan = buildStubPlan(input, planStart, metric, zone2)
      return NextResponse.json({ plan, stub: true })
    }

    const userMessage = `Generate a ZONA training plan for the following athlete.

ATHLETE DETAILS:
- Name: ${input.athlete_name ?? 'Athlete'}
- Race: ${input.race_name ?? 'Target race'} on ${input.race_date} (${input.race_distance_km} km)
- Goal: ${input.goal === 'time_target' ? `Finish in ${input.target_time}` : 'Finish the race'}
- Fitness level: ${input.fitness_level}
- Current weekly volume: ${input.current_weekly_km} km/week
- Longest recent run: ${input.longest_recent_run_km} km
- Days available per week: ${input.days_available}
${input.days_cannot_train?.length ? `- Cannot train on: ${input.days_cannot_train.join(', ')}` : ''}
${input.max_weekday_mins ? `- Max weekday session: ${input.max_weekday_mins} min` : ''}
${input.max_weekend_mins ? `- Max weekend session: ${input.max_weekend_mins} min` : ''}

HR PROFILE:
- Resting HR: ${input.resting_hr} bpm
- Max HR: ${input.max_hr} bpm
- Zone 2 ceiling: ${zone2} bpm

${input.training_style ? `TRAINING STYLE: ${input.training_style}` : ''}
${input.hard_session_relationship ? `HARD SESSION RELATIONSHIP: ${input.hard_session_relationship}` : ''}
${input.motivation_type ? `MOTIVATION TYPE: ${input.motivation_type}` : ''}
${input.injury_history?.length ? `INJURY HISTORY: ${input.injury_history.join(', ')}` : ''}
${input.terrain ? `TERRAIN: ${input.terrain}` : ''}

PLAN PARAMETERS:
- Plan start: ${planStart} (Monday)
- Weeks to race: ${totalWeeks}
- Suggested primary metric: ${metric}
- Zone 2 ceiling to use in hr_target fields: < ${zone2} bpm
- generated_at: ${new Date().toISOString()}

Apply all coaching rules. Return only the JSON object.`

    // Choose token budget based on plan length
    const maxTokens = totalWeeks <= 12 ? 12000 : totalWeeks <= 20 ? 18000 : 24000

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: maxTokens,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('Anthropic API error:', err)
      return NextResponse.json({ error: 'Plan generation failed' }, { status: 502 })
    }

    const anthropicData = await response.json()
    const rawText: string = anthropicData.content?.[0]?.text ?? ''

    // Parse JSON — strip any accidental markdown fences if present
    let plan: Plan
    try {
      const cleaned = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim()
      plan = JSON.parse(cleaned)
    } catch {
      console.error('Failed to parse plan JSON:', rawText.slice(0, 500))
      return NextResponse.json({ error: 'Generated plan was not valid JSON' }, { status: 500 })
    }

    // Minimal sanity check
    if (!plan.meta || !Array.isArray(plan.weeks) || plan.weeks.length === 0) {
      return NextResponse.json({ error: 'Generated plan is missing required structure' }, { status: 500 })
    }

    return NextResponse.json({ plan })

  } catch (e) {
    console.error('generate-plan error:', e)
    return NextResponse.json({ error: 'Unexpected error' }, { status: 500 })
  }
}
