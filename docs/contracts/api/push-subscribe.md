# API Contract — /api/push/subscribe

## POST — save subscription

**Auth:** Bearer token. Tier resolved via `getUserTier`; returns 403 for free tier. `is_admin` accounts resolve as paid (ADR-003 § Admin entitlement).

### Request body

Web shape:

```json
{
  "endpoint": "https://fcm.googleapis.com/...",
  "keys": { "p256dh": "BNsz...", "auth": "tBH..." },
  "timezone": "Europe/London"
}
```

iOS shape:

```json
{
  "platform": "ios",
  "token": "<APNs device token>",
  "timezone": "Europe/London"
}
```

Web: `endpoint` + `keys.p256dh` + `keys.auth` required (422 if missing). iOS: `token` required (422 if missing). `timezone` is **optional** on both — when present and a valid IANA zone, it is written to `user_settings.timezone` so the daily push fires at the device's local 06:30. An invalid zone is ignored (not stored).

### Response — 200

```json
{ "status": "subscribed" }
```

Upserts to `push_subscriptions` (conflict key: `user_id, endpoint`; iOS rows store the device token in `endpoint` with null `p256dh`/`auth`).

---

## DELETE — remove subscription

**Auth:** Bearer token (any tier).

### Request body

```json
{ "endpoint": "https://fcm.googleapis.com/..." }
```

### Response — 200

```json
{ "ok": true }
```

Deletes matching row from `push_subscriptions`. No-op if not found.

---

## Error responses

| Status | Condition |
|--------|-----------|
| 401 | No valid session |
| 403 | Free tier (POST only) — `is_admin` resolves as paid, so admins are not blocked |
| 422 | Missing endpoint/keys (web) or token (ios) — POST only |
| 500 | DB upsert failed |

## Notes

- VAPID keys required in env: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.
- iOS sends route through APNs (`lib/apnpush.ts`); env: `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY`, `APNS_TOPIC`, `APNS_PRODUCTION`.
- Stale subscriptions (410 Gone / `BadDeviceToken` / `Unregistered`) are auto-cleaned by the send cron.
- `timezone` write is a secondary capture point; `DashboardClient` also syncs the browser zone on load when the stored value is still the `'UTC'` default.
