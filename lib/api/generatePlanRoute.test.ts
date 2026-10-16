/**
 * ROUTE-E2E-GENERATE-01 — `POST /api/generate-plan`, walked end to end.
 *
 * 🔴 WHY THIS EXISTS. `ENGINE-ENTRY-01` (`1c10f90d`) put the engine behind one door
 * and left a residual it named in the backlog: **nothing walked the route.** `tsc`
 * catches a new `EngineOutcome` kind at the destructure, `engineOutcomeHandled.test.ts`
 * catches an unhandled branch, and `runEngine` is covered as a pure function — but no
 * test had ever executed `auth → tier → guard → the route's own gates → the engine →
 * the response`.
 *
 * ⚠️ AND `verify:parity` CANNOT STAND IN FOR ONE. It calls `generateRulePlan` at five
 * sites and never `composePlanWithFoundation` or `runEngine`, so IDENTICAL proves the
 * engine was not disturbed, not that the route still behaves the same. It would have
 * come back IDENTICAL on `FOUNDATION-META-ALIAS-01` — a real 30-day defect that lived
 * entirely in the composition path and cost every delayed-start free runner CA-01's
 * intro card. That case is arm E8 below, asserted on the route's actual JSON.
 *
 * ── WHAT IS DOUBLED, AND WHY EACH ONE ────────────────────────────────────────────
 * Four mocks, every one at a genuine IO boundary. Everything else is the real thing:
 * `getUserTier` → `resolveTier`, `getUserDisplayPrefs`, `guardAiRequest`'s body read,
 * `resolveAthleteFirstName`, the route-local `validate()`, `canGenerateDistance`,
 * `runEngine`, `recordOpsEvent`'s writes, the first-plan count, the NDJSON stream and
 * the `waitUntil` chain all execute.
 *
 *   · `@supabase/supabase-js`  — ONE fake `createClient` serves every caller: tier
 *     resolution, display prefs, the athlete's name, the first-plan count, the ops
 *     writes and the enriched-plan persist. Faking the client rather than each module
 *     is what keeps those modules real.
 *   · `getUserFromRequest`     — token validation is Supabase's, not this route's. The
 *     route's job is what it does with the ANSWER, which is arm B1.
 *   · `enrich` / `freeIntro`   — both call Anthropic. Mocked ALWAYS, never left to
 *     fail on an absent `ANTHROPIC_API_KEY`: a test that passes because a key is
 *     missing makes a real API call on a machine that has one.
 *
 * ⚠️ IF A MOCK EVER FAILS TO INTERCEPT, THIS FILE GOES RED, NOT QUIETLY GREEN. The
 * real `getUserFromRequest` returns no user without a Supabase session, so the route
 * answers 401 and every arm below fails. The harness arm (A) proves the double
 * positively rather than relying on that.
 *
 * ── WHAT THIS DOES NOT PROVE ─────────────────────────────────────────────────────
 *   · **No Postgres.** The double speaks PostgREST's shapes, not its semantics: RLS,
 *     constraints, triggers and real `count` behaviour are outside it. `vitest.config.ts`
 *     is `environment: 'node'`, and this repo has twice recorded that a test needing live
 *     credentials does not run in CI, which is the same as not existing.
 *   · **Not the platform.** `waitUntil` has no request context here, so it throws and the
 *     route's guard catches it — which is the degraded path, exercised, not the Vercel one.
 *   · **The 500 branch is reached through the I/O, not the engine.** A genuine engine fault
 *     needs an input that makes `generateRulePlan` throw something `isDesignedRefusal`
 *     rejects, and I have none that is not a fiction. So arm H1 makes a TABLE READ throw
 *     (`S.crashTable`), which reaches the same outer catch from the `tier` stage.
 *   · **Not the rate limiter.** The fake's `rpc` returns `true`; `checkAiRateLimit` fails
 *     OPEN, so a broken double would admit requests for the wrong reason. The 429 path is
 *     `lib/ai/guardAiRequest.test.ts`'s, deliberately.
 *   · **Not the client.** The frames are read with `readPlanStream`, the real consumer, but
 *     what `GeneratePlanScreen` does with them is its own.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readPlanStream } from '@/lib/planStream'
import { nextMonday, formatDate } from '@/lib/plan/length'
import type { Plan } from '@/types/plan'

const UID = 'u1'

// ─── The test's own mutable state, hoisted above the mock factories ─────────────
const S = vi.hoisted(() => ({
  /** Rows, keyed by table. The whole database. */
  store: {} as Record<string, Record<string, unknown>[]>,
  user: null as { id: string } | null,
  /** CA-01's intro line, or null for the silent-fallback case. */
  freeIntro: null as string | null,
  /** A deferred the test opens to let a gated `enrich()` return — see arm F14.
   *  Created BEFORE the request, never inside the mock: a gate the mock installs
   *  only exists once `enrich` has been reached, so opening it a microtask early
   *  would arm it against nobody and hang the stream. */
  gate: null as null | { wait: Promise<void>; open: () => void },
  /** Every plan `enrich()` was handed, so §57 can be asserted on the real argument. */
  enrichSaw: [] as Plan[],
  freeIntroSaw: [] as Plan[],
  /** GENERATE-500-NO-TRACE-01 — a table whose reads THROW, to drive the route into its
   *  real outer catch. A fault in the I/O, not a fiction about the engine. */
  crashTable: null as string | null,
}))

