import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { secretMatches } from '@/lib/security/secrets'
import { recordOpsEvent } from '@/lib/ops/recordOpsEvent'
import { validateReshapedPlan } from '@/lib/plan/invariants'
import type { Plan } from '@/types/plan'

// GET/POST /api/ops/plan-audit — PLAN-AUDIT-01 daily constitutional audit.
//
// Runs validatePlan over every STORED plan and records the ones that breach
// their own constitution.
//
// WHY THIS EXISTS
// `generateRulePlan` validates at generation time, but in production it only
// console.errors and returns the plan (never break the runner) — and a console
// line on a Vercel function is not a record. Worse, a plan can become invalid
// AFTER generation: a reshape or a maintenance-block append.
//
// On 2026-09-03 three separate INV-PLAN-MAX-WEEKDAY-MINS defects were found in a
// single day, each having shipped behind a green suite (792 tests, 18,060 swept
// plans) because the sweep's hand-authored grid could not reach them. Every one
// would have been caught here within 24 hours, because this probe does not
// depend on anyone having imagined the right input — it reads what real runners
// actually hold.
//
// FOUNDATION WEEKS — since ADR-020 Option A (2026-09-03), construction is
// server-side (composePlanWithFoundation, lib/plan/foundationCompose.ts) and
// validatePlan() sees them at generation time too, in the live path. This
// probe is no longer their only server-side check, but it stays valuable
// exactly the same way it is for main weeks: it catches a plan that became
// invalid AFTER generation (a stored plan predating this change, or a future
// reshape/maintenance-block path that touches a foundation week).
//
// Auth: CRON_SECRET via Authorization: Bearer or x-cron-secret header.

// ── Alert on CHANGE, not on state ───────────────────────────────────────────
//
// A first run over production found 15 of 15 stored plans invalid. Most of that
// is legitimate historical debt: plans generated before a principle existed
// (INV-PLAN-DIFFICULTY-ANNOTATED, INV-PLAN-CATALOGUE-LINK), plus the defects
// fixed on 2026-09-03 which — per the live-plan policy — are deliberately NOT
// backfilled into plans people are already running.
//
// So a probe that alerts on "is this plan invalid?" would fire on every row
// every day, forever, and train us to ignore it. That is precisely the failure
// the OPS-01 probe avoided by choosing a timestamp relationship over a content
// deep-equal: "an alert that always fires is an alert nobody reads".
//
// This one therefore alerts on a TRANSITION — the set of violation codes for a
// user differing from the last set recorded for them. Consequences:
//   - first sighting of a plan's debt  -> one row, then silence
//   - a NEW violation class appearing  -> alerts immediately (the regression case)
//   - a violation being FIXED          -> alerts once, so improvement is visible too
// Self-baselining: no snapshot to maintain, and no cutoff date to go stale.
const CODES_KEY = 'codes'

// Guard rail: this is a Vercel function, not a batch job. Well above the current
// plan count; if it is ever hit, the audit needs pagination rather than a
// silently truncated pass — so it is reported, never hidden.
const MAX_PLANS = 5000

export async function GET(req: NextRequest) { return POST(req) }

