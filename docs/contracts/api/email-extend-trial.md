# `GET /api/email/extend-trial`

**Route:** `app/api/email/extend-trial/route.ts` · ACT-EMAIL-DAY14-01 · 2026-11-11

Grants the seven extra days offered by the day-14 email. Returns a self-contained HTML page,
never JSON: the reader is in a mail client, not the app.

## Why it exists

📐 `ops_events.email_sent`, by subject: **"Fourteen days, no runs read." went out 13 times of
16.** The last thing most trial runners heard from Zonna was a count of zero, in a mail asking
them to pay for reads. The measured cause is usually ours rather than theirs: of 37 trialists,
**24 had no trainable plan week inside their trial at all**. A trial in which the product never
did its one trick is not a trial anyone can decide on.

## Auth

**The token IS the auth**, exactly as `/api/email/unsubscribe` does it, and it is the same token:
the runner's `email_unsubscribe_token`, a random uuid with a unique index.

⚠️ **One secret per runner, not two.** Minting a second would double what there is to leak for no
gain.

⚠️ **The power it grants is bounded and one-directional**: seven extra days of a trial, once,
ever. It cannot revoke access, cannot change tier, and cannot be replayed for more.

| Param | Required | Meaning |
|---|---|---|
| `t` | yes | `user_settings.email_unsubscribe_token` |

## Behaviour

| Case | Response | Ops event |
|---|---|---|
| No `t` | 200, "That link is incomplete." | — |
| Read failed | 200, "Something went wrong." | `trial_extend_failed` `{ stage: 'read', message }` |
| Token unknown | 200, "We don't recognise that link." | `trial_extend_failed` `{ stage: 'unknown_token' }` |
| Already extended | 200, naming the days they have | `trial_extended` `{ outcome: 'already' }` |
| Write failed | 200, "Something went wrong." | `trial_extend_failed` `{ stage: 'write', message }` |
| Granted | 200, "7 more days." | `trial_extended` `{ outcome: 'granted', days }` |

⚠️ **ALWAYS 200.** A mail client rendering an error page tells the reader we are broken, when the
honest message is usually "that link is old". The outcome lives in the ops event.

⚠️ **A failed READ is not an unknown token.** Telling a runner holding a valid link that we do not
recognise it would be a lie we could not detect afterwards, so the two are different branches with
different events.

⚠️ **IDEMPOTENT, and the second click says so.** The update is conditional on `trial_extended_at`
still being null, so two concurrent clicks cannot both win and a pre-fetching mail client cannot
grant a fortnight. `already` is recorded as an outcome rather than ignored: "clicked twice" and
"granted twice" must be distinguishable, and only one of them is a defect.

## What it changes

`user_settings.trial_extended_at`, once. Read by `resolveTrialWindow()` (`lib/trial.ts`), which
adds `TRIAL_EXTENSION_DAYS` to whatever window the policy produced — **after** the cap, not inside
it, so a runner who took the offer and then read on day 25 gets day 37 rather than being silently
held at 30.

⚠️ **It does not touch `trial_started_at`.** Moving the start would re-open the day-11 and day-14
email windows and re-send both.

⚠️ **Not covered by `guard_privileged_user_settings`** (INTERNAL-ACCOUNTS-01), deliberately: a
runner extending their own trial is the feature. Setting their own `is_admin` was the escalation.

Tests: `lib/email/postTrialEmails.test.ts`.
