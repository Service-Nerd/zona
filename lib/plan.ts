import { validatePlan } from './plan/invariants'
import { PlanSchema } from './plan/schema'
import { recordOpsEvent } from './ops/recordOpsEvent'
import type { SupabaseClient } from '@supabase/supabase-js'
import { reanchorCharityGrant } from '@/lib/charity/reanchor'
import { supersedeWeekKeyedRows, isRaceIdentityChange } from './plan/supersede'
import type { Plan, Session, Week } from '@/types/plan'
import {
  resolveEffectiveSessions,
  type DayKey,
  type SessionOverride,
} from '@/lib/plan/effectiveSessions'

export const DEFAULT_GIST_URL = process.env.NEXT_PUBLIC_GIST_URL ||
  'https://gist.githubusercontent.com/Service-Nerd/efec07a87f65494f0e078a1ccb136100/raw/rts_plan.json'

export const EMPTY_PLAN: Plan = {
  meta: {
    athlete: '', handle: '',
    race_name: '', race_date: '', race_distance_km: 0,
    charity: '', plan_start: '', quit_date: '',
    resting_hr: 0, max_hr: 0, zone2_ceiling: 145,
    version: '', last_updated: '', notes: '',
  },
  weeks: [],
}

const PLAN_FALLBACK: Plan = {
  meta: {
    athlete: '', handle: '',
    race_name: '', race_date: '', race_distance_km: 0,
    charity: '', plan_start: '', quit_date: '',
    resting_hr: 0, max_hr: 0, zone2_ceiling: 145,
    version: '', last_updated: '', notes: ''
  },
  weeks: []
}

export async function fetchPlanFromUrl(url: string): Promise<Plan> {
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) throw new Error('Plan fetch failed')
    return await res.json() as Plan
  } catch {
    return PLAN_FALLBACK
  }
}

// Legacy export — used as fallback
export async function fetchPlan(): Promise<Plan> {
  return fetchPlanFromUrl(DEFAULT_GIST_URL)
}

// Fetch plan for a user: plans table → gist_url auto-migrate → plan_json auto-migrate → EMPTY_PLAN.
// Auto-migration is fire-and-forget: existing users' plans move to Supabase on first load.
export async function fetchPlanForUser(
  userId: string,
  supabase: SupabaseClient,
  opts: { gistUrl?: string | null; legacyPlanJson?: Plan | null } = {}
): Promise<Plan> {
  const { data: planRow } = await supabase
    .from('plans')
    .select('plan_json')
    .eq('user_id', userId)
    .single()

  if (planRow?.plan_json) return planRow.plan_json as Plan

  // OPS-01: these migrate-on-read saves are fire-and-forget, but a throw must
  // not become an unhandled rejection (this module is isomorphic — imported by
  // client components — so it can't use the service-role recordOpsEvent; the
  // daily integrity probe backstops the resulting stale state). Surface it.
  if (opts.gistUrl) {
    const plan = await fetchPlanFromUrl(opts.gistUrl)
    if (plan.weeks.length > 0) {
      void savePlanForUser(userId, plan, supabase).catch((err) =>
        console.error('[fetchPlanForUser] gist auto-save failed', err))
      return plan
    }
  }

  if (opts.legacyPlanJson && (opts.legacyPlanJson as Plan).weeks?.length > 0) {
    void savePlanForUser(userId, opts.legacyPlanJson, supabase).catch((err) =>
      console.error('[fetchPlanForUser] legacy auto-save failed', err))
    return opts.legacyPlanJson
  }

  return EMPTY_PLAN
}

