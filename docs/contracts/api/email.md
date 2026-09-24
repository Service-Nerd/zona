# Email — routes, triggers and suppression

**Owner:** the Design Board, Sierra's seat standing (`ownership-map.md`). The programme
itself is a PROPOSAL at `docs/decisions/design-2026-09-24-email-programme-proposal.md`;
this contract covers only what is BUILT.

🔴 **Nothing sends email except `lib/email/sendToUser.ts`.** `sendEmail` in
`lib/email/resend.ts` is the transport and takes an address; it knows nothing about
consent and records nothing. `noRawEmailSends.test.ts` fails the build if anything else
calls it. That guard exists because **35 emails went out with no unsubscribe path and no
record they existed** (EMAIL-WAVE-0).

## `sendToUser()` — the single owner

Returns an **outcome**, never a boolean:

| Outcome | Meaning |
|---|---|
| `sent` | Accepted by Resend. **The only value a caller may stamp a `*_sent_at` column on** |
| `suppressed_unsubscribed` | `email_unsubscribed_at` is set. We chose not to send |
| `no_address` | No address on the account |
| `failed` | Transport failed, **or the consent read failed** — silence is the safe direction |

⚠️ **`suppressed` and `failed` are distinct on purpose.** A caller that cannot tell them
apart stamps the sent-column for an email nobody received, and skips that runner
**forever**, including the day they resubscribe.

Every outcome records an `ops_events` row of kind `email_sent` with
`{ id, kind, outcome, subject }`. **Including the ones we decline.**

## Suppression — one unsubscribe stops everything

`kind` (`transactional` | `marketing`) is **recorded, not obeyed**. The law would let a
service message through to someone who opted out of marketing; we do not. A runner who
asks us to stop and then receives *"your coaching pauses today"* has been told their
preference was negotiable. **Trial state stays visible in the app.** If that policy is
revisited it is revisited in `sendToUser`, in one place, with the reason.

## `GET|POST /api/email/unsubscribe?t=<token>`

**`// @public-route` — the token IS the auth.** Requiring a login to stop receiving email
is a dark pattern, and the reader may be on a device with no app installed. The token is a
random uuid on `user_settings.email_unsubscribe_token`, unique-indexed. **Never the user
id: that link is enumerable.**

- **Both verbs.** `POST` serves `List-Unsubscribe-Post`, which is the button most readers
  actually press. A GET-only route fails that path silently and the reader concludes we
  ignored them.
- **Idempotent.** The update is conditional on the column still being null, so a second
  click or a mail-client prefetch cannot error or un-unsubscribe.
- **An unknown token returns "you're unsubscribed", not an error** — it is almost always a
  stale link from a deleted account, and telling someone their unsubscribe failed when
  there is nothing left to unsubscribe from is worse.

## `GET|POST /api/email/send-trial`

**Auth:** `CRON_SECRET` via `Authorization: Bearer` or `x-cron-secret`.
**Schedule:** daily 08:00 UTC, GitHub Actions (`email-cron-trial.yml`).

Sends day-11 and day-14 trial emails, once each, stamped in
`trial_email_day11_sent_at` / `trial_email_day14_sent_at`. `decideTrialEmails` takes a
**required** access argument (tier + charity grant) — required, not optional, because the
dangerous default is *send*: this route once mailed *"3 days left."* to comped runners and
to people who had already subscribed.

## What the emails may assert — §12 Amendment 2

🔴 **Praise needs the band AND the ceiling.** `heldTheZone()` is the single predicate:
`hr_in_zone_pct >= 70` **and** `hr_above_ceiling_pct <= ZONE_HELD_MAX_ABOVE_CEILING_PCT`
(10). An accusation needs only the ceiling (20); **praise is deliberately stricter.**

- **Missing HR is silence, never a zero** (ADR-011 §5 — iPhone-only runners have none).
- An improvement claim needs **`TRIAL_SUMMARY_MIN_RUNS`** (8) analysed runs. Below it the
  email states the count and makes no comparison.
- ⚠️ **The subject and the body must ask the same predicate.** The day-11 subject was once
  keyed on `verdictLine()` being non-empty — true for *"Close."* — so a runner 22% above
  the ceiling was subjected *"You held the zone."*

## Templates

`lib/email/trialEmailTemplates.ts`. Colours come from `EMAIL_COLORS`, which
`emailTheme.test.ts` asserts equal to `globals.css` — a mail client cannot resolve
`var(--bg)`, so the values must be inlined, and an inlined value is one nobody updates.

**One CTA per email**, target from `lib/email/ctaTargets.ts`. `emailCtaTargets.test.ts`
reads both the email vocabulary and `DashboardClient`'s handler, so **a CTA the app ignores
fails the build** — the CTAs previously pointed at the marketing homepage, four steps and
two guesses from the one action we ask for.

## Not built

Emails 2 (First read) and 3 (Pattern) are SLT-approved and unbuilt. There is **no open or
click instrumentation of any kind**.
