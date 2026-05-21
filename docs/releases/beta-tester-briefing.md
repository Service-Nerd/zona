# Beta Tester Briefing — copy/paste ready

**Job:** what you actually send to each of the 5–7 TestFlight beta testers. Two messages: the initial ask + the post-install brief.

---

## Message 1 — the initial ask (text / WhatsApp / email)

Use this when reaching out to ask if someone will test. Keep it short — they say yes or no on one read.

> Hey [name] — I'm a couple of weeks out from launching the running app I've been building. Before it hits the App Store I'm looking for 5–7 people I trust to install it via TestFlight and use it like a real runner would.
>
> The ask: install it, generate a plan, log 2–3 runs over a week, tell me where it breaks or where the copy makes you cringe. No formal report needed — voice notes / texts whenever you spot something is perfect.
>
> It's called **Zonna**. The pitch: *plans that stop you overtraining.*
>
> If you're up for it I'll send a TestFlight invite to your Apple ID email. ~10 minutes of setup, then it just lives on your phone.

**Variants by profile:**

- **Profile 1 (serious-amateur runner in race build):** add — *"You're the closest user to my actual target — anything that feels off-base or generic is what I most need to hear."*
- **Profile 2 (returning runner post-injury):** add — *"There's an 'easy days' coaching pitch built in that I want to know if it lands or feels patronising."*
- **Profile 3 (first-time marathoner):** add — *"The first 10 minutes are make-or-break — does the onboarding actually help you understand what you're about to do, or does it just throw you into a plan?"*
- **Profile 4 (Garmin / Strava power user):** add — *"You'll find missing features compared to your current setup — please tell me which ones genuinely break the experience vs which are just 'different from what I'm used to.'"*
- **Profile 5 (HealthKit-rich iOS user):** add — *"You've got the most workout history of anyone I'm asking — I want to see how the app handles a real data tail rather than a fresh install."*
- **Profile 6 (non-runner, judges marketing):** add — *"I'm not asking you to use the app — just install it, look at the screens, and tell me whether the pitch is clear and whether it looks like something a real person would download. Worst-case feedback is 'I have no idea what this does after 30 seconds.'"*
- **Profile 7 (pace-junkie):** add — *"The whole app is built around heart-rate zones, not pace. I want to know if you find that frustrating, freeing, or just confusing."*

---

## Message 2 — the post-install brief (email / shared doc)

Send **after** they accept and you've added them to the TestFlight internal-testing track. This is the actual "what to look for" guide. It sets expectations and tells them how to send useful feedback.

> # Welcome to Zonna beta
>
> You're one of 5–7 people I asked to road-test the app before App Store launch.
> Here's everything you need.
>
> ## Installing
>
> 1. You'll get a TestFlight email from Apple within 24h of accepting.
> 2. Install the TestFlight app from the App Store if you don't have it.
> 3. Tap the invite in the email → "Install Zonna."
> 4. TestFlight builds expire every 90 days — if it stops working, ping me, I'll send a new one.
>
> ## First 10 minutes
>
> Sign in with Google or Apple. Run the wizard. Accept the plan it generates.
>
> If you have an Apple Watch: connect Apple Health (it'll ask). This is what makes the coaching read your runs automatically.
>
> If you use Strava and want to: connect Strava from the Profile screen. Optional — Apple Health alone is enough.
>
> ## What I want you to do
>
> - Use it as you would a real running app for at least a week.
> - Log 2–3 runs minimum (manual logging works fine if you don't have a watch).
> - Open the app each morning — there's a daily coach note that updates.
> - Tap into different screens. Get lost. See where the app doesn't help you find your way back.
>
> ## What I want to hear back
>
> The five things I'm most useful feedback on:
>
> 1. **Where it broke.** Crash, blank screen, button doesn't work, weird state. Screenshot + one sentence is plenty.
> 2. **Where the copy made you cringe.** Patronising, overconfident, cheesy, off-brand, weirdly American. Any of those.
> 3. **Where you got confused.** "Why is this here?", "What does this mean?", "What was I supposed to do?"
> 4. **What's missing that you actually need.** Be honest — but tell me *why* you need it, not just *what* it is.
> 5. **One thing you genuinely liked.** Helps me protect the things that work.
>
> ## What I'm NOT looking for
>
> - Bug reports without context — "the app is slow" doesn't help me; "the Today screen took 4+ seconds to load when I came back from Strava" does.
> - Polish notes ("the spacing here is off") — those come later. Right now I care about whether the *thing* works.
> - Suggestions for new features. There's a backlog. The job at launch is not to grow scope.
>
> ## How to send feedback
>
> Whatever works for you:
>
> - **Voice notes** — best signal-to-noise.
> - **Screenshots + one-line texts** — also great.
> - **Email** — fine but slower.
> - **A long form report** — only if you want to. Not expected.
>
> Send to: [your contact method]
>
> ## The honest disclaimers
>
> - **It's a beta.** Things will break. Push notifications might fire at weird times. Plans might regenerate in strange ways. Tell me when this happens — that's literally the point.
> - **It costs nothing.** No payment required during beta. The "Subscribe" button exists but you don't need to tap it — the trial gives you everything for 14 days, and even after that the free tier still works.
> - **Your data is real.** It writes to my production database (because I want the real thing to break, not a sandbox). I'll delete your test account on request, no questions.
> - **It's UK English.** If something reads American to you, that's a bug.
>
> ## How long
>
> Use it for a week minimum. Two weeks is the sweet spot — you'll hit the post-trial state and that's a big surface I want eyes on.
>
> ## Thank you
>
> Genuinely — this is the part of shipping I can't do alone.
>
> — Russ

---

## After the beta — exit survey (optional)

If you want a clean exit signal from each tester after the beta, send this in a single message:

> Hey — final beta question, then I leave you alone:
>
> 1. Out of 10, how likely are you to keep using Zonna after launch?
> 2. Out of 10, how likely are you to recommend it to a running friend?
> 3. One thing I should fix before launch?
> 4. One thing I should never change?
>
> No need to write essays. Numbers + one line each is gold.

The two numbers are your NPS proxy. The two one-liners are your top-priority backlog input.

---

## Don't forget

- Add each tester to **App Store Connect → TestFlight → Internal Testing → Testers** by Apple ID email **before** sending Message 2 — otherwise the invite never arrives.
- Tell each tester their data is real, not sandbox. (Repeated in Message 2 but worth saying again on the call.)
- Anyone who gets cold feet, no pressure. Half-hearted feedback is worse than none.
