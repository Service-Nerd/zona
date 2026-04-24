import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getUserTier } from '@/lib/trial'

// Temporary debug endpoint — remove after auth is confirmed working
export async function GET() {
  try {
    const supabase = createClient()
    const { data: { user }, error } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({
        authenticated: false,
        error: error?.message ?? 'No user returned',
      })
    }

    const tier = await getUserTier(user.id)

    return NextResponse.json({
      authenticated: true,
      userId: user.id,
      email: user.email,
      tier,
    })
  } catch (e: any) {
    return NextResponse.json({ authenticated: false, exception: e?.message })
  }
}
