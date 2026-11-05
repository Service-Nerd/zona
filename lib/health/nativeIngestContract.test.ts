import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { NATIVE_CREDENTIAL_KEY } from '@/lib/native/sharedStore'

// HK-NATIVE-BG-INGEST-01 — the cross-language seam.
//
// 🔴 WHY THIS EXISTS. There are now TWO producers of the
// `HealthKitWorkoutPayload` contract: `lib/health/clientSync.ts` in TypeScript
// and `HealthObserverPlugin.shellPayload` in Swift. The compiler sees neither
// side of that seam, and this repo's most expensive defects are exactly this
// shape — a second producer written months after the first, agreeing only by
// accident, drifting silently (SESSION-KM-01/02, TIER-OWNER-01,
// DELOAD-OWNER-01). A Swift misspelling would surface as a 422 on a background
// wake nobody is watching.
//
// So these arms read the REAL Swift source and the REAL TypeScript interface
// and compare them. They cannot prove the Swift compiles — that is
// `npm run typecheck:ios` — only that the two sides still describe the same
// payload, the same key and the same header.

const ROOT  = process.cwd()
const SWIFT = readFileSync(join(ROOT, 'ios/App/App/HealthObserverPlugin.swift'), 'utf8')
const STORE = readFileSync(join(ROOT, 'ios/App/App/SharedStorePlugin.swift'), 'utf8')
const ADAPT = readFileSync(join(ROOT, 'lib/health/adapter.ts'), 'utf8')
const ROUTE = readFileSync(join(ROOT, 'app/api/health/ingest/route.ts'), 'utf8')

/** Field names declared on the TS interface, split by optionality. */
function payloadFields(): { required: string[]; optional: string[] } {
  const body = ADAPT.split('export interface HealthKitWorkoutPayload {')[1]?.split('\n}')[0]
  if (!body) throw new Error('HealthKitWorkoutPayload not found — the parse, not the contract, is broken')
  const required: string[] = []
  const optional: string[] = []
  for (const line of body.split('\n')) {
    const m = /^\s{2}([A-Za-z_][A-Za-z0-9_]*)(\??):/.exec(line)
    if (!m) continue
    ;(m[2] === '?' ? optional : required).push(m[1])
  }
  return { required, optional }
}

/** Keys the Swift shell payload actually sends. */
function swiftPayloadKeys(): string[] {
  const block = SWIFT.split('let payload: [String: Any] = [')[1]?.split(']')[0]
  if (!block) throw new Error('Swift payload literal not found — the parse is broken')
  // A plain exec loop, not `[...matchAll]`: the repo's tsconfig target makes
  // spreading a RegExp iterator a TS2802.
  const keys: string[] = []
  const re = /"([A-Za-z_][A-Za-z0-9_]*)":/g
  let m: RegExpExecArray | null
  while ((m = re.exec(block)) !== null) keys.push(m[1])
  return keys
}

describe('native ingest ↔ HealthKitWorkoutPayload', () => {
  it('parses both sides (a silent parse failure would make every arm below vacuous)', () => {
    const { required } = payloadFields()
    expect(required.length).toBeGreaterThan(4)
    expect(swiftPayloadKeys().length).toBeGreaterThan(4)
  })

  // The real assertion: a REQUIRED field the Swift omits is a 422 on every
  // background wake, which is invisible without this.
  it('the Swift sends every REQUIRED field of the contract', () => {
    const { required } = payloadFields()
    const sent = new Set(swiftPayloadKeys())
    expect(required.filter(f => !sent.has(f))).toEqual([])
  })

  it('the Swift sends no field the contract does not declare', () => {
    const { required, optional } = payloadFields()
    const declared = new Set([...required, ...optional])
    expect(swiftPayloadKeys().filter(k => !declared.has(k))).toEqual([])
  })

  // Shell-only is a DECISION (HK-HR-LOCKED-DROPS-RUN-01: the run is the record,
  // HR is an enrichment). If HR ever appears in the Swift, the per-workout
  // sample cap has been duplicated and this arm should force that conversation.
  it('the Swift sends no heart rate — HR is the retry path’s job', () => {
    expect(swiftPayloadKeys()).not.toContain('hrSamples')
    expect(swiftPayloadKeys()).not.toContain('avgHeartRate')
    expect(swiftPayloadKeys()).not.toContain('maxHeartRate')
  })

  it('both sides agree on the Keychain key', () => {
    expect(SWIFT).toContain(`credentialKey = "${NATIVE_CREDENTIAL_KEY}"`)
    expect(NATIVE_CREDENTIAL_KEY).toBe('zonna_native_credential')
  })

  // The header the Swift sets must be the header the route reads, or the
  // telemetry is silently zero and the feature looks like it never ran.
  it('the header the Swift sets is the header the route reads', () => {
    expect(SWIFT).toContain('"X-Ingest-Path"')
    expect(SWIFT).toContain('"native"')
    expect(ROUTE).toContain(`req.headers.get('X-Ingest-Path') === 'native'`)
  })

  // 🔴 PHASE-2 BOUNDARY. The whole reason Phase 1 is safe is that native never
  // touches a refresh token. Held here so Phase 2 cannot arrive by accident.
  it('no native code mentions a refresh token', () => {
    expect(SWIFT).not.toMatch(/refresh_?[Tt]oken/)
    expect(STORE).not.toMatch(/refresh_?[Tt]oken/)
  })

  // The credential must be readable during a background wake, which is very
  // often a locked phone. `WhenUnlocked` would fail exactly then, and fail as a
  // nil read — indistinguishable from "signed out".
  it('the Keychain item is readable after first unlock, not only while unlocked', () => {
    // Word-anchored: a bare `toContain` of an identifier also passes against
    // `...AfterFirstUnlockX`, which `hollowTestShapes.test.ts` rightly caught
    // in the first cut of this arm.
    expect(STORE).toMatch(/\bkSecAttrAccessibleAfterFirstUnlock\b/)
    expect(STORE).not.toMatch(/\bkSecAttrAccessibleWhenUnlocked\b/)
  })
})
