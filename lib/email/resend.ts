import { BRAND } from '@/lib/brand'

const RESEND_API = 'https://api.resend.com/emails'
const FROM = `${BRAND.coachName} <kit@zonna.run>`

export async function sendEmail({
  to,
  subject,
  html,
  unsubscribeUrl,
}: {
  to: string
  subject: string
  html: string
  /** EMAIL-WAVE-0 — the `List-Unsubscribe` target. **Required in practice**: a
   *  bulk sender without these headers gets filtered by Gmail, and the header is
   *  the unsubscribe path most readers actually use (the client's own button,
   *  not our footer link). Optional in the type only so a one-off preview send
   *  to ourselves does not have to invent one. */
  unsubscribeUrl?: string
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY
  if (!key) {
    console.error('[email/resend] RESEND_API_KEY not set')
    return false
  }

  try {
    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM, to: [to], subject, html,
        // `List-Unsubscribe-Post` is what turns the mail client's own button
        // into a one-click action. Without it Gmail shows the link but makes the
        // reader visit a page, which is friction we are not entitled to.
        ...(unsubscribeUrl
          ? {
              headers: {
                'List-Unsubscribe': `<${unsubscribeUrl}>`,
                'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
              },
            }
          : {}),
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error(`[email/resend] send failed ${res.status}:`, body)
      return false
    }

    return true
  } catch (err: any) {
    console.error('[email/resend] fetch error:', err.message)
    return false
  }
}
