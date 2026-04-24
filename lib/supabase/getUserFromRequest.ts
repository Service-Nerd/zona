import { createClient } from '@/lib/supabase/server'
import type { NextRequest } from 'next/server'

/**
 * Extract and validate the user from an API request.
 * Reads the token from the Authorization header (client sends it explicitly
 * because @supabase/ssr cookie sync to the server is unreliable).
 * Falls back to cookie-based auth so server-to-server calls still work.
 */
export async function getUserFromRequest(req: NextRequest) {
  const supabase = createClient()
  const authHeader = req.headers.get('Authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined
  const { data: { user } } = await supabase.auth.getUser(token)
  return user
}
