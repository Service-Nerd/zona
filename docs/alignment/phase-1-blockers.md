# Phase 1 Blockers

Tasks skipped due to high risk or blocking dependency.
Each entry has full context so the user can resolve and re-run.

---

*No blockers logged as of Phase 1 completion.*

---

## Notes

- Baseline build failure at `/api/webhooks/revenuecat`: pre-existing env issue, not a Phase 1 blocker. Vercel has the required env vars. See phase-1-decisions.md D-001.
- `npm run build` locally will continue to show this error unless `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set in the local shell environment. This does not affect Vercel deployment.
