import { NextRequest, NextResponse } from 'next/server'
import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { getUserTier } from '@/lib/trial'

// Temporary debug endpoint — remove after auth is confirmed working
export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req)

    if (!user) {
      return NextResponse.json({ authenticated: false, error: 'No user returned' })
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
