# Contract — Strava OAuth Routes

**Authority**: This document defines the three Strava OAuth API routes. All OAuth testing must use Hoppscotch — multi-line curl in Mac Terminal consistently fails for this flow.

---

## GET /api/strava/connect

Initiates the Strava OAuth flow by redirecting to Strava's authorisation page.

### Request

```
GET /api/strava/connect?user_id={supabaseUserId}
```

`user_id` is required. If absent, redirects to `/auth/login`.

### Behaviour

Redirects to:
```
https://www.strava.com/oauth/authorize
  ?client_id={NEXT_PUBLIC_STRAVA_CLIENT_ID}
  &redirect_uri={origin}/api/strava/callback
  &response_type=code
  &approval_prompt=auto
  &scope=read,activity:read
  &state={user_id}
```

The `state` param carries the Supabase user ID through the OAuth flow so the callback knows which user to update.

---

## GET /api/strava/callback

Handles the Strava OAuth callback. Exchanges the auth code for tokens and stores them in `user_settings`.

### Request

Strava calls this with:
```
GET /api/strava/callback?code={authCode}&state={userId}
```

On user denial: `?error=access_denied` (no `code`).

### Behaviour

1. If `error` or no `code` → redirect to `/dashboard?strava=denied`
2. If no `state` (user ID) → redirect to `/dashboard?strava=error`
3. Exchanges code via `POST https://www.strava.com/oauth/token` (JSON body, not form-encoded — see note)
4. Stores `access_token`, `refresh_token`, `expires_at` in `user_settings` via service-role client (bypasses RLS)
5. On success → redirect to `/dashboard?strava=connected`
6. On any error → redirect to `/dashboard?strava=error`

### Supabase write

```
user_settings.upsert({
  id: userId,
  strava_access_token: string,
  strava_refresh_token: string,
  strava_token_expires_at: number (Unix timestamp from Strava),
  updated_at: ISO string
})
```

Uses `SUPABASE_SERVICE_ROLE_KEY` — server-side only. Never expose this key client-side.

### Critical notes

- Auth codes expire in ~5 minutes and are **single-use**. Failed exchanges waste the code — a new OAuth flow must be started.
- Strava client secret comes from `STRAVA_CLIENT_SECRET` env var in this route. This is the server-side exception — the secret must never be stored in git or sent to the client.

---

## POST /api/strava/refresh

Refreshes an expired Strava access token using the stored refresh token.

### Request

```
POST /api/strava/refresh
Content-Type: application/json
Body: { "userId": string }
```

### Responses

```json
200: { "access_token": string }
400: { "error": "No user ID" }
404: { "error": "No Strava connection" }
500: { "error": "Token refresh failed" }
```

### Behaviour

1. Fetches `strava_refresh_token` from `user_settings` using service-role client
2. Calls `getStravaToken(refreshToken)` from `@/lib/strava`
3. Returns the new access token

### Tech debt

Token refresh is not proactive — it only runs when explicitly called. The stored `strava_token_expires_at` is not checked before Strava API calls. Implementing automatic refresh before expiry is a known tech debt item.

---

## OAuth Testing

Always use **Hoppscotch** (`hoppscotch.io`) for manual OAuth testing:
- POST to `https://www.strava.com/oauth/token`
- Body as `application/x-www-form-urlencoded`
- Strava client ID: `219980`
- Auth codes expire in ~5 minutes