export async function savePlanForUser(
  userId: string,
  plan: Plan,
  supabase: SupabaseClient
): Promise<void> {
  // SAVE-VALIDATE-01 (2026-09-19) — THE LAST GATE BEFORE THE DATABASE.
  //
  // Nine mutation routes call this function and NONE of them validated.
  // Only `generate-plan` and `adjust-plan` did, leaving `post-race-reshape`
  // (+confirm/revert), `recalibrate-zones`, `recalibrate-taper`,
  // `maintenance-block`, `confirm-adjustment` and `revert-adjustment` writing
  // unchecked, with `ops/plan-audit` — a DAILY cron — as the only net. That
  // DETECTS rather than prevents, so an invalid plan could be live 24 hours.
  //
  // Here rather than on the routes: one owner covers every current writer and
  // every future one. Nine copies of one rule is a D-08 violation whose tenth
  // copy is the one somebody forgets.
  //
  // ⚠️ NEVER BLOCKS A SAVE IN PRODUCTION. A runner whose reshape fails to
  // persist is worse off than a runner holding a plan with a violation in it,
  // and the daily audit still sweeps. This turns 24 hours into minutes.
  // It throws only under NODE_ENV=test, where we control the inputs — the same
  // split `generateRulePlan` already uses.
  //
  // ⚠️ GATED ON `generator_input`, WHICH IS A REAL LIMITATION AND IS MEASURED.
  // `validatePlan` needs the input the plan was built from. Generated plans
  // stamp it (17 keys, survives the JSON round trip through `plan_json`), but
  // legacy plans predate it and are skipped rather than guessed at. Measured
  // across the whole test suite: 8 saves, ALL skipped for want of it — so this
  // check is inert in tests except where a test supplies it deliberately, and
  // `planSaveValidate.test.ts` is that test.
  //
  // ⚠️ BUNDLE COST, MEASURED, SO NOBODY RE-LITIGATES IT. `savePlanForUser` is
  // imported by `DashboardClient`, a CLIENT component, so these static imports
  // pull the 7,018-line invariants module and Zod toward the dashboard bundle.
  // That looks alarming and is not: /dashboard First Load JS is 346 kB with
  // static imports and 345 kB with both behind `await import()`. ONE kB —
  // because the client already imports twelve `lib/plan/*` modules directly
  // (`generationConfig`, `maintenance`, `sessionComposer` among them), so the
  // dependency graph is almost entirely present already. The lazy version was
  // built and measured before being reverted: it bought a rounding error and
  // cost a dynamic import in a hot path.
  const generatorInput = plan?.meta?.generator_input
  if (generatorInput && plan.weeks?.length) {
    const errors = validatePlan(plan, generatorInput).filter(v => v.severity === 'error')
    if (errors.length) {
      const detail = {
        count: errors.length,
        codes: Array.from(new Set(errors.map(v => v.code))).slice(0, 8),
        first: errors[0]?.message?.slice(0, 200) ?? null,
        weeks: plan.weeks.length,
      }
      if (process.env.NODE_ENV === 'test') {
        throw new Error(`savePlanForUser: refusing to persist an invalid plan in test — ${detail.codes.join(', ')}`)
      }
      void recordOpsEvent('plan_save_invalid', detail, userId)
    }
  }

  // SCHEMA-LIVE-01 (2026-09-19) — run the CANONICAL SCHEMA on the live path.
  //
  // `lib/plan/schema.ts` opens by declaring itself the "single source of runtime
  // validation for plan JSON", "shared by the rule engine (R23), enricher (R23),
  // reshaper (R20), and multi-race (R24)". Four declared consumers. `PlanSchema`
  // had ONE — a conformance test written the same day as this — and had never
  // been run against live engine output in the repo's history. PHASE-EMPTY-01
  // hid in exactly that gap: the engine emitted a shape its own canonical schema
  // rejected, and no code path existed that would have noticed.
  //
  // ⚠️ IT NEVER THROWS, IN ANY ENVIRONMENT, TEST INCLUDED — deliberately unlike
  // the `validatePlan` block above. The schema is a DESCRIPTION of the plan
  // shape, not the constitution; it has drifted from the engine once already,
  // and a throwing check would then refuse real runners for drift rather than
  // for defects. `validatePlan` is the rule with teeth. This is the smoke alarm.
  //
  // ⚠️ SO ITS LIVENESS CANNOT COME FROM A THROW. It is proved two ways instead:
  // `planSchemaConformance.test.ts` asserts `PlanSchema.safeParse` directly on
  // generated plans, and `planSaveValidate.test.ts` spies on `recordOpsEvent` to
  // prove THIS call site fires on a non-conforming plan. A check whose only
  // evidence is that it never complained is the failure class this repo keeps
  // finding under a green tick.
  //
  // Cost measured before wiring: 0.22 ms per parse on a 20-week marathon plan.
  const shape = PlanSchema.safeParse(plan)
  if (!shape.success) {
    void recordOpsEvent('plan_schema_drift', {
      issues: shape.error.issues.length,
      paths: Array.from(new Set(shape.error.issues.map(i => i.path.join('.')))).slice(0, 8),
      first: shape.error.issues[0]?.message?.slice(0, 200) ?? null,
      weeks: plan?.weeks?.length ?? 0,
    }, userId)
  }
  // Plan history (data protection + the Me → Plan history screen): archive the
  // CURRENTLY-stored plan before it's overwritten. Centralised HERE so every
  // mutation path archives consistently — previously only the wizard's
  // handlePlanSaved did, so reshapes, recalibrations, adjustments and the
  // maintenance block all silently bypassed it and history stayed near-empty.
  //
  // Archive only on a RACE-IDENTITY change. Same-race mutations (reshape,
  // recalibrate, sub-threshold auto-apply, the appended maintenance block) must
  // NOT create near-duplicate "Race to Stones · replaced today" rows — the
  // history screen is race-labelled, so that would be pure noise. A genuinely new
  // race plan replacing a prior one is what belongs in history.
  const { data: priorRow } = await supabase
    .from('plans')
    .select('plan_json')
    .eq('user_id', userId)
    .maybeSingle()
  const prior = priorRow?.plan_json as Plan | undefined
  if (prior && (prior.weeks?.length ?? 0) > 0) {
    const priorSig = `${prior.meta?.race_name ?? ''}|${prior.meta?.race_date ?? ''}`
    // PLAN-WEEK-COLLISION-01 — the race-identity test now has ONE owner
    // (`isRaceIdentityChange`), shared with the supersede stamp below. It was
    // written out by hand here as a `priorSig !== nextSig` comparison, and a
    // second copy of that rule is how the archive and the stamp would drift:
    // a plan archived without its rows stamped is precisely this defect
    // returning. Same D-16 class as the tier ladder (three copies) and the
    // deload cadence (five). `priorSig` survives because the archive
    // idempotency check below matches on it.
    if (isRaceIdentityChange(prior.meta, plan.meta)) {
      // Idempotency (ADR-013 follow-on): the race→maintenance handoff fired
      // savePlanForUser 3× near-simultaneously and archived the SAME completed
      // race plan 3× — every concurrent read saw the pre-handoff plan before any
      // upsert landed. Skip if an identical prior snapshot was already archived
      // in the last few minutes: dedupes the handoff burst without blocking a
      // genuine re-archive of the same-named race months later. (Residual: two
      // truly simultaneous callers can still race between this SELECT and the
      // INSERT — the only airtight fix is a unique index, deferred to avoid a
      // migration; the recency window closed the observed 140–350ms burst.)
      const RECENT_ARCHIVE_WINDOW_MS = 10 * 60_000
      const since = new Date(Date.now() - RECENT_ARCHIVE_WINDOW_MS).toISOString()
      const { data: recent } = await supabase
        .from('plan_archive')
        .select('race_name, race_date')
        .eq('user_id', userId)
        .gte('archived_at', since)
      const alreadyArchived = (recent ?? []).some(
        (r: any) => `${r.race_name ?? ''}|${r.race_date ?? ''}` === priorSig
      )
      if (!alreadyArchived) {
        // N-015: don't silently swallow a SOR-adjacent write. Archiving is
        // best-effort relative to the primary upsert below (it must never block a
        // plan save), so log — don't throw — but make failure visible, never an
        // unhandled rejection.
        const archiveRes = await supabase.from('plan_archive').insert({
          user_id: userId,
          plan_json: prior,
          race_name: prior.meta?.race_name ?? null,
          race_date: prior.meta?.race_date ?? null,
        })
        if (archiveRes.error) {
          console.error(`[savePlanForUser] plan_archive insert failed — ${archiveRes.error.message}`)
        }
      }

      // PLAN-WEEK-COLLISION-01 — stamp the outgoing plan's week-keyed rows.
      //
      // `week_n` is a WITHIN-PLAN coordinate that five tables use as a
      // cross-plan key, and a new race plan restarts `week.n` at 1 — so without
      // this, the new plan inherits the old plan's completions, run analyses,
      // day-swaps, metric overrides and reflections. Measured on production
      // 2026-09-18: a fresh 12-week 10K plan arrived 94% pre-completed, five
      // sessions linked to runs from five months earlier.
      //
      // DELIBERATELY OUTSIDE the `alreadyArchived` guard. That guard dedupes a
      // burst of identical archive writes; the stamp is idempotent on its own
      // (it filters `superseded_at IS NULL`), and skipping it because an archive
      // row already existed is how a plan ends up archived with its rows live.
      //
      // THROWS on failure, matching the `plan_weekly_notes` invalidation twenty
      // lines below. That one throws because "a cached note narrating sessions
      // that no longer exist is brand-destroying" — these rows ARE the sessions
      // that note was narrating, and a silent failure here is the defect itself.
      await supersedeWeekKeyedRows(userId, supabase)
    }
  }

  // RESHAPE-FIX-WAVE1 (Defect 9): surface upsert errors. Prior code awaited
  // the upsert without checking `.error`, so RLS rejections, schema issues,
  // and constraint failures landed silently. The reshape engine then
  // believed it had persisted state that the DB never accepted. Throw so the
  // caller route surfaces a 500; better a visible failure than a phantom
  // success that corrupts downstream coaching reads.
  const upsertRes = await supabase
    .from('plans')
    .upsert(
      { user_id: userId, plan_json: plan, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
  if (upsertRes.error) {
    throw new Error(`savePlanForUser: plan upsert failed — ${upsertRes.error.message}`)
  }

  // PLAN-VOICE-AI: invalidate cached weekly notes whenever the plan changes.
  // Reshapes, confirmed adjustments, reverts, recalibrations, and full
  // regenerations all flow through here — a cached note narrating sessions
  // that no longer exist is brand-destroying, so invalidation is en bloc and
  // the route regenerates lazily on next Plan-screen view.
  const deleteRes = await supabase.from('plan_weekly_notes').delete().eq('user_id', userId)
  if (deleteRes.error) {
    throw new Error(`savePlanForUser: weekly-notes invalidation failed — ${deleteRes.error.message}`)
  }

  // GTM-CHARITY-04 — a comped charity runner's grant runs to race day + 7, and
  // the race date only exists once a plan does. Re-anchored HERE rather than in
  // the wizard route so every path that can set a race date is covered (wizard,
  // reshape, recalibration, maintenance handoff) and the next new route cannot
  // silently miss it. No-op and one indexed read for everyone without a grant,
  // which is almost everyone. Never throws: a grant date is not worth failing a
  // plan save over.
  await reanchorCharityGrant(userId, plan.meta?.race_date, supabase)
}

// ─── ADR-016 date-aware resolution ──────────────────────────────────────────
// Defined in `lib/plan/weekResolution.ts`, a LEAF module with no persistence
// imports, and re-exported here so every existing `@/lib/plan` import keeps
// working. See that file for why the split exists. Client components should
// import from the leaf directly — coming through this barrel re-attaches the
// invariants engine and the zod schema to their bundle.
export {
  parseLocalDate,
  getCurrentWeek,
  getCurrentWeekIndex,
  getWeekIndexForDate,
  getWeeksToRace,
  isDateWithinWeek,
  isDatePastWeek,
  findWeekByN,
  isPlanComplete,
  isDateBeforePlan,
  dayKeyForDate,
  getSessionForDate,
  type ResolvedSession,
} from './plan/weekResolution'
