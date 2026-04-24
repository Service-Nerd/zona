import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const uid = user.id

  await adminClient.from('session_completions').delete().eq('user_id', uid)
  await adminClient.from('subscriptions').delete().eq('user_id', uid)
  await adminClient.from('user_settings').delete().eq('id', uid)
  const { error } = await adminClient.auth.admin.deleteUser(uid)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
