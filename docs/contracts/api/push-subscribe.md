# API Contract — /api/push/subscribe

## POST — save subscription

**Auth:** Bearer token (paid/trial). Returns 403 for free tier.

### Request body

```json
{
  "endpoint": "https://fcm.googleapis.com/...",
  "keys": {
    "p256dh": "BNsz...",
    "auth": "tBH..."
  }
}
```

All fields required. Returns 422 if any are missing.

### Response — 200

```json
{ "ok": true }
```

Upserts to `push_subscriptions` (conflict key: `user_id, endpoint`).

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
| 403 | Free tier (POST only) |
| 422 | Missing endpoint or keys (POST only) |
| 500 | DB upsert failed |

## Notes

- VAPID keys required in env: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`.
- Stale subscriptions (410 Gone from push provider) are auto-cleaned by the send cron.
