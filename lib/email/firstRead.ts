// firstRead.ts — EMAIL-WAVE-3. The send path for email 2.
//
// 🔴 A SEPARATE MODULE SO `/api/analyse-run` DOES NOT GROW AN EMAIL PROGRAMME.
// That route is 500 lines of coaching computation and the thing a runner is
// waiting on. Everything email-shaped lives here: the one-shot guard, the
// address lookup, the day name, and the send. The route contributes the trigger
// and nothing else.
//
// ⚠️ ONE-SHOT, AND THE GUARD IS A COLUMN NOT A COUNT. `isFirstAnalysis` is
// computed from `count === 0` BEFORE the upsert, so a retried or re-scored
// analysis of the same run can present as "first" more than once. The stamp is
// what actually makes it once, and it is written only on a real send — the same
// rule wave 0 established: a suppressed or failed send must never stamp.

import { createClient } from '@supabase/supabase-js'
import { sendToUser } from './sendToUser'
import { buildFirstReadEmail, type RunSummary } from './trialEmailTemplates'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** `mon`…`sun` → the display name the email uses. */
const DAY_KEY_TO_NAME: Record<string, string> = {
  mon: 'Monday', tue: 'Tuesday', wed: 'Wednesday',
  thu: 'Thursday', fri: 'Friday', sat: 'Saturday', sun: 'Sunday',
}

export async function sendFirstReadEmail(args: {
  userId: string
  weekN: number
  sessionDay: string
  run: RunSummary
}): Promise<void> {
  const { userId, weekN, sessionDay, run } = args

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data, error } = await supabase
    .from('user_settings')
    .select('first_name, first_read_email_sent_at, email_unsubscribe_token')
    .eq('id', userId)
    .maybeSingle()
  if (error || !data) return

  const row = data as {
    first_name: string | null
    first_read_email_sent_at: string | null
    email_unsubscribe_token: string
  }
  // Already sent. The guard that makes "first" mean once.
  if (row.first_read_email_sent_at) return

  // The address lives on auth.users, not user_settings.
  const { data: userRes } = await supabase.auth.admin.getUserById(userId)
  const email = userRes?.user?.email ?? null

  const { subject, html } = buildFirstReadEmail(
    row.first_name,
    { ...run, dayName: DAY_KEY_TO_NAME[sessionDay] ?? DAY_NAMES[new Date().getDay()]! },
    row.email_unsubscribe_token,
    { weekN, sessionDay },
  )

  const outcome = await sendToUser({
    userId, to: email, id: 'first_read', kind: 'transactional', subject, html,
  })

  // ⚠️ ONLY ON 'sent'. A suppressed runner who later resubscribes must still get
  // their first read; stamping here would mean they never do.
  if (outcome === 'sent') {
    await supabase.from('user_settings')
      .update({ first_read_email_sent_at: new Date().toISOString() })
      .eq('id', userId)
      .is('first_read_email_sent_at', null)
  }
}