/**
 * Minimal PostgREST double — the same local-and-explicit pattern as
 * `fetchRunAnalysis.test.ts`'s `fakeSupabase`, widened to be table-keyed because this
 * route's reads span six tables through four different modules.
 *
 * Honours exactly what the route's callers use: `select` (with `{ count, head }`),
 * `insert`, `update`, `eq` and `maybeSingle`, and is awaitable directly for the
 * callers that never narrow to one row.
 */
function fakeTable(name: string) {
  if (S.crashTable === name) throw new Error(`connection reset reading ${name}\nsecond line never stored`)
  const rows = () => (S.store[name] ??= [])
  const filters: [string, unknown][] = []
  let mode: 'select' | 'insert' | 'update' = 'select'
  let head = false
  let payload: Record<string, unknown> | null = null
  const matching = () => rows().filter(r => filters.every(([c, v]) => r[c] === v))
  const result = () => {
    if (mode === 'insert') { rows().push(payload!); return { data: null, error: null, count: 1 } }
    if (mode === 'update') {
      const hit = matching()
      for (const r of hit) Object.assign(r, payload)
      return { data: null, error: null, count: hit.length }
    }
    const m = matching()
    // `head: true` returns no rows and only a count — the first-plan probe's shape.
    return { data: head ? null : m, count: m.length, error: null }
  }
  const api: Record<string, unknown> = {
    select: (_cols?: string, opts?: { head?: boolean }) => { mode = 'select'; head = !!opts?.head; return api },
    insert: (row: Record<string, unknown>) => { mode = 'insert'; payload = row; return api },
    update: (row: Record<string, unknown>) => { mode = 'update'; payload = row; return api },
    eq: (c: string, v: unknown) => { filters.push([c, v]); return api },
    maybeSingle: () => {
      const r = result()
      const d = r.data as Record<string, unknown>[] | null
      // Real `maybeSingle` errors on more than one match. No read here is supposed to
      // find two, so reproducing it means a fixture mistake surfaces instead of hiding.
      if (d && d.length > 1) {
        return Promise.resolve({ data: null, error: { message: 'multiple rows returned' } })
      }
      return Promise.resolve({ ...r, data: d?.[0] ?? null })
    },
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      Promise.resolve(result()).then(res, rej),
  }
  return api
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (t: string) => fakeTable(t),
    // Explicit `true`: `checkAiRateLimit` fails OPEN, so a throwing double would
    // admit every request for a reason that has nothing to do with the limit.
    rpc: async () => ({ data: true, error: null }),
  }),
}))

vi.mock('@/lib/supabase/getUserFromRequest', () => ({
  getUserFromRequest: async () => S.user,
}))

vi.mock('@/lib/plan/freeIntro', () => ({
  generateFreeIntro: async (plan: Plan) => { S.freeIntroSaw.push(plan); return S.freeIntro },
}))

vi.mock('@/lib/plan/enrich', () => ({
  enrich: async (plan: Plan) => {
    S.enrichSaw.push(plan)
    if (S.gate) await S.gate.wait
    // A deep copy with no copy CHANGES: the enricher's output must not introduce an
    // invariant violation, or the route's revert ladder fires and `meta.enrichment`
    // reads 'applied_partial' — a different arm's subject, not this one's.
    return { plan: JSON.parse(JSON.stringify(plan)) as Plan, outcome: { status: 'applied' } }
  },
}))

