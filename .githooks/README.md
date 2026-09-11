# Git hooks

**These are the hooks that run. `.git/hooks/` is not.**

`package.json`'s `prepare` script sets `core.hooksPath=.githooks` on every
`npm install`, so a fresh clone is wired automatically.

## Why this exists

Until 2026-09-11 `core.hooksPath` was unset, so git ran `.git/hooks/pre-commit` —
an **untracked local copy** that had drifted **31 lines behind** this directory.
The missing lines were the **API route auth-boundary check** from security audit
findings 1 and 11, the one that stops a route shipping without
`getUserFromRequest` or a webhook-signature check.

So a committed security guard had been silently inactive on the dev machine, and
nothing could have told us: an untracked file cannot drift *visibly*.

`.git/hooks/` is not version-controlled and cannot be. Pointing git at a tracked
directory is the only arrangement where "the hook in the repo" and "the hook that
runs" are the same file.

## Verifying

```
git config core.hooksPath        # → .githooks
```

If that prints nothing, run `npm install` (or `npm run prepare`).

## What runs on pre-commit

1. **Palette + fonts** — no hardcoded hex or banned font in `app/` or
   `components/`. `app/api/og/**` is exempt: `next/og` renders via satori with no
   CSS custom properties, so a token resolves to nothing (CLAUDE.md records this).
2. **`setProperty`** — blocked in `app/` and `components/`.
3. **Data-source doctrine** — no direct writes to `strava_activities` outside the
   single ingestion gateway (INV-DATA-008).
4. **API route auth boundary** — every changed `app/api/**/route.ts` must
   authenticate, or be allowlisted as public, or carry `// @public-route: <reason>`.
5. **Label-based session classification** — blocked; classify on a structural
   field the producer stamps (D-17).
