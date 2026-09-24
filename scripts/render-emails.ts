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
const frames: string[] = []
for (const [name, { subject, html }] of cases) {
  writeFileSync(join(out, `${name}.html`), html)
  index.push(`<li><a href="./${name}.html">${name}</a> <code>${subject}</code></li>`)
  // ⚠️ INLINED, NOT IN AN IFRAME. The first version used `<iframe srcdoc>` and
  // every panel rendered BLANK: preview panes and mail-safe viewers strip
  // sandboxed iframes, which is exactly the kind of viewer this sheet gets
  // opened in. Every email's styling is inline anyway (it has to be — mail
  // clients drop <style> blocks), so lifting the <body> straight in is faithful
  // and cannot be sanitised away.
  const inner = html.replace(/[\s\S]*?<body[^>]*>/i, '').replace(/<\/body>[\s\S]*/i, '')
  frames.push(`
    <section>
      <h2>${name.replace(/--/g, ' · ').replace(/-/g, ' ')}</h2>
      <p class="subj">Subject: <strong>${subject.replace(/</g, '&lt;')}</strong></p>
      <div class="phone">${inner}</div>
    </section>`)
  console.log(`  ${name.padEnd(34)} "${subject}"`)
}

// ── THE CONTACT SHEET ────────────────────────────────────────────────────────
// Every email, at phone width, on one scrollable page. This is the artefact a
// human actually looks at; the individual files exist for opening one at a time.
writeFileSync(join(out, 'all-emails.html'), `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Zonna emails</title>
<style>
  :root { color-scheme: light; }
  body { margin:0; background:#E7E3DC; font-family:system-ui,-apple-system,sans-serif; color:#1A1A1A; }
  header { max-width:1100px; margin:0 auto; padding:40px 24px 8px; }
  h1 { font-size:24px; margin:0 0 8px; letter-spacing:-0.01em; }
  header p { margin:0; color:#3D3A36; line-height:1.6; max-width:60ch; font-size:15px; }
  .grid { max-width:1100px; margin:0 auto; padding:24px; display:grid;
          grid-template-columns:repeat(auto-fill,minmax(390px,1fr)); gap:32px; }
  section { display:flex; flex-direction:column; }
  h2 { font-size:13px; font-weight:600; text-transform:uppercase; letter-spacing:0.06em;
       color:#6B8E6B; margin:0 0 4px; }
  .subj { margin:0 0 10px; font-size:14px; color:#3D3A36; }
  .phone { border:1px solid rgba(26,26,26,0.12); border-radius:10px; overflow:hidden;
           background:#F3F0EB; }
  /* The email ships its own 40px table padding; trim it so the card is not lost
     inside a second frame's whitespace. */
  .phone table { padding:16px 8px !important; }
  @media (max-width:900px) { .grid { grid-template-columns:1fr; } }
</style></head>
<body>
<header>
  <h1>Every email Zonna sends</h1>
  <p>Eight states across five emails, each at phone width. The <strong>empty</strong> variants are
  not edge cases: 22 of 30 real recipients got one. <strong>Above ceiling</strong> is a runner who
  stayed in the band but ran hot over the Z2 cap, and correctly loses the praise line.
  Emails 1, 2, 4 and 5 are built; the Pattern email is not.</p>
</header>
<div class="grid">${frames.join('')}</div>
</body></html>`)

writeFileSync(join(out, 'index.html'),
  `<!DOCTYPE html><meta charset="utf-8"><title>Zonna emails</title>
<body style="font-family:system-ui;max-width:640px;margin:48px auto;padding:0 16px;background:#F3F0EB;">
<h1 style="font-size:22px;">Zonna emails</h1>
<p style="color:#3D3A36;line-height:1.6;"><a href="./all-emails.html"><strong>See all of them on one page →</strong></a></p>
<ul style="line-height:2;">${index.join('')}</ul></body>`)

console.log(`\n${cases.length} emails + all-emails.html (the contact sheet) in ${out}`)
console.log('⚠️  Rendered, NOT sent. A browser is kinder than Gmail; this is not a mail-client check.')
