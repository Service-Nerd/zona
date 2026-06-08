import { BRAND } from '@/lib/brand'

const RESEND_API = 'https://api.resend.com/emails'
const FROM = `${BRAND.coachName} <kit@zonna.run>`

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string
  subject: string
  html: string
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
      body: JSON.stringify({ from: FROM, to: [to], subject, html }),
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
