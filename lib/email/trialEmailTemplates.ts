import { BRAND } from '@/lib/brand'
import { TRIAL_EXTENSION_DAYS } from '@/lib/trial'
import { EMAIL_COLORS as C, EMAIL_TYPE as T, emailWordmark } from './emailTheme'
import { ZONE_HELD_MAX_ABOVE_CEILING_PCT, TRIAL_SUMMARY_MIN_RUNS } from '@/lib/coaching/constants'
import { ctaHref, type EmailCtaScreen, type CtaParams } from './ctaTargets'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.zonna.run'


/**
 * §12 Amendment 2 (Coaching Board, 2026-09-24) — PRAISE NEEDS BOTH SIDES.
 *
 * 🔴 This read `hrInZonePct >= 70` alone, and that is a BAND on a rule §12 makes a
 * CEILING. The board ruled it INCORRECT this morning, then **vacated that ruling
 * the same day on the measurement**: the runner it was written to protect (under
 * 70% in zone, zero time above the cap) is **0 of 73**, and the literal fix would
 * have silenced the line for **71 of 73**.
 *
 * The correction is narrower and it is the principle: **a one-sided rule does not
 * invert into one-sided praise.** An accusation needs only the ceiling. A
 * compliment needs the band AND the ceiling — enough time in Z2 to have been an
 * easy run, and little enough above the cap to have meant it.
 *
 * ⚠️ MISSING HR IS SILENCE, NEVER A ZERO (Sims, ADR-011 §5). An iPhone-only runner
 * has no heart rate at all, and must not read a sentence implying they failed a
 * test they were never given.
 */
/**
 * §12 Am.2's test, on its own, because TWO surfaces now ask it and they must not
 * drift.
 *
 * 🔴 THEY ALREADY DID, FOR ABOUT FOUR MINUTES. The day-11 subject was keyed on
 * `verdictLine(...)` being non-empty, which is true for "Close. Plan's doing its
 * job." — so a runner **22% above the ceiling** got the subject *"You held the
 * zone on Tuesday."* The sentence in the body and the sentence in the subject
 * disagreed about the same run. Caught by rendering the HOT fixture, not by a
 * test, and it is the claim/computation class this repo has recorded repeatedly.
 */
export function heldTheZone(run: { hrInZonePct: number | null; hrAboveCeilingPct: number | null }): boolean {
  return run.hrInZonePct !== null
    && run.hrInZonePct >= 70
    && run.hrAboveCeilingPct !== null
    && run.hrAboveCeilingPct <= ZONE_HELD_MAX_ABOVE_CEILING_PCT
}

function verdictLine(
  verdict: string | null,
  hrInZonePct: number | null,
  hrAboveCeilingPct: number | null,
): string {
  const held = heldTheZone({ hrInZonePct, hrAboveCeilingPct })
  if (held) return "HR held in zone for most of it. That's the plan working."
  if (verdict === 'nailed') return "Clean execution."
  if (verdict === 'close') return "Close. Plan's doing its job."
  return ''
}

// EMAIL-WAVE-0 — the unsubscribe link is built from the runner's own token, and
// `wrapper` REQUIRES it. Optional would mean an email could render without one,
// which is the state that made that wave tranche 0.
export function unsubscribeUrl(token: string): string {
  return `${BASE_URL}/api/email/unsubscribe?t=${encodeURIComponent(token)}`
}

/**
 * ACT-EMAIL-DAY14-01 — the link that grants the seven extra days.
 * ⚠️ Reuses the runner's unsubscribe token rather than minting a second secret: one secret per
 * runner is one thing to leak, and the power this grants is bounded and one-directional.
 */
export function extendTrialUrl(token: string): string {
  return `${BASE_URL}/api/email/extend-trial?t=${encodeURIComponent(token)}`
}

