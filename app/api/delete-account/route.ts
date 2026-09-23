import { getUserFromRequest } from '@/lib/supabase/getUserFromRequest'
import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

/**
 * DELETE ACCOUNT — DB-USER-PURGE-01.
 *
 * This route deliberately names NO tables.
 *
 * It used to name three — session_completions, subscriptions, user_settings —
 * out of the twenty-four stores that hold a runner's data, and then called
 * deleteUser(). There was no foreign key anywhere in the public schema
 * referencing auth.users, so there was no cascade behind it: run history,
 * health samples, run analyses, plans, adjustments and push tokens all stayed,
 * keyed to an id that no longer resolved. The privacy policy promised deletion
 * "removes all associated data" the whole time.
 *
 * The fix was not a longer list here. A list in a route is correct the day it
 * is written and wrong the day someone adds the next table, and nothing would
 * have told us — a stranded row looks exactly like no row. So the authority is
 * the schema: every user-scoped table now carries an ON DELETE CASCADE (or an
 * argued SET NULL) foreign key to auth.users, and a BEFORE DELETE trigger
 * clears the three stores no foreign key can reach.
 *
 * Which means deleting the auth user IS the deletion. If you find yourself
 * adding a `.delete()` call below, the constraint is missing — add it in a
 * migration and declare the table in lib/supabase/userDataSurfaces.ts instead.
 * `npm run check:db` fails the run if a user-scoped table has no rule.
 */
export async function POST(req: NextRequest) {
  const user = await getUserFromRequest(req)
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // Hard delete, not soft: a soft-deleted auth row leaves every cascade unfired
  // and the account's data fully intact, which is the defect this replaced.
  const { error } = await adminClient.auth.admin.deleteUser(user.id, false)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
