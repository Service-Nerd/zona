/**
 * GTM-CHARITY-04 — inspect a charity code. READ ONLY, writes nothing.
 *
 *   npx tsx scripts/check-charity-code.ts ZONNA-4K7M-9PQR
 *   npx tsx scripts/check-charity-code.ts            # summarise every batch
 *
 * WHY THIS EXISTS. Redeeming a code on an `is_admin` account proves nothing:
 * getUserTier resolves admin -> paid BEFORE it reaches the grant, so the app
 * looks identical whether the redemption landed or silently failed. That is the
 * same shape as the RevenueCat webhook bug found earlier the same day, which
 * acknowledged comp events and wrote nothing. This reads the row directly, so
 * "did it actually work?" has an answer that does not depend on what the UI
 * happens to show.
 */

import { resolve } from 'node:path'
import { loadEnvConfig } from '@next/env'
import { createClient } from '@supabase/supabase-js'
import { normaliseCode, formatCode } from '../lib/charity/code'

loadEnvConfig(resolve(__dirname, '..'))

function when(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const days = Math.round((d.getTime() - Date.now()) / 86_400_000)
  return `${d.toISOString().slice(0, 10)} (${days >= 0 ? `${days}d away` : `${-days}d ago`})`
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.')
    process.exit(2)
  }
  const supabase = createClient(url, key)
  const arg = process.argv[2]

  if (!arg) {
    const { data: batches, error } = await supabase
      .from('charity_batches')
      .select('id, partner_name, cap, revoked_at, created_at')
      .order('created_at', { ascending: false })
    if (error) { console.error(error.message); process.exit(1) }
    if (!batches?.length) { console.log('No batches yet.'); return }

    for (const b of batches) {
      const { count: total } = await supabase.from('charity_codes')
        .select('*', { count: 'exact', head: true }).eq('batch_id', b.id)
      const { count: claimed } = await supabase.from('charity_codes')
        .select('*', { count: 'exact', head: true })
        .eq('batch_id', b.id).not('claimed_by', 'is', null)
      console.log(
        `${b.partner_name.padEnd(20)} cap ${String(b.cap).padStart(4)}  ` +
        `minted ${String(total ?? 0).padStart(4)}  redeemed ${String(claimed ?? 0).padStart(4)}` +
        `${b.revoked_at ? '  [REVOKED]' : ''}`,
      )
      console.log(`  batch id: ${b.id}`)
    }
    return
  }

  const code = normaliseCode(arg)
  if (!code) { console.error('Could not read that as a code.'); process.exit(2) }

  const { data, error } = await supabase
    .from('charity_codes')
    .select('code, claimed_by, claimed_at, expires_at, charity_batches ( partner_name, revoked_at )')
    .eq('code', code)
    .maybeSingle()

  if (error) { console.error(error.message); process.exit(1) }
  if (!data) { console.log(`${formatCode(code)} — NOT FOUND in the database.`); process.exit(1) }

  const batch = data.charity_batches as unknown as { partner_name: string; revoked_at: string | null }
  const live = data.expires_at ? new Date(data.expires_at) > new Date() : false

  console.log(`code      : ${formatCode(data.code)}`)
  console.log(`partner   : ${batch?.partner_name ?? '—'}${batch?.revoked_at ? ' [BATCH REVOKED]' : ''}`)
  console.log(`claimed   : ${data.claimed_by ? `YES by ${data.claimed_by}` : 'no — still available'}`)
  console.log(`claimed at: ${when(data.claimed_at)}`)
  console.log(`expires   : ${when(data.expires_at)}`)
  console.log(`grant live: ${data.claimed_by ? (live ? 'YES — this user resolves as paid' : 'NO — expired') : 'n/a'}`)
}

main().catch(err => { console.error(err); process.exit(1) })