/** A full-width link styled as the primary action, for the routes that are not app screens. */
function linkButton(label: string, href: string): string {
  return `<a href="${href}" style="display:inline-block;margin-top:28px;padding:14px 28px;background:${C.mossStrong};color:${C.card};border:1px solid ${C.mossDeep};text-decoration:none;border-radius:8px;font-size:${T.body}px;font-weight:600;">${label}</a>`
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
              <!-- Design Board 2026-09-24, Silvanto's VETO: this was 13px/600
                   tracked uppercase in all-moss — the brand's own wordmark spec
                   regressed on five counts. Live text, never an image, because
                   mail clients block images by default. -->
              <p style="margin:0 0 28px 0;">${emailWordmark(BRAND.name)}</p>
              ${content}
              <p style="margin:40px 0 0 0;font-size:${T.caption}px;color:${C.mute};line-height:1.6;">
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
function ctaButton(label: string, screen: EmailCtaScreen, params?: CtaParams): string {
  return `<a href="${ctaHref(screen, params)}" style="display:inline-block;margin-top:28px;padding:14px 28px;background:${C.mossStrong};color:${C.card};border:1px solid ${C.mossDeep};text-decoration:none;border-radius:8px;font-size:${T.body}px;font-weight:600;">${label}</a>`
}

export interface RunSummary {
  actualLoadKm: number | null
  hrInZonePct: number | null
  /** §12 Am.2 — required for the praise line. Null means no HR, which is silence. */
  hrAboveCeilingPct: number | null
  verdict: string | null
  analysedRunCount: number
  dayName: string | null  // e.g. "Tuesday"
}

// GTM-10 — day 11, 3 days remaining
export function buildDay11Email(firstName: string | null, run: RunSummary, unsubToken: string): { subject: string; html: string } {
  const name = firstName ? `, ${firstName}` : ''
  // EMAIL-WAVE-2 — THE RUNNER LEADS, THE CLOCK FOLLOWS. This said "3 days left."
  // with the runner's own run three lines down as a conditional paragraph. 22 of
  // 30 recipients had no run, so for most people it was a countdown and a button.
  // Where a verdict exists it is now the subject; where it does not, the honest
  // line is the deadline and nothing dressed up around it.
  const zone = verdictLine(run.verdict, run.hrInZonePct, run.hrAboveCeilingPct)
  const subject = heldTheZone(run) && run.dayName ? `You held the zone on ${run.dayName}.` : '3 days left.'

  let runPara = ''
  if (run.actualLoadKm && run.dayName) {
    const km = run.actualLoadKm.toFixed(1)
    const zoneLine = verdictLine(run.verdict, run.hrInZonePct, run.hrAboveCeilingPct)
    const countLine = run.analysedRunCount > 1
      ? ` ${BRAND.coachName} has read ${run.analysedRunCount} of your runs so far.`
      : ''
    runPara = `<p style="margin:20px 0 0 0;font-size:${T.lead}px;color:${C.ink};line-height:1.6;">
      You ran ${km}km on ${run.dayName}. ${zoneLine}${countLine}
    </p>`
  } else if (run.analysedRunCount > 0) {
    runPara = `<p style="margin:20px 0 0 0;font-size:${T.lead}px;color:${C.ink};line-height:1.6;">
      ${BRAND.coachName} has read ${run.analysedRunCount} of your runs so far.
    </p>`
  }

  const html = wrapper(`
    <h1 style="margin:20px 0 0 0;font-size:${T.heading}px;font-weight:700;color:${C.ink};line-height:1.25;letter-spacing:-0.01em;">
      ${run.actualLoadKm && run.dayName
        ? `${run.actualLoadKm.toFixed(1)}km on ${run.dayName}. Three days left.`
        : `3 days left${name}.`}
    </h1>
    ${runPara}
    <p style="margin:20px 0 0 0;font-size:${T.body}px;color:${C.ink2};line-height:1.6;">
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
    <h1 style="margin:20px 0 0 0;font-size:${T.heading}px;font-weight:700;color:${C.ink};line-height:1.25;letter-spacing:-0.01em;">
      Nothing to read yet${name}.
    </h1>
    <p style="margin:20px 0 0 0;font-size:${T.lead}px;color:${C.ink};line-height:1.6;">
      ${BRAND.name} reads your runs and tells you when you went too hard. Right now it has
      nothing to read, so it has nothing to say.
    </p>
    <p style="margin:20px 0 0 0;font-size:${T.body}px;color:${C.ink2};line-height:1.6;">
      Connect Apple Health and the next run you do gets read.
    </p>
    ${ctaButton('Connect Apple Health →', 'connect')}
  `, unsubToken)

  return { subject, html }
}

// EMAIL-WAVE-3 — email 2, "First read". SLT tranche 3.
//
// 🔴 SUTHERLAND CALLED THIS THE ONLY THING NO COMPETITOR CAN DO, and the reason is
// worth keeping next to the code: *"Every other running app can email you a
// countdown. Only we can email you, unprompted, within an hour of your first run,
// and tell you that you held the zone. That is costly signalling: it proves the
// machine is actually running, on one person, before they have paid anything."*
//
// ⚠️ THE NUMBERS ARE THE HEADLINE, AND THAT IS THE DESIGN. Silvanto ruled the wow
// moment out of email 1 precisely so it could land here: *"every device we have
// for feeling needs data we do not have at that moment."* Here we have it. The
// distance and the day are the largest thing in the email, larger than any other
// email's H1, because this is the first moment the product stops being a claim.
//
// ⚠️ EVENT-TRIGGERED, NEVER DATED. It fires from `/api/analyse-run` when
// `isFirstAnalysis` is true — a signal that route already computed. Wood's
// requirement, recorded: *"our contact is tied to their behaviour. That is the
// correct shape for everything we ever send."*
//
// §12 Am.2 governs the verdict line via `heldTheZone`, exactly as the trial
// emails do. Missing HR degrades to silence, never a zero.
export function buildFirstReadEmail(
  firstName: string | null,
  run: RunSummary,
  unsubToken: string,
  session: CtaParams,
): { subject: string; html: string } {
  const name = firstName ? `, ${firstName}` : ''
  const km = run.actualLoadKm !== null ? `${run.actualLoadKm.toFixed(1)}km` : null
  const held = heldTheZone(run)

  // The subject is the runner's own run. Nothing about us, nothing about a trial.
  const subject = held && run.dayName
    ? `You held the zone on ${run.dayName}.`
    : km && run.dayName ? `${km} on ${run.dayName}. Read.` : 'Your first run, read.'

  const zone = verdictLine(run.verdict, run.hrInZonePct, run.hrAboveCeilingPct)

  const html = wrapper(`
    ${km && run.dayName ? `
    <p style="margin:20px 0 0 0;font-size:${T.eyebrow}px;color:${C.mute};letter-spacing:0.08em;text-transform:uppercase;font-weight:600;">
      Your first run
    </p>
    <h1 style="margin:6px 0 0 0;font-size:${T.metricLg}px;font-weight:800;color:${C.ink};line-height:1;letter-spacing:-0.03em;">
      ${km}
    </h1>
    <p style="margin:4px 0 0 0;font-size:${T.lead}px;color:${C.ink2};line-height:1.5;">${run.dayName}</p>
    ` : `
    <h1 style="margin:20px 0 0 0;font-size:${T.heading}px;font-weight:700;color:${C.ink};line-height:1.25;letter-spacing:-0.01em;">
      Your first run${name}. Read.
    </h1>`}
    ${zone ? `
    <p style="margin:24px 0 0 0;font-size:${T.lead}px;color:${C.ink};line-height:1.6;">${zone}</p>` : ''}
    <p style="margin:20px 0 0 0;font-size:${T.body}px;color:${C.ink2};line-height:1.6;">
      That is the number ${BRAND.name} will hold you to. Every run from here gets read the same way.
    </p>
    ${ctaButton('See the full read →', 'post-run', session)}
  `, unsubToken)

  return { subject, html }
}

// GTM-09 — day 14, trial ends today
export function buildDay14Email(firstName: string | null, run: RunSummary, unsubToken: string): { subject: string; html: string } {
  const name = firstName ? `, ${firstName}` : ''
  // EMAIL-WAVE-2 — ENDS ON WHAT THEY GAINED. This opened on what switches off.
  // The subject now counts what we read, because that is the thing they built and
  // it is true even when the number is zero.
  // 🔴 ACT-EMAIL-DAY14-01 — THE ZERO BRANCH NEVER STATES THE ZERO.
  // 📐 `ops_events.email_sent`, by subject: **"Fourteen days, no runs read." went out 13 times
  // of 16.** The last thing most trial runners heard from us was a count of nothing, in a mail
  // asking them to pay for reads — and the measured cause is usually ours, not theirs: of 37
  // trialists, 24 had no trainable plan week inside the window at all. A trial where the product
  // never did its one trick is not a trial anyone can decide on, so we offer the week back
  // instead of invoicing them for the silence.
  const subject = run.analysedRunCount > 0
    ? `Fourteen days, ${run.analysedRunCount} ${run.analysedRunCount === 1 ? 'run' : 'runs'} read.`
    : 'Didn\u2019t get a run in?'

  let runPara = ''
  if (run.actualLoadKm && run.dayName) {
    const km = run.actualLoadKm.toFixed(1)
    const zoneLine = verdictLine(run.verdict, run.hrInZonePct, run.hrAboveCeilingPct)
    const countLine = run.analysedRunCount > 1
      ? ` ${BRAND.coachName} read ${run.analysedRunCount} sessions across your trial.`
      : ''
    runPara = `<p style="margin:20px 0 0 0;font-size:${T.lead}px;color:${C.ink};line-height:1.6;">
      Last run: ${km}km on ${run.dayName}. ${zoneLine}${countLine}
    </p>`
  } else if (run.analysedRunCount > 0) {
    runPara = `<p style="margin:20px 0 0 0;font-size:${T.lead}px;color:${C.ink};line-height:1.6;">
      ${BRAND.coachName} read ${run.analysedRunCount} ${run.analysedRunCount === 1 ? 'session' : 'sessions'} across your trial.
    </p>`
  }

  // The two bodies are different messages, not one message with a conditional number in it.
  const body = run.analysedRunCount > 0
    ? `
    <h1 style="margin:20px 0 0 0;font-size:${T.heading}px;font-weight:700;color:${C.ink};line-height:1.25;letter-spacing:-0.01em;">
      ${run.analysedRunCount} ${run.analysedRunCount === 1 ? 'run' : 'runs'} read${name}.
    </h1>
    ${runPara}
    ${run.analysedRunCount >= TRIAL_SUMMARY_MIN_RUNS ? `
    <p style="margin:20px 0 0 0;font-size:${T.lead}px;color:${C.ink};line-height:1.6;">
      That is ${run.analysedRunCount} sessions of evidence about how you actually run, not how you meant to.
    </p>` : ''}
    <p style="margin:20px 0 0 0;font-size:${T.body}px;color:${C.ink2};line-height:1.6;">
      Daily analysis and the Coach tab pause from midnight. Your plan stays, and everything above stays true.
    </p>
    ${ctaButton('Keep the coaching →', 'upgrade')}`
    : `
    <h1 style="margin:20px 0 0 0;font-size:${T.heading}px;font-weight:700;color:${C.ink};line-height:1.25;letter-spacing:-0.01em;">
      Another ${TRIAL_EXTENSION_DAYS} days${name}.
    </h1>
    <p style="margin:20px 0 0 0;font-size:${T.lead}px;color:${C.ink};line-height:1.6;">
      Your fourteen days are up and we never got to read a run, so there is nothing here for you to judge us on.
    </p>
    <p style="margin:20px 0 0 0;font-size:${T.body}px;color:${C.ink2};line-height:1.6;">
      Take the week back. Run once, and ${BRAND.coachName} will tell you what it saw.
    </p>
    ${linkButton(`Add ${TRIAL_EXTENSION_DAYS} days \u2192`, extendTrialUrl(unsubToken))}
    <p style="margin:20px 0 0 0;font-size:${T.body}px;color:${C.ink2};line-height:1.6;">
      Rather leave it? Do nothing. Your plan stays free either way.
    </p>`

  return { subject, html: wrapper(body, unsubToken) }
}

/**
 * ACT-EMAIL-POSTTRIAL-01 — day 17. Extend, or summarise.
 *
 * 📐 Nothing at all was sent after day 14. This is the first of the two that changes.
 * ⚠️ Branches on whether the runner has ALREADY taken the extension, not on the read count
 * alone: offering a week to someone who accepted one three days ago reads as a system that is
 * not paying attention, which is the opposite of what the product claims to be.
 */
export function buildDay17Email(
  firstName: string | null,
  run: RunSummary,
  unsubToken: string,
  alreadyExtended: boolean,
): { subject: string; html: string } {
  const name = firstName ? `, ${firstName}` : ''
  const sawSomething = run.analysedRunCount > 0

  if (sawSomething) {
    return {
      subject: `What ${BRAND.coachName} saw.`,
      html: wrapper(`
        <h1 style="margin:20px 0 0 0;font-size:${T.heading}px;font-weight:700;color:${C.ink};line-height:1.25;letter-spacing:-0.01em;">
          ${run.analysedRunCount} ${run.analysedRunCount === 1 ? 'run' : 'runs'}${name}.
        </h1>
        <p style="margin:20px 0 0 0;font-size:${T.lead}px;color:${C.ink};line-height:1.6;">
          That is still the clearest picture anyone has of how you actually run. It does not expire.
        </p>
        <p style="margin:20px 0 0 0;font-size:${T.body}px;color:${C.ink2};line-height:1.6;">
          The reading stopped three days ago. The plan did not.
        </p>
        ${ctaButton('Start it again →', 'upgrade')}
      `, unsubToken),
    }
  }

  // No reads, and the offer already taken: say the true thing and stop.
  if (alreadyExtended) {
    return {
      subject: 'Still here.',
      html: wrapper(`
        <h1 style="margin:20px 0 0 0;font-size:${T.heading}px;font-weight:700;color:${C.ink};line-height:1.25;letter-spacing:-0.01em;">
          Still here${name}.
        </h1>
        <p style="margin:20px 0 0 0;font-size:${T.lead}px;color:${C.ink};line-height:1.6;">
          You took the extra days and we still have not read a run. That is fine. The plan waits.
        </p>
        <p style="margin:20px 0 0 0;font-size:${T.body}px;color:${C.ink2};line-height:1.6;">
          One run is all it takes to see what this does.
        </p>
      `, unsubToken),
      // ⚠️ NO CTA, and not an omission. `EMAIL_CTA_SCREENS` is `connect | upgrade | post-run`:
      // `upgrade` is the wrong ask of someone mid-extension, and `post-run` needs a session that
      // by definition does not exist here. Adding a `today` target would have been a no-op
      // string the handler ignores — which is the decorative class `ctaTargets.ts`'s own header
      // records. The sentence is the action.
    }
  }

  return {
    subject: `${TRIAL_EXTENSION_DAYS} days, if you want them.`,
    html: wrapper(`
      <h1 style="margin:20px 0 0 0;font-size:${T.heading}px;font-weight:700;color:${C.ink};line-height:1.25;letter-spacing:-0.01em;">
        The offer is still open${name}.
      </h1>
      <p style="margin:20px 0 0 0;font-size:${T.lead}px;color:${C.ink};line-height:1.6;">
        We never read a run of yours, so you never saw the part worth paying for.
      </p>
      ${linkButton(`Add ${TRIAL_EXTENSION_DAYS} days \u2192`, extendTrialUrl(unsubToken))}
    `, unsubToken),
  }
}

/**
 * ACT-EMAIL-POSTTRIAL-01 — day 30. One question, and no follow-up.
 *
 * ⚠️ NO CTA, DELIBERATELY. The brief asks for one honest question, and a question with a Buy
 * button under it is not a question. This is the last email in the sequence and it says so.
 */
export function buildDay30Email(firstName: string | null, unsubToken: string): { subject: string; html: string } {
  const name = firstName ? `, ${firstName}` : ''
  return {
    subject: 'What stopped you?',
    html: wrapper(`
      <h1 style="margin:20px 0 0 0;font-size:${T.heading}px;font-weight:700;color:${C.ink};line-height:1.25;letter-spacing:-0.01em;">
        One question${name}.
      </h1>
      <p style="margin:20px 0 0 0;font-size:${T.lead}px;color:${C.ink};line-height:1.6;">
        You tried ${BRAND.name} and did not subscribe. What stopped you?
      </p>
      <p style="margin:20px 0 0 0;font-size:${T.body}px;color:${C.ink2};line-height:1.6;">
        Reply to this and a person reads it. No follow-up, and this is the last one either way.
      </p>
    `, unsubToken),
  }
}
