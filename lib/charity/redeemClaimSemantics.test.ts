import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * GTM-CHARITY-07 — a seat is spent when it was CLAIMED, not while the claimant
 * still exists.
 *
 * THE DEFECT. `charity_codes.claimed_by` is `ON DELETE SET NULL` (verified
 * against production `pg_constraint`). Deleting an account nulled it while
 * leaving `claimed_at` and `expires_at` populated, and `/api/charity/redeem`
 * gated only on `claimed_by` — so the code **returned to the unclaimed pool
 * and became redeemable again by anyone holding it**. Two consequences: a
 * small abuse path (redeem, delete, re-redeem) and a batch redemption count
 * that drifts DOWN over a season, understating what the partnership delivered.
 *
 * ⚠️ NO MIGRATION, AND THAT IS THE DESIGN. The filing proposed adding
 * `released_at` or a `claim_state`. Neither is needed: `claimed_at` already
 * records exactly this fact and already survives deletion, because the foreign
 * key is on `claimed_by` alone. A new column would be a second answer to a
 * question the schema could already answer. `ON DELETE CASCADE` was rejected
 * too — deleting the code row would destroy the batch's own record that a seat
 * was used, which is the number the charity will ask about.
 *
 * ⚠️ BOTH PREDICATES HAD TO MOVE TOGETHER, and that is what this test mostly
 * exists to hold. The route gates twice: a read gate, and the `.is(...)`
 * predicate on the update that makes the claim atomic against two runners
 * racing the same code. Moving only the read gate would be WORSE than the
 * original bug — the refusal would then depend on which path a request took.
 */
const SRC = readFileSync(join(process.cwd(), 'app/api/charity/redeem/route.ts'), 'utf8')

describe('GTM-CHARITY-07 — the claim gate survives account deletion', () => {
  it('reads the real route, so the assertions cannot pass on an empty file', () => {
    expect(SRC).toMatch(/\bcharity_codes\b/)
    expect(SRC).toContain('already been used')
  })

  it('selects claimed_at, or the read gate has nothing to test', () => {
    expect(SRC).toMatch(/\.select\('id, claimed_by, claimed_at, batch_id/)
  })

  it('the read gate tests claimed_at, not claimed_by', () => {
    expect(SRC).toContain('if (row.claimed_at) {')
    expect(SRC).not.toContain('if (row.claimed_by) {')
  })

  it('the ATOMIC predicate tests claimed_at too — they must not disagree', () => {
    expect(SRC).toContain(".is('claimed_at', null)")
    expect(SRC).not.toContain(".is('claimed_by', null)")
  })

  it('still writes claimed_by, because the grant has to resolve to a user', () => {
    // The fix changes what counts as SPENT, not what the grant is attached to.
    // `resolveTier` reads the row by `claimed_by`; dropping it would make every
    // grant unresolvable, which is a far larger bug than the one being fixed.
    expect(SRC).toContain('claimed_by: user.id')
    expect(SRC).toContain('claimed_at: now.toISOString()')
  })
})
