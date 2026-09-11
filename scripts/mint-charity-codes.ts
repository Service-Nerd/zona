/**
 * GTM-CHARITY-04 — mint a capped batch of charity access codes.
 *
 *   npx tsx scripts/mint-charity-codes.ts "Make-A-Wish UK" 100
 *   npx tsx scripts/mint-charity-codes.ts "Make-A-Wish UK" 100 --notes "London 2027"
 *
 * Prints the codes as CSV on stdout, so handing them to a partner is:
 *
 *   npx tsx scripts/mint-charity-codes.ts "Partner" 100 > partner-codes.csv
 *
 * CAPPED BY DESIGN (Traynor, hard requirement). The count is an argument and it
 * is recorded on the batch: exposure is bounded and per-partner ROI is
 * measurable. There is no "unlimited" mode and there should not be one.
 *
 * Codes are minted with crypto randomness, not Math.random — these are bearer
 * tokens for a paid subscription, and a predictable sequence would let anyone
 * who redeems one derive the rest of the batch.
 *
 * Revoking a batch (stops UNCLAIMED codes; deliberately does not touch grants
 * already made, because clawing access back mid-block is the cliff the grant
 * design exists to avoid):
 *
 *   update charity_batches set revoked_at = now() where id = '<batch id>';
 */

import { randomInt } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { mintCode, normaliseCode, formatCode } from '../lib/charity/code'

const MAX_CAP = 1000   // a typo in the count should not mint ten thousand codes

async function main() {
  const [partner, capRaw, ...rest] = process.argv.slice(2)
  const notesIdx = rest.indexOf('--notes')
  const notes = notesIdx >= 0 ? rest[notesIdx + 1] ?? null : null

  if (!partner || !capRaw) {
    console.error('Usage: npx tsx scripts/mint-charity-codes.ts "<partner name>" <count> [--notes "..."]')
    process.exit(2)
  }
  const cap = Number(capRaw)
  if (!Number.isInteger(cap) || cap < 1 || cap > MAX_CAP) {
    console.error(`Count must be a whole number between 1 and ${MAX_CAP}. Got: ${capRaw}`)
    process.exit(2)
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.')
    process.exit(2)
  }
  const supabase = createClient(url, key)

  const { data: batch, error: batchErr } = await supabase
    .from('charity_batches')
    .insert({ partner_name: partner, cap, notes })
    .select('id')
    .single()
  if (batchErr || !batch) {
    console.error('Could not create batch:', batchErr?.message)
    process.exit(1)
  }

  // Crypto-random, and de-duplicated in memory before insert. The unique index
  // on `code` is the real guarantee; this just avoids a pointless round trip.
  const secureRandom = () => randomInt(0, 1_000_000) / 1_000_000
  const seen = new Set<string>()
  const rows: { batch_id: string; code: string }[] = []
  const display: string[] = []

  while (rows.length < cap) {
    const pretty = mintCode(secureRandom)
    const stored = normaliseCode(pretty)!
    if (seen.has(stored)) continue
    seen.add(stored)
    rows.push({ batch_id: batch.id, code: stored })
    display.push(formatCode(stored))
  }

  const { error: insErr } = await supabase.from('charity_codes').insert(rows)
  if (insErr) {
    console.error('Could not insert codes:', insErr.message)
    console.error(`Batch ${batch.id} was created but is EMPTY — delete it or re-run.`)
    process.exit(1)
  }

  // CSV to stdout, progress to stderr, so a `>` redirect captures only codes.
  console.error(`Minted ${cap} codes for "${partner}" (batch ${batch.id})`)
  console.log('code')
  for (const c of display) console.log(c)
}

main().catch(err => { console.error(err); process.exit(1) })
