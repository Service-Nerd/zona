# POST /api/strength/ease — contract

**Route:** `app/api/strength/ease/route.ts` · **Item:** STRENGTH-RECOVERY-01 (S13; Design Board 2026-10-18).

The runner's answer on Today's recovery card for that day's strength session.

## Request

```json
{ "date": "YYYY-MM-DD", "answer": "eased" | "declined" }
```

## Responses

| Status | When |
|---|---|
| 200 `{ date, answer }` | Stored in `strength_plans.recovery_eases[date]`, other dates kept |
| 401 / 404 | Not signed in / strength not released to this runner (`strengthGate`) |
| 404 | No easeable session on that date in the runner's stored plan (mobility is never easeable) |
| 413 / 422 | Body over 512 bytes / bad date or answer |
| 500 | Read or write failed (`strength_save_failed`, `where: 'ease'`); never a silent success |

## Rules
- **Only the runner answers.** Nothing is eased without `"eased"` here (S13). `"declined"` means "do not ask again".
- **Subtract only.** An ease is `easeForRecovery`, checked by `S-RECOVERY-SUBTRACT-ONLY`, so easing a day is never a
  safety question and the route does not re-check recovery.
- **Storage:** a jsonb column on `strength_plans` (migration `20261018_strength_recovery_eases.sql`). The plan's
  regeneration upsert writes only its own columns, so answers survive a re-placement.
- **Client:** `useStrengthPlan → setStrengthRecoveryAnswer` (not optimistic: the card stays until the save lands).