// ─── Fixtures ──────────────────────────────────────────────────────────────────
/** A race `weeks` from next Monday, landing on a Sunday. Relative to the clock on
 *  purpose: a pinned date would start refusing on §44 as it aged. */
const raceIn = (weeks: number): string => {
  const start = nextMonday()
  return formatDate(new Date(start.getTime() + (weeks * 7 - 1) * 86_400_000))
}

/** A runner the engine builds for: half marathon, well inside every gate. */
const READY = {
  race_distance_km: 21.1, goal: 'finish',
  current_weekly_km: 30, longest_recent_run_km: 14, days_available: 4,
  training_age: '2y+', age: 38, injury_history: [],
  recent_quality_training: 'regular', hard_session_relationship: 'neutral',
} as const

const body = (over: Record<string, unknown> = {}) =>
  ({ ...READY, race_date: raceIn(20), ...over })

async function post(payload: unknown, opts: { raw?: string; auth?: boolean } = {}) {
  const { POST } = await import('@/app/api/generate-plan/route')
  const { NextRequest } = await import('next/server')
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  // The bearer token is what `createUserScopedClient` keys on, so prefs and the
  // athlete's name are only reachable with it — exactly as on a real request.
  if (opts.auth !== false) headers.Authorization = 'Bearer test-token'
  const req = new NextRequest('https://www.zonna.run/api/generate-plan', {
    method: 'POST', headers,
    body: opts.raw ?? JSON.stringify(payload),
  })
  return POST(req)
}

const events = () => (S.store.ops_events ?? []).map(r => String(r.kind))
const eventDetail = (kind: string) =>
  (S.store.ops_events ?? []).find(r => r.kind === kind)?.detail as Record<string, unknown> | undefined

beforeEach(() => {
  for (const k of Object.keys(S.store)) delete S.store[k]
  S.store.user_settings = [{ id: UID, first_name: 'Sam', preferred_units: 'km', trial_started_at: null, is_admin: false }]
  S.store.subscriptions = []
  S.store.charity_codes = []
  S.store.plans = []
  S.store.ops_events = []
  S.user = { id: UID }
  S.crashTable = null
  S.freeIntro = null
  S.gate = null
  S.enrichSaw = []
  S.freeIntroSaw = []
})

/** Hold `enrich()` until the test says go, so F14's ordering is asserted rather
 *  than left to the event loop. */
function armEnrichGate() {
  let open!: () => void
  const wait = new Promise<void>(resolve => { open = resolve })
  S.gate = { wait, open }
  return open
}

/** A live subscription — the route's paid path. */
const subscribe = () => S.store.subscriptions.push({
  user_id: UID, status: 'active',
  current_period_end: new Date(Date.now() + 30 * 86_400_000).toISOString(),
})

// ═══ A — the harness itself ═════════════════════════════════════════════════════
describe('A — the double reproduces the reads the route depends on', () => {
  /**
   * 🔴 THE ARM EVERY OTHER ARM RESTS ON. A fake that silently returns nothing makes
   * a 401 look like a tier bug and makes `{ count: 0 }` look like a first plan. This
   * repo's recorded failure is a check that passes for a reason other than its name,
   * so the double is proven POSITIVELY here rather than inferred from the fifteen green arms
   * below it.
   */
  it('A1 — serves every shape the route asks for, through the mocked client', async () => {
    const { createClient } = await import('@supabase/supabase-js')
    const sb = createClient('url', 'key') as unknown as {
      from: (t: string) => any
      rpc: (n: string) => Promise<{ data: unknown }>
    }

    // getUserTier's three reads
    expect((await sb.from('user_settings').select('is_admin').eq('id', UID).maybeSingle()).data)
      .toMatchObject({ first_name: 'Sam' })
    expect((await sb.from('subscriptions').select('status').eq('user_id', UID).maybeSingle()).data).toBeNull()
    expect((await sb.from('charity_codes').select('expires_at').eq('claimed_by', UID).maybeSingle()).data).toBeNull()

    // the first-plan probe: head + exact count
    expect((await sb.from('plans').select('*', { count: 'exact', head: true }).eq('user_id', UID)).count).toBe(0)
    S.store.plans.push({ user_id: UID, plan_json: { meta: {} } })
    expect((await sb.from('plans').select('*', { count: 'exact', head: true }).eq('user_id', UID)).count).toBe(1)

    // the ops write, and the update the persist backstop makes
    await sb.from('ops_events').insert({ kind: 'probe', user_id: UID, detail: {} })
    expect(events()).toEqual(['probe'])
    await sb.from('plans').update({ plan_json: { meta: { enrichment: 'applied' } } }).eq('user_id', UID)
    expect((S.store.plans[0].plan_json as { meta: { enrichment: string } }).meta.enrichment).toBe('applied')

    // the limiter — explicitly allowed, because it fails open
    expect((await sb.rpc('check_rate_limit')).data).toBe(true)
  })

  it('A2 — filters by the column it was given, so a wrong user id reads as absent', async () => {
    const { createClient } = await import('@supabase/supabase-js')
    const sb = createClient('url', 'key') as unknown as { from: (t: string) => any }
    expect((await sb.from('user_settings').select('*').eq('id', 'someone-else').maybeSingle()).data).toBeNull()
  })
})

