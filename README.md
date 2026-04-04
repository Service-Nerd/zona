# @doinghardthingsbadly — Training Hub

Race to the Stones 100km · 11 July 2026 · Make-A-Wish UK

## Stack
- **Next.js 14** (App Router)
- **Supabase** (auth + database)
- **Vercel** (hosting)
- **Tailwind CSS**

---

## First-time setup (do this once)

### 1. Install dependencies
```bash
cd rts-app
npm install
```

### 2. Create a Supabase project
1. Go to [supabase.com](https://supabase.com) → New project
2. Note your **Project URL** and **anon public key** (Settings → API)

### 3. Set up environment variables
Edit `.env.local` and fill in:
```
NEXT_PUBLIC_SUPABASE_URL=your_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
STRAVA_CLIENT_SECRET=your_strava_secret
```

### 4. Run locally
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000)

### 5. Create your account
- Hit Sign up on the login page
- Use your email + a password
- You'll be redirected to the dashboard

---

## Deploy to Vercel (free)

```bash
npm install -g vercel
vercel
```

Follow the prompts. Add your `.env.local` values as environment variables in the Vercel dashboard.

---

## Updating the plan

Edit the Gist at:
`https://gist.github.com/Service-Nerd/efec07a87f65494f0e078a1ccb136100`

The dashboard fetches it fresh on every load (5 min server cache).

---

## Project structure

```
app/
  auth/login/       → Login + signup page
  auth/signout/     → Sign out handler
  dashboard/        → Main dashboard (server + client)
components/
  training/         → PlanGrid, PlanChart, WeekBriefing
  strava/           → StravaPanel (connect, metrics, popup)
lib/
  supabase/         → Browser + server clients
  plan.ts           → Plan fetching + helpers
  strava.ts         → Strava API + data processing
types/
  plan.ts           → All TypeScript types
```

---

## Backlog
- R5: Dynamic plan reshaping (Strava + Claude memory + blockout days)
- R6: Multi-race onboarding flow
- R7: Vercel deployment
- R8: Calendar integration
- R9: Weekly briefing
