// render-emails.ts — EMAIL-WAVE-0. Every email, rendered to a file you can open.
//
// 🔴 WHY A RENDERER AND NOT A TEST SEND. `RESEND_API_KEY` lives in Vercel and is
// NOT in `.env.local`, so nothing on this machine can send an email. That is a
// real constraint, not a preference: the only way to see these before a deploy is
// to render them.
//
// ⚠️ AND RENDERING IS NOT SEEING. Every board sitting on this programme ended on
// the same line — **nothing has been viewed in a real mail client**. A browser
// renders this HTML more faithfully than Gmail does, so a file that looks right
// here can still break in an inbox. The test-send path exists for that and needs
// the key.
//
//   npx tsx scripts/render-emails.ts            # writes to /tmp/zonna-emails
//   npx tsx scripts/render-emails.ts --out DIR
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { buildConnectEmail, buildFirstReadEmail, buildDay11Email, buildDay14Email, type RunSummary } from '../lib/email/trialEmailTemplates'

const arg = (n: string) => { const i = process.argv.indexOf(n); return i >= 0 ? process.argv[i + 1] : null }
const out = arg('--out') ?? '/tmp/zonna-emails'
mkdirSync(out, { recursive: true })

// ⚠️ FIXTURES ARE SHARED WITH `/api/email/preview`. One set, so the email you
// look at and the email you receive cannot drift apart.
import {
  RUN_CLEAN, RUN_HOT, RUN_NO_HR, RUN_NONE, PREVIEW_TOKEN as TOKEN, PREVIEW_SESSION,
} from '../lib/email/previewFixtures'

const cases = [
  ['01-connect', buildConnectEmail('Russ', TOKEN)],
  ['01-connect--no-name', buildConnectEmail(null, TOKEN)],
  ['02-first-read', buildFirstReadEmail('Russ', { ...RUN_CLEAN, analysedRunCount: 1 }, TOKEN, PREVIEW_SESSION)],
  ['02-first-read--no-HR', buildFirstReadEmail('Russ', { ...RUN_NO_HR, analysedRunCount: 1 }, TOKEN, PREVIEW_SESSION)],
  ['04-3-days-left--with-run', buildDay11Email('Russ', RUN_CLEAN, TOKEN)],
  ['04-3-days-left--HOT-above-ceiling', buildDay11Email('Russ', RUN_HOT, TOKEN)],
  ['04-3-days-left--NO-run', buildDay11Email('Russ', RUN_NONE, TOKEN)],
  ['05-trial-ends-today--with-run', buildDay14Email('Russ', RUN_CLEAN, TOKEN)],
  ['05-trial-ends-today--NO-run', buildDay14Email('Russ', RUN_NONE, TOKEN)],
] as const

const index: string[] = []
for (const [name, { subject, html }] of cases) {
  writeFileSync(join(out, `${name}.html`), html)
  index.push(`<li><a href="./${name}.html">${name}</a> <code>${subject}</code></li>`)
  console.log(`  ${name.padEnd(34)} "${subject}"`)
}
writeFileSync(join(out, 'index.html'),
  `<!DOCTYPE html><meta charset="utf-8"><title>Zonna emails</title>
<body style="font-family:system-ui;max-width:640px;margin:48px auto;padding:0 16px;background:#F3F0EB;">
<h1 style="font-size:22px;">Zonna emails, as they render today</h1>
<p style="color:#3D3A36;line-height:1.6;">Email 1 (Connect) and emails 4 and 5. Emails 2 and 3 are approved and not yet built.
The trial emails are shown in <strong>both</strong> states, because 22 of 30 real recipients hit the empty one.</p>
<ul style="line-height:2;">${index.join('')}</ul></body>`)

console.log(`\n${cases.length} files + index.html in ${out}`)
console.log('⚠️  Rendered, NOT sent. A browser is kinder than Gmail; this is not a mail-client check.')