// ═══ B — auth and the input boundary ════════════════════════════════════════════
describe('B — auth and the input boundary, before anything else', () => {
  it('B1 — no user: 401, and the engine never ran', async () => {
    S.user = null
    const res = await post(body())
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
    // Nothing downstream of auth may leave a trace. An ops row here would mean a
    // gate ran for an unauthenticated caller.
    expect(events()).toEqual([])
  })

  it('B2 — a malformed body never reaches the engine: 400 Invalid JSON', async () => {
    const res = await post(null, { raw: '{ not json' })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'Invalid JSON' })
    expect(events()).toEqual([])
  })

  it('B3 — auth outranks the body: an unauthenticated malformed request is 401, not 400', async () => {
    S.user = null
    const res = await post(null, { raw: '{ not json' })
    expect(res.status).toBe(401)
  })
})

// ═══ C — the ORDER of the route's own gates ═════════════════════════════════════
describe('C — the gate ORDER, which is load-bearing and was unasserted', () => {
  /**
   * 🔴 THE ORDERING, STATED. `validate()` (days_available < 2) runs BEFORE
   * `canGenerateDistance`, so a 1-day marathon request on free tier is answered 422
   * "At least 2 training days per week are required." and NOT 403 "That distance needs
   * a subscription."
   *
   * ⚠️ WHY IT MATTERS RATHER THAN BEING TRIVIA. `lib/plan/engine.ts`'s header names
   * this as the reason `validate()` stayed in the route when the rest of the
   * synchronous path moved out — and a refactor that hoisted the commercial gate above
   * the input check would flip it with no test, no type error and no visible symptom:
   * the runner is refused either way. The 403 also WRITES
   * `plan_distance_gate_blocked`, so the flip would quietly contaminate the only
   * measurement of who the paywall turns away.
   */
  it('C4 — a 1-day marathon on FREE is 422 on days, never the 403 paywall', async () => {
    const res = await post(body({ race_distance_km: 42.2, days_available: 1, race_date: raceIn(30) }))
    expect(res.status).toBe(422)
    expect(await res.json()).toEqual({ error: 'At least 2 training days per week are required.' })
    // The paywall's own evidence: it must not have recorded a block.
    expect(events()).not.toContain('plan_distance_gate_blocked')
    // GENERATE-500-NO-TRACE-01 — and the refusal itself is now on the record.
    expect(eventDetail('plan_input_refused')).toEqual({ field: 'days_available', race_distance_km: 42.2 })
  })

  it('C5 — the same marathon with enough days IS the 403, with its ops row', async () => {
    const res = await post(body({ race_distance_km: 42.2, days_available: 5, race_date: raceIn(30) }))
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({
      error: 'That distance needs a subscription.',
      reason: 'paid_distance',
      race_distance_km: 42.2,
    })
    expect(events()).toContain('plan_distance_gate_blocked')
    expect(eventDetail('plan_distance_gate_blocked')).toMatchObject({ tier: 'free', race_distance_km: 42.2 })
  })

  it('C6 — a COMPED charity runner gets the marathon, not the 403', async () => {
    // TIER-OWNER-01's order through the real `resolveTier`: a grant resolves to `paid`
    // before the trial arm is reached, so a Make-A-Wish runner meets no gate here.
    // `distancePaywall.test.ts` composes this from pure functions; this walks the route.
    S.store.charity_codes.push({
      claimed_by: UID, expires_at: new Date(Date.now() + 80 * 86_400_000).toISOString(),
    })
    const res = await post(body({
      race_distance_km: 42.2, days_available: 5, current_weekly_km: 45,
      longest_recent_run_km: 22, race_date: raceIn(24),
    }))
    expect(res.status).toBe(200)
    expect(events()).not.toContain('plan_distance_gate_blocked')
    // Comped runners are paid, so they stream — proof the tier reached the tier branch
    // and not merely the distance gate.
    expect(res.headers.get('Content-Type')).toContain('application/x-ndjson')
  })
})

