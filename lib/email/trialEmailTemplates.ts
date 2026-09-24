import { BRAND } from '@/lib/brand'
import { EMAIL_COLORS as C } from './emailTheme'
import { ctaHref, type EmailCtaScreen } from './ctaTargets'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.zonna.run'


function verdictLine(verdict: string | null, hrInZonePct: number | null): string {
  if (hrInZonePct !== null && hrInZonePct >= 70) return "HR held in zone for most of it. That's the plan working."
  if (verdict === 'nailed') return "Clean execution."
  if (verdict === 'close') return "Close. Plan's doing its job."
  return ''
}

// EMAIL-WAVE-0 — the unsubscribe link is built from the runner's own token, and
// `wrapper` REQUIRES it. Optional would mean an email could render without one,
// which is the state that made this wave tranche 0.
export function unsubscribeUrl(token: string): string {
  return `${BASE_URL}/api/email/unsubscribe?t=${encodeURIComponent(token)}`
}

function wrapper(content: string, unsubToken: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${BRAND.name}</title>
</head>
<body style="margin:0;padding:0;background:${C.bg};font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${C.bg};padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:520px;background:${C.card};border-radius:12px;padding:40px 36px;">
          <tr>
            <td>
              <p style="margin:0 0 4px 0;font-size:13px;font-weight:600;color:${C.moss};letter-spacing:0.06em;text-transform:uppercase;">${BRAND.name}</p>
              ${content}
              <p style="margin:40px 0 0 0;font-size:12px;color:${C.mute};line-height:1.6;">
                You're receiving this because you're in a ${BRAND.name} trial.
                Your email is never shared.
                <br />
                <a href="${unsubscribeUrl(unsubToken)}" style="color:${C.mute};text-decoration:underline;">Unsubscribe</a>
                and we'll stop, for everything.
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

// EMAIL-WAVE-1 amendment 2 — a CTA must land somewhere. This used to point at
// `UPGRADE_URL`, which is the marketing HOMEPAGE: four steps and two guesses from
// an inbox. The target is now a deep-link screen the app actually accepts, and
// `emailCtaTargets.test.ts` reads both sides so a link the handler ignores fails
// the build rather than shipping inert.
function ctaButton(label: string, screen: EmailCtaScreen): string {
  return `<a href="${ctaHref(screen)}" style="display:inline-block;margin-top:28px;padding:14px 28px;background:${C.moss};color:${C.card};text-decoration:none;border-radius:8px;font-size:15px;font-weight:600;">${label}</a>`
}

export interface RunSummary {
  actualLoadKm: number | null
  hrInZonePct: number | null
  verdict: string | null
  analysedRunCount: number
  dayName: string | null  // e.g. "Tuesday"
}

// GTM-10 — day 11, 3 days remaining
export function buildDay11Email(firstName: string | null, run: RunSummary, unsubToken: string): { subject: string; html: string } {
  const name = firstName ? `, ${firstName}` : ''
  const subject = '3 days left.'

  let runPara = ''
  if (run.actualLoadKm && run.dayName) {
    const km = run.actualLoadKm.toFixed(1)
    const zoneLine = verdictLine(run.verdict, run.hrInZonePct)
    const countLine = run.analysedRunCount > 1
      ? ` ${BRAND.coachName} has read ${run.analysedRunCount} of your runs so far.`
      : ''
    runPara = `<p style="margin:20px 0 0 0;font-size:16px;color:${C.ink};line-height:1.6;">
      You ran ${km}km on ${run.dayName}. ${zoneLine}${countLine}
    </p>`
  } else if (run.analysedRunCount > 0) {
    runPara = `<p style="margin:20px 0 0 0;font-size:16px;color:${C.ink};line-height:1.6;">
      ${BRAND.coachName} has read ${run.analysedRunCount} of your runs so far.
    </p>`
  }

  const html = wrapper(`
    <h1 style="margin:20px 0 0 0;font-size:22px;font-weight:700;color:${C.ink};line-height:1.3;">
      3 days left${name}.
    </h1>
    ${runPara}
    <p style="margin:20px 0 0 0;font-size:16px;color:${C.ink2};line-height:1.6;">
      After day 14, daily analysis and the Coach tab pause. Your plan stays.
    </p>
    ${ctaButton('Keep the coaching →', 'upgrade')}
  `, unsubToken)

  return { subject, html }
}

// EMAIL-WAVE-1 — email 1, "Connect". Design Board 2026-09-24, SHIP WITH AMENDMENT.
//
// 🔴 THE ONLY EMAIL IN THE PROGRAMME WITH NO FACT ABOUT THE RUNNER IN IT, and it
// is allowed because its entire job is to earn one. Every other email is barred
// by the programme's one rule; this is the exception that makes the rule
// affordable.
//
// ⚠️ IT SENDS ONLY TO THE NEVER-CONNECTED, AND THE MEASUREMENT IS WHY. The brief
// said 22 of 30 users have no logged run, so connecting must be the friction.
// Production says otherwise: **16 of 30 are connected, and 8 of those have zero
// activity** — one since 2026-06-05. For those eight, "connect Apple Health" is
// advice they already took, and an email saying we have nothing to read reads as
// our failure described as theirs (Sierra). They are excluded at the query, not
// here, and why they are dry is a separate open item.
//
// ⚠️ NO DECORATION, RULED EXPLICITLY. Silvanto: every device this product has for
// making someone feel something — a number at size, a verdict, the arc — needs
// data we do not have at this moment. Decorating an empty email is chrome, and
// this board killed chrome by name. **The restraint is the craft, and the
// contrast with email 2 is the design.**
//
// Copy is the founder's. Sutherland, recorded: "deliberately unfriendly and that
// is why it will work. The only signup email I have seen that treats the reader
// as an adult with a job to do. Do not let anyone warm it up."
export function buildConnectEmail(firstName: string | null, unsubToken: string): { subject: string; html: string } {
  const name = firstName ? `, ${firstName}` : ''
  const subject = 'Nothing to read yet.'

  const html = wrapper(`
    <h1 style="margin:20px 0 0 0;font-size:22px;font-weight:700;color:${C.ink};line-height:1.3;">
      Nothing to read yet${name}.
    </h1>
    <p style="margin:20px 0 0 0;font-size:16px;color:${C.ink};line-height:1.6;">
      ${BRAND.name} reads your runs and tells you when you went too hard. Right now it has
      nothing to read, so it has nothing to say.
    </p>
    <p style="margin:20px 0 0 0;font-size:16px;color:${C.ink2};line-height:1.6;">
      Connect Apple Health and the next run you do gets read.
    </p>
    ${ctaButton('Connect Apple Health →', 'connect')}
  `, unsubToken)

  return { subject, html }
}

// GTM-09 — day 14, trial ends today
export function buildDay14Email(firstName: string | null, run: RunSummary, unsubToken: string): { subject: string; html: string } {
  const name = firstName ? `, ${firstName}` : ''
  const subject = 'Your coaching pauses today.'

  let runPara = ''
  if (run.actualLoadKm && run.dayName) {
    const km = run.actualLoadKm.toFixed(1)
    const zoneLine = verdictLine(run.verdict, run.hrInZonePct)
    const countLine = run.analysedRunCount > 1
      ? ` ${BRAND.coachName} read ${run.analysedRunCount} sessions across your trial.`
      : ''
    runPara = `<p style="margin:20px 0 0 0;font-size:16px;color:${C.ink};line-height:1.6;">
      Last run: ${km}km on ${run.dayName}. ${zoneLine}${countLine}
    </p>`
  } else if (run.analysedRunCount > 0) {
    runPara = `<p style="margin:20px 0 0 0;font-size:16px;color:${C.ink};line-height:1.6;">
      ${BRAND.coachName} read ${run.analysedRunCount} ${run.analysedRunCount === 1 ? 'session' : 'sessions'} across your trial.
    </p>`
  }

  const html = wrapper(`
    <h1 style="margin:20px 0 0 0;font-size:22px;font-weight:700;color:${C.ink};line-height:1.3;">
      Trial ends today${name}.
    </h1>
    ${runPara}
    <p style="margin:20px 0 0 0;font-size:16px;color:${C.ink2};line-height:1.6;">
      Daily analysis and the Coach tab pause from midnight. Your plan stays.
    </p>
    ${ctaButton('Keep the coaching →', 'upgrade')}
  `, unsubToken)

  return { subject, html }
}
