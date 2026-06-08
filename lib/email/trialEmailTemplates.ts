import { BRAND } from '@/lib/brand'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.zonna.run'

// Upgrade CTA — links to marketing site (deep-link to upgrade screen via
// Universal Links once UL is shipped; for now marketing site → App Store badge).
const UPGRADE_URL = BASE_URL

function verdictLine(verdict: string | null, hrInZonePct: number | null): string {
  if (hrInZonePct !== null && hrInZonePct >= 70) return "HR held in zone for most of it. That's the plan working."
  if (verdict === 'nailed') return "Clean execution."
  if (verdict === 'close') return "Close. Plan's doing its job."
  return ''
}

function wrapper(content: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${BRAND.name}</title>
</head>
<body style="margin:0;padding:0;background:#F3F0EB;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F0EB;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:520px;background:#ffffff;border-radius:12px;padding:40px 36px;">
          <tr>
            <td>
              <p style="margin:0 0 4px 0;font-size:13px;font-weight:600;color:#6B8E6B;letter-spacing:0.06em;text-transform:uppercase;">${BRAND.name}</p>
              ${content}
              <p style="margin:40px 0 0 0;font-size:12px;color:#8A857D;">
                You're receiving this because you're in a ${BRAND.name} trial.
                Your email is never shared.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function ctaButton(label: string): string {
  return `<a href="${UPGRADE_URL}" style="display:inline-block;margin-top:28px;padding:14px 28px;background:#6B8E6B;color:#ffffff;text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;">${label}</a>`
}

export interface RunSummary {
  actualLoadKm: number | null
  hrInZonePct: number | null
  verdict: string | null
  analysedRunCount: number
  dayName: string | null  // e.g. "Tuesday"
}

// GTM-10 — day 11, 3 days remaining
export function buildDay11Email(firstName: string | null, run: RunSummary): { subject: string; html: string } {
  const name = firstName ? `, ${firstName}` : ''
  const subject = '3 days left.'

  let runPara = ''
  if (run.actualLoadKm && run.dayName) {
    const km = run.actualLoadKm.toFixed(1)
    const zoneLine = verdictLine(run.verdict, run.hrInZonePct)
    const countLine = run.analysedRunCount > 1
      ? ` ${BRAND.coachName} has read ${run.analysedRunCount} of your runs so far.`
      : ''
    runPara = `<p style="margin:20px 0 0 0;font-size:16px;color:#1A1A1A;line-height:1.6;">
      You ran ${km}km on ${run.dayName}. ${zoneLine}${countLine}
    </p>`
  } else if (run.analysedRunCount > 0) {
    runPara = `<p style="margin:20px 0 0 0;font-size:16px;color:#1A1A1A;line-height:1.6;">
      ${BRAND.coachName} has read ${run.analysedRunCount} of your runs so far.
    </p>`
  }

  const html = wrapper(`
    <h1 style="margin:20px 0 0 0;font-size:22px;font-weight:700;color:#1A1A1A;line-height:1.3;">
      3 days left${name}.
    </h1>
    ${runPara}
    <p style="margin:20px 0 0 0;font-size:16px;color:#3D3A36;line-height:1.6;">
      After day 14, daily analysis and the Coach tab pause. Your plan stays.
    </p>
    ${ctaButton('Keep the coaching →')}
  `)

  return { subject, html }
}

// GTM-09 — day 14, trial ends today
export function buildDay14Email(firstName: string | null, run: RunSummary): { subject: string; html: string } {
  const name = firstName ? `, ${firstName}` : ''
  const subject = 'Your coaching pauses today.'

  let runPara = ''
  if (run.actualLoadKm && run.dayName) {
    const km = run.actualLoadKm.toFixed(1)
    const zoneLine = verdictLine(run.verdict, run.hrInZonePct)
    const countLine = run.analysedRunCount > 1
      ? ` ${BRAND.coachName} read ${run.analysedRunCount} sessions across your trial.`
      : ''
    runPara = `<p style="margin:20px 0 0 0;font-size:16px;color:#1A1A1A;line-height:1.6;">
      Last run: ${km}km on ${run.dayName}. ${zoneLine}${countLine}
    </p>`
  } else if (run.analysedRunCount > 0) {
    runPara = `<p style="margin:20px 0 0 0;font-size:16px;color:#1A1A1A;line-height:1.6;">
      ${BRAND.coachName} read ${run.analysedRunCount} ${run.analysedRunCount === 1 ? 'session' : 'sessions'} across your trial.
    </p>`
  }

  const html = wrapper(`
    <h1 style="margin:20px 0 0 0;font-size:22px;font-weight:700;color:#1A1A1A;line-height:1.3;">
      Trial ends today${name}.
    </h1>
    ${runPara}
    <p style="margin:20px 0 0 0;font-size:16px;color:#3D3A36;line-height:1.6;">
      Daily analysis and the Coach tab pause from midnight. Your plan stays.
    </p>
    ${ctaButton('Keep the coaching →')}
  `)

  return { subject, html }
}