// ═══ D — a designed refusal, including the write only the route does ════════════
describe('D — a designed refusal crosses the seam and is recorded', () => {
  /**
   * `runEngine` computes the 422 body and the telemetry payload; writing the row is
   * the CALLER's (ADR-003 keeps the service-role client out of `lib/plan`). The engine
   * side is covered by `longRunReadiness.test.ts` and `levelResolution.test.ts`.
   * **Nothing asserted the route actually performs the write** — which is the half that
   * `REFUSAL-TELEMETRY-01` exists for and the half a refactor can drop silently.
   */
  it('D7 — §111 refuses, 422 carries base_volume, and the ops row lands', async () => {
    subscribe()  // paid, so the distance gate is not what answers
    const res = await post(body({
      race_distance_km: 42.2, current_weekly_km: 8, longest_recent_run_km: 6,
      days_available: 4, training_age: '<6mo', recent_quality_training: 'none',
      race_date: raceIn(26),
    }))
    expect(res.status).toBe(422)
    const json = await res.json() as Record<string, unknown>
    expect(json.reason).toBe('base_volume')
    expect(json.base).toBeDefined()

    expect(events()).toContain('plan_refused_by_design')
    const detail = eventDetail('plan_refused_by_design')!
    // Matched on the rule NAME, never the message — REFUSAL-COPY-02 recorded a tone
    // rewrite breaking four checks across three files.
    expect(detail.rule).toBe('BaseVolumeError')
    expect(detail.race_distance_km).toBe(42.2)
    // REFUSAL-TELEMETRY-LEVEL-01 — the five level fields, through the route.
    expect(Object.keys(detail)).toContain('fitness_level_assessed')
    expect(Object.keys(detail)).toContain('fitness_level_structural')
  })
})

// ═══ E — the free path, and the defect parity could not see ═════════════════════
// ═══ H — GENERATE-500-NO-TRACE-01: a failure leaves a record ═══════════════════════
describe('H — a failed or refused generation is on the record, so it cannot look like "never tried"', () => {
  it('🔴 H1 — a crash is still 500 to the runner, and now writes plan_generate_failed with its stage', async () => {
    S.crashTable = 'subscriptions'   // getUserTier's first read
    const res = await post(body())
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'Unexpected error' })
    S.crashTable = null
    const d = eventDetail('plan_generate_failed')
    expect(d, 'a crash left no trace again').toBeDefined()
    expect(d).toMatchObject({ stage: 'tier', error_name: 'Error', message: 'connection reset reading subscriptions', tier: null })
    // First line only: a stack or a multi-line provider error must not land in the ledger.
    expect(String(d!.message)).not.toContain('second line')
    // Attributed to the verified caller, so the funnel can be read per runner.
    expect((S.store.ops_events ?? []).find(r => r.kind === 'plan_generate_failed')?.user_id).toBe(UID)
  })

  it('H2 — a §55 refusal (no age) is 422 AND writes plan_input_refused naming the field, never its value', async () => {
    const res = await post(body({ age: undefined }))
    expect(res.status).toBe(422)
    expect(eventDetail('plan_input_refused')).toEqual({ field: 'age', race_distance_km: 21.1 })
  })

  it('H3 — a plan that builds records neither', async () => {
    const res = await post(body())
    expect(res.status).toBe(200)
    await res.text()
    expect(events()).not.toContain('plan_generate_failed')
    expect(events()).not.toContain('plan_input_refused')
  })
})

