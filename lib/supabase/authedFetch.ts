import { createClient } from '@/lib/supabase/client'

/**
 * fetch() wrapper that automatically attaches the current user's access token
 * as an Authorization header. Use this for all authenticated API calls.
 * getSession() reads from in-memory state so it's always current.
 */
export async function authedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers ?? {}),
      ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {}),
    },
  })
}
