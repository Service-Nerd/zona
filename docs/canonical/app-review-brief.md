# The app review — standing brief (founder, 2026-09-22)

**This is the brief the Design Board sits under for the app review.** It was given verbatim by the
founder and is recorded here because a brief that lives in a chat is a brief the next sitting
invents for itself.

---

## 1. The standard everything is judged against

> *"Customer experience and making the customers feel something and all that, that will be
> relatable and a wow moment, is the most important thing when it comes to design for me. I want
> them to feel something. I want them to talk to their friends about the app. I want them to say
> 'look at this'. It needs to be slick. It needs to be wow."*

**This outranks tidiness.** A screen that is correct, compliant, documented and forgettable has
failed the brief. The board's own mandate already says decoration is not feeling and chrome is not
craft — the feeling comes from **what only Zonna can honestly say, and from craft in the saying**.

---

## 2. It is a BLANK SHEET — with one condition

**Nothing is off the table.** Palette, typography, formatting, rejecting a screen outright, adding
screens, moving an element to a different screen. The settled-ground register is **read**, and the
board may **reverse** what it finds there.

⚠️ **The condition is the whole of it: understand the up- and downstream impact and say it out loud.**

- **A change to the app may need to reach the WEB.** The site renders the real app components
  (`SessionCard`, `CoachNoteBlock`, `ZoneRings`, `PlanCalendar`, `PlanArc`) — changing one changes
  both. That is acceptable; it is not acceptable to discover it afterwards.
- **If it fits the brand, it is fine, and the brand documents get updated.**
- 🔴 **If it is a SIGNIFICANT brand update, it goes to the SLT FIRST.**

**So the settled-ground scan still runs — it just no longer ends the argument.** Its job here is to
tell the board what it is about to reverse and what that costs.

---

## 3. The board must not rubber-stamp the founder

He gives his own UX/UI feedback screen by screen **before** the sitting. The seats must:

- **Challenge it.** Where he is wrong, say so and say why.
- **Bring findings he did not raise.** A sitting that only processes his list has not reviewed the app.
- **Rule on measurements where measurements exist**, naming the surface and the method — the website
  discipline, unchanged. The website sittings proved it in both directions: three times his eye
  found what the measurements missed, and twice the measurements found what no eye could see.

---

## 4. Rory Sutherland (SLT) — scoped

Consulted on a **wrong-screen / UX** question. **Advisory, recorded, and only when the board splits.**
He does not bind the ruling.

---

## 5. What the board must know going in

- **The whole website arc of 2026-09-22** — where the site was that morning and every ruling since.
  `design-rulings.md` §§ 6–6f: proof moved 52% → 24%, the spotlight followed it, the palette
  question was killed on the founder's device verdict, three device passes each found something the
  measurements missed.
- **The brand, thoroughly** — `brand.md`: positioning, audience, voice, the three-line tagline
  system, and what the product is for.
- **What shipped in the engine today that it has not seen** — §120 (the card header now states the
  pace its reps actually run; 2,811 sessions previously did not) and §121 (the race is no longer
  training volume, so week totals moved).

---

## 6. The seats carry real expertise, not a name

> *"We have instructions for each member which keep getting updated along the way, so we've got
> their full opinions and their full years of expertise. Let's make sure we're prompting them
> correctly — not asking them by that name, but so they bring along their experience as well."*

The Coaching Board's seats carry accumulated standing instruction: the lens, what the seat has
challenged before, and **what it has been wrong about**. The Design Board's seats are held to the
same depth. **A seat invoked as a name produces a paragraph; a seat invoked with its lens produces a
finding.**

---

## 7. Scope

The founder's feedback is **UX/UI only**. He is not ruling on what the engine prescribes. A finding
that touches prescription routes to the Coaching Board before this board rules on it, and a claim
about outcomes or physiology on any surface is the Coaching Board's by the W-03 precedent.


---

## 8. The wizard, WALKED — measured 2026-09-22 before the sitting

Built `app/wizard-preview/page.tsx` because *"no bugs in them"* is a measurement and nobody could
take it: the wizard lives inside `DashboardClient` behind auth, and `onboarding-preview` mounts the
post-generation cards, not the flow. Same harness pattern as the other previews, 404 in production.
**The real component, the real steps, the real validation** — only the save callbacks are stubbed,
and generation needs a session, so the flow is honest up to submission.

**The full PAID flow walks end to end.** 13 answerable steps + 2 teaching interstitials +
generation. Free drops `hard-sessions`, `terrain`, `injuries`.

| # | Step | Control |
|---|---|---|
| 1 | How far? | CardSelect |
| 2 | Tell me about the race. | text + native `date` |
| 3 | What matters most? | CardSelect |
| — | *This plan will feel too easy at first.* | interstitial |
| 4 | How much are you running now? | **Ruler** (`input[range]`) |
| 5 | Longest run in the last six weeks? | **Ruler** |
| 6 | How long have you been at this? | Chip |
| 7 | Been doing the hard stuff? | CardSelect |
| 8 | Where are you right now? | CardSelect |
| 9 | What year were you born? | **WheelPicker** (`role=listbox`) |
| 10 | Recent race result? | text + DurationPicker + Chip |
| — | *Easy should feel easy.* | interstitial |
| 11 | Which days do you run? | **WeekGrid** (`role=group`) |
| 12 | How long on a weekday? | Chip |
| 13–15 | Hard sessions / Where do you run / Anything to flag? | CardSelect, CardSelect, Chip — **PAID** |

### What the walk found

🟢 **No horizontal overflow on any step at 375px.** Measured every step: zero elements past the
viewport. **So the "race date runs off the screen" defect is specific to "Change your plan", not the
wizard** — the two surfaces ask the same question with different results, which is itself the
finding.

🔴 **Four different CTA labels, and the arrow is inconsistent.** `Continue` · `Continue →` ·
`Got it →` · `Skip this →`. Same button, same position, four vocabularies.

🔴 **On an optional step the PRIMARY button says "Skip this →".** The moss-filled primary
(`rgb(107,142,107)` = `--moss`, white text) is spent on **declining to answer**. The affirmative
action is the secondary one. Five of the fifteen steps are optional, so the runner meets this
repeatedly.

🔴 **Six distinct interaction models in one flow** — card, chip, text, native date, range slider,
wheel, day grid. Collins' taxonomy lens, and the wizard is where a new runner meets all of them
inside five minutes.

🟢 **No icons anywhere in the step controls**, confirming the founder's read that there is room.

⚠️ **What this does NOT prove.** Generation needs a session, so nothing past submission is walked —
the generating ceremony, the plan preview, the confidence badge and the difficulty card are all
unverified here. And a walk finds what a walk touches: it clicked the first valid option on every
step, so alternate branches (benchmark confirm-vs-enter, the refusal paths, validation messages)
are untested.