export async function POST(req: NextRequest) {
  const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? null
  const secret = bearer || req.headers.get('x-cron-secret')
  if (!secretMatches(secret, process.env.CRON_SECRET)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: rows, error } = await supabase
    .from('plans')
    .select('user_id, plan_json, updated_at')
    .limit(MAX_PLANS)
  if (error) {
    console.error('[plan-audit] query failed', error.message)
    return NextResponse.json({ error: 'query failed' }, { status: 500 })
  }

  // Last recorded violation-code set per user, newest first. Only rows written by
  // THIS probe count — the generate-plan route writes the same kind at creation
  // time, and its codes describe a different moment.
  const { data: history } = await supabase
    .from('ops_events')
    .select('user_id, detail, created_at')
    .eq('kind', 'plan_rule_invalid')
    .order('created_at', { ascending: false })
    .limit(1000)
  const lastSeen = new Map<string, string>()
  for (const row of history ?? []) {
    const d = row.detail as Record<string, unknown> | null
    if (!d || d.source !== 'plan-audit') continue
    if (!lastSeen.has(row.user_id)) {
      lastSeen.set(row.user_id, JSON.stringify(((d[CODES_KEY] as string[]) ?? []).slice().sort()))
    }
  }

  let checked = 0, invalid = 0, skipped = 0, unchanged = 0, changed = 0
  const flagged: Array<{ user_id: string; codes: string[]; state: 'new' | 'changed' | 'resolved' }> = []
  // AGE OF EVERY BREACHING PLAN, newest first. See the summary block at the end
  // for why this is the number that makes the audit readable.
  const invalidPlanAgesDays: number[] = []

  for (const row of rows ?? []) {
    const plan = row.plan_json as Plan | null
    if (!plan?.weeks?.length || !plan.meta) { skipped++; continue }

    let errors
    try {
      // Single owner for "validate a stored plan" — it prefers the persisted
      // meta.generator_input and falls back for pre-PV2-A plans. A second
      // implementation here would be free to drift (D-08).
      errors = validateReshapedPlan(plan).filter(v => v.severity === 'error')
    } catch (e) {
      // A validator throw is itself a finding, but must not abort the audit.
      console.error('[plan-audit] validate threw', e)
      skipped++
      continue
    }
    checked++
    const codes = Array.from(new Set(errors.map(v => v.code))).sort()
    const prev = lastSeen.get(row.user_id)
    const now = JSON.stringify(codes)

    if (!errors.length) {
      // A plan that WAS flagged and is now clean: record the improvement once,
      // so a fix is as visible as a regression.
      if (prev && prev !== '[]') {
        flagged.push({ user_id: row.user_id, codes: [], state: 'resolved' })
        await recordOpsEvent(
          'plan_rule_invalid',
          { source: 'plan-audit', codes: [], resolved: true, previously: JSON.parse(prev) },
          row.user_id,
        )
      }
      continue
    }

    invalid++
    // Age is recorded for EVERY breaching plan, including the ones the dedupe
    // below skips. The dedupe is right for per-user events (do not re-report an
    // unchanged finding) and wrong for the summary: a plan that breaches
    // identically every day still counts toward "how much of the fleet is
    // breaching", and excluding it would make the fleet look like it was
    // healing every time a finding went quiet.
    invalidPlanAgesDays.push(
      Math.floor((Date.now() - new Date(row.updated_at as string).getTime()) / 86_400_000))
    if (prev === now) { unchanged++; continue }
    changed++
    flagged.push({ user_id: row.user_id, codes, state: prev ? 'changed' : 'new' })

    await recordOpsEvent(
      'plan_rule_invalid',
      {
        source: 'plan-audit',
        codes,
        ...(prev ? { previously: JSON.parse(prev) } : {}),
        // Foundation weeks (n <= 0) are the class no other server-side check
        // sees at all — call them out so triage starts in the right place.
        foundation_week_violations: errors.filter(v => (v.week ?? 1) <= 0).length,
        sample: errors.slice(0, 5).map(v => ({ code: v.code, week: v.week, day: v.day, message: v.message })),
        plan_updated_at: row.updated_at,
      },
      row.user_id,
    )
  }

  if ((rows?.length ?? 0) >= MAX_PLANS) {
    console.error(`[plan-audit] hit MAX_PLANS (${MAX_PLANS}) — audit is truncated and needs pagination`)
  }

  // ── THE CUT THAT MAKES THIS READABLE (2026-09-15) ──────────────────────────
  //
  // Measured that day: 43 events over 11 days, 26 distinct invariant codes, 16
  // users holding a plan that breaches its own constitution, and NOBODY had read
  // any of it. The probe was not broken — it was unreadable, which has the same
  // effect and is harder to notice.
  //
  // The reason it was unreadable is the LIVE-PLAN POLICY: doctrine and engine
  // fixes are deliberately never backfilled to existing plans. So a plan built
  // in April is validated against a constitution that has gained dozens of
  // invariants since, and it breaches BY DESIGN. Measured, the correlation is
  // almost perfect: April plan 14 codes, June plans 5-10, September plans 1-3.
  // A reader cannot tell that expected backlog from a real regression, so they
  // stop reading, and then a genuinely new breach lands in the same stream and
  // is invisible. NOISE-GATE-01, applied to an ops probe rather than an invariant.
  //
  // ONE NUMBER FIXES IT: the age of the NEWEST breaching plan. The only question
  // this audit can answer about the engine as it stands today is "did it recently
  // produce a bad plan?", and nothing older than the last engine change can speak
  // to that. If the newest breaching plan is weeks old, the fleet is carrying
  // history and nothing is wrong now. If it is hours old, something is.
  //
  // Deliberately NOT a fixed threshold: "current" would have to mean "since the
  // last deploy", which this route cannot know, and a hardcoded window would rot
  // silently the first time the deploy cadence changed. An age distribution needs
  // no maintenance and says more.
  invalidPlanAgesDays.sort((a, b) => a - b)
  const ageBuckets = {
    '0-1d':  invalidPlanAgesDays.filter(d => d <= 1).length,
    '2-7d':  invalidPlanAgesDays.filter(d => d > 1 && d <= 7).length,
    '8-30d': invalidPlanAgesDays.filter(d => d > 7 && d <= 30).length,
    '31d+':  invalidPlanAgesDays.filter(d => d > 30).length,
  }
  const summary = {
    checked, invalid, skipped,
    newest_invalid_plan_age_days: invalidPlanAgesDays[0] ?? null,
    invalid_by_plan_age: ageBuckets,
  }

  // A SUMMARY EVENT, so a digest has one row to read instead of N per-user rows.
  // Recorded under the existing kind with a distinct `source`: the audit's own
  // history lookup filters on `source === 'plan-audit'`, so this cannot pollute
  // the per-user dedupe, and it needs no new OpsEventKind or migration.
  //
  // Recorded on EVERY run, including clean ones. A backstop nobody can see
  // firing is one nobody trusts — the same argument that made
  // `plan_enrich_server_saved` record its success case.
  await recordOpsEvent('plan_rule_invalid', { source: 'plan-audit-summary', ...summary }, null)

  return NextResponse.json({ ...summary, unchanged, changed, flagged })
}