describe('E — the free path: CA-01 and GEN-FIX-02 on the plan the route RETURNS', () => {
  /**
   * 🔴 FOUNDATION-META-ALIAS-01, ASSERTED ON THE RESPONSE. The route stamped
   * `plan_intro` and `enrichment` on the foundation-FREE plan and returned the COMPOSED
   * one, relying on a shared `meta` reference that `FOUNDATION-LONG-RUNWAY-01` had
   * quietly stopped providing. For 30 days every DELAYED-START free runner lost CA-01's
   * intro — the single AI surface a free runner gets — and `meta.enrichment` was absent
   * on 76.6% of a uniform sweep, which is the declared denominator of `enrich-health`.
   *
   * ⚠️ `foundationMetaAlias.test.ts` already holds the OWNER (compose returns a fresh
   * meta) and reads the route's source for the stamp target. What it cannot do is
   * execute the route: its behavioural arm replays the route's order BY HAND. This arm
   * is the response body.
   */
  it('E8 — a free FIRST plan with a DELAYED start keeps plan_intro and enrichment: skipped', async () => {
    S.freeIntro = 'Sixteen weeks. The slow bits are the point.'
    // 50 weeks out against a ~16-week ideal: §76 delays the start rather than finishing
    // early, which is the case that produced a fresh `meta`.
    const res = await post(body({ race_date: raceIn(50) }))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('application/json')
    const { plan } = await res.json() as { plan: Plan }

    // The precondition, asserted rather than assumed: an arm that silently stopped
    // exercising the delayed-start path would still pass everything below.
    expect(
      plan.meta.plan_start! > formatDate(nextMonday()),
      `plan_start ${plan.meta.plan_start} is not delayed past next Monday — this arm no ` +
      'longer reaches the composition path FOUNDATION-META-ALIAS-01 lived in',
    ).toBe(true)

    expect(plan.meta.plan_intro, 'CA-01: the free runner\'s only AI surface').toBe(S.freeIntro)
    expect(plan.meta.enrichment, 'GEN-FIX-02: absent must mean "before this shipped"').toBe('skipped')
    expect(plan.meta.tier).toBe('free')
    // §57 — the intro is generated FROM the foundation-free plan and stamped ON the
    // composed one. Two different objects, which is the whole lesson of the defect.
    expect(S.freeIntroSaw).toHaveLength(1)
    expect(S.freeIntroSaw[0]).not.toBe(plan)
  })

  it('E9 — a free runner who already has a plan row gets no intro call at all', async () => {
    S.freeIntro = 'should never be used'
    S.store.plans.push({ user_id: UID, plan_json: { meta: { generated_at: 'old' } } })
    const res = await post(body({ race_date: raceIn(50) }))
    const { plan } = await res.json() as { plan: Plan }
    expect(S.freeIntroSaw, 'the first-plan probe found a row; the AI call must be skipped').toEqual([])
    expect(plan.meta.plan_intro).toBeUndefined()
    expect(plan.meta.enrichment).toBe('skipped')
  })

  it('E10 — a failed intro is silent (ADR-006): the plan still comes back whole', async () => {
    S.freeIntro = null
    const res = await post(body())
    expect(res.status).toBe(200)
    const { plan } = await res.json() as { plan: Plan }
    expect(plan.meta.plan_intro).toBeUndefined()
    expect(plan.meta.enrichment).toBe('skipped')
    expect(plan.weeks.length).toBeGreaterThan(0)
  })

  it('E11 — the athlete\'s name comes from the profile, not the body', async () => {
    // PROFILE-NAME-01 — resolved at the auth boundary and un-spoofable.
    const res = await post(body({ athlete_name: 'Spoofed' }))
    const { plan } = await res.json() as { plan: Plan }
    expect(plan.meta.athlete).toBe('Sam')
  })
})

