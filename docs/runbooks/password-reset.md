# Runbook — password reset (AUTH-RESET-01 / UX-AUTH-03)

**Who runs this:** the Supabase account owner. It is the one part of the reset
flow that lives in the dashboard and cannot be set from the repo.

**Time:** about two minutes. **Do it before charity codes go out.**

---

## Why it matters

The recovery email can carry its credential two ways.

| | How it verifies | Works cross-device? | Works on the iOS app? |
|---|---|---|---|
| `token_hash` (what we want) | `verifyOtp` | ✅ | ✅ |
| `?code=` (Supabase's default, PKCE) | exchange against a verifier held **in the browser that asked** | ❌ | ❌ **never** |

PKCE's `code_verifier` is created in the browser that sent the request and never
leaves it. On iOS the request is made inside the **Capacitor webview** and the
email opens in **Safari** — two different browsers on the same device — so the
exchange cannot complete, on any device, ever.

Until 2026-09-11 that failure told the runner *"This reset link is invalid or has
already been used. Request a fresh one and try again."* Following that
instruction produces the identical failure indefinitely. The page now names the
real cause and offers a new link in place (`lib/auth/resetDeadEnd.ts`), but
**honest copy about a broken flow is not a working flow.** This setting is the fix.

---

## The change

**1. Auth → Emails → "Reset Password" template.** Set the link to:

```
{{ .SiteURL }}/auth/reset?token_hash={{ .TokenHash }}&type=recovery
```

Replace the whole `href` of the button/link. The default is
`{{ .ConfirmationURL }}`, which is the PKCE link.

**2. Auth → URL Configuration → Redirect URLs.** Add, if not present:

```
https://www.zonna.run/auth/reset
```

`www` is the canonical host and the only one Capacitor's `allowNavigation`
permits. **Do not add the apex** (`https://zonna.run/...`) — it 307-redirects, and
inside the app a non-allowed host opens in Safari instead of the webview.

---

## Verify it, don't assume it

The app cannot check this for you — the template body is not exposed to the
service-role key or the Management API tools we hold. So verify by doing it:

1. On an **iPhone with the app installed**, sign out, tap **Forgot password?**
2. Open the email **in Mail**, tap the link.
3. **Correct:** the address bar shows `…/auth/reset?token_hash=…&type=recovery`
   and the screen offers "Set a new password".
4. **Wrong:** the address shows `?code=…`, and after about five seconds you get
   *"This link cannot finish here."* That is the honest message doing its job —
   the template is still unset.

Set a password you can use, and check it signs you in. A reset that lands you on
the password form but fails to save is a different problem (check the browser
console / Supabase auth logs).

---

## Related

- `app/auth/reset/page.tsx` — handles BOTH link shapes, so web-same-device works
  even with the template unset. That is why this stayed invisible.
- `lib/auth/sendPasswordReset.ts` — single owner of `redirectTo`, derived from
  `window.location.origin` so it can never name the wrong host.
- `lib/auth/resetDeadEnd.test.ts` — locks the copy so no future edit re-asserts
  that a working link is invalid.