// ═══ G — §118 / P-15, the third HTTP answer shape ══════════════════════════════
describe('G — accept_base_build returns JSON, not a stream', () => {
  /**
   * The route's third answer, and the only 200 that is neither the free JSON nor the
   * paid stream: a PAID runner who accepts the §118 offer gets `{ plan }` back
   * directly, with no enrichment and no foundation composition, because
   * `plan_kind: 'base_build'` is its own plan object judged by its own constitution.
   *
   * `engineOutcomeHandled.test.ts` proves the branch EXISTS and that the kind is
   * reachable; `refusalOffer.markup.test.ts` proves the engine produces it. Neither
   * can see the route answering with the wrong content type for it — which is what a
   * fall-through would do, silently, since the stream also returns 200.
   */
  it('G15 — a paid runner accepting the offer gets a base-build plan as JSON', async () => {
    subscribe()
    const res = await post(body({
      race_distance_km: 42.2, current_weekly_km: 8, longest_recent_run_km: 6,
      days_available: 4, training_age: '<6mo', recent_quality_training: 'none',
      race_date: raceIn(26),
      accept_base_build: true,
    }))
    expect(res.status).toBe(200)
    expect(
      res.headers.get('Content-Type'),
      'a base build must not fall through into the enrichment stream',
    ).toContain('application/json')
    const { plan } = await res.json() as { plan: Plan }
    expect(plan.meta.plan_kind).toBe('base_build')
    // No enrichment on this path at all — not 'skipped', not 'pending'.
    expect(S.enrichSaw).toEqual([])
    expect(S.freeIntroSaw).toEqual([])
  })
})

// ═══ F — the paid stream, read by its real consumer ═════════════════════════════
describe('F — the NDJSON stream, through readPlanStream', () => {
  it('F12 — two frames: rule_plan pending, then final_plan applied', async () => {
    subscribe()
    const res = await post(body())
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('application/x-ndjson; charset=utf-8')
    expect(res.headers.get('Cache-Control')).toBe('no-cache, no-transform')

    const frames: { type: string; plan: Plan }[] = []
    for await (const m of readPlanStream(res as unknown as Response)) frames.push(m)

    expect(frames.map(f => f.type)).toEqual(['rule_plan', 'final_plan'])
    // GEN-FIX-02's fingerprint, on the frame that actually carries it — the half
    // FOUNDATION-META-ALIAS-01 cost every delayed-start runner.
    expect(frames[0].plan.meta.enrichment).toBe('pending')
    expect(frames[1].plan.meta.enrichment).toBe('applied')
    expect(frames[1].plan.meta.tier).toBe('paid')

    // §57 — `enrich()` is handed the foundation-free plan, never the composed one.
    expect(S.enrichSaw).toHaveLength(1)
    expect(S.enrichSaw[0]).not.toBe(frames[0].plan)
  })

  it('F13 — nothing is persisted when the runner never saved (shouldServerPersist)', async () => {
    subscribe()
    const res = await post(body())
    for await (const _ of readPlanStream(res as unknown as Response)) { /* drain */ }
    expect(S.store.plans).toEqual([])
    expect(events()).not.toContain('plan_enrich_server_saved')
  })

  /**
   * 🔴 ENRICH-SERVER-SAVE-01, AS THE RACE IT EXISTS FOR. The runner taps "Use this
   * plan" on the `rule_plan` frame and locks the phone; the enricher resolves ~30 s
   * later and the SERVER must write the enriched copy over the row. Observed on a real
   * trial plan: saved 5 s after generation, never written again.
   *
   * ⚠️ DETERMINISTIC, NOT TIMED. `enrich()` waits on a gate this test opens after
   * seeding the row, so the ordering is the one being asserted rather than whatever the
   * event loop happened to do.
   */
  it('F14 — a row saved mid-stream IS overwritten with the enriched plan', async () => {
    subscribe()
    const openGate = armEnrichGate()
    const res = await post(body())

    const it2 = readPlanStream(res as unknown as Response)
    const first = await it2.next()
    expect(first.value!.type).toBe('rule_plan')

    // The client's own save, exactly as `handleUsePlan` writes it.
    S.store.plans.push({ user_id: UID, plan_json: first.value!.plan })
    expect((S.store.plans[0].plan_json as Plan).meta.enrichment).toBe('pending')

    openGate()                                // the enricher returns
    const second = await it2.next()
    expect(second.value!.type).toBe('final_plan')
    await it2.next()                          // let the stream close

    const stored = S.store.plans[0].plan_json as Plan
    expect(stored.meta.enrichment, 'the backstop never wrote: a persistent "pending" is the defect')
      .toBe('applied')
    expect(events()).toContain('plan_enrich_server_saved')
    expect(eventDetail('plan_enrich_server_saved')).toMatchObject({ enrichment: 'applied', tier: 'paid' })
  })
})
