# Make-A-Wish UK — runner FAQ

**For Jack to send with the codes.** `GTM-CHARITY-09`, SLT 2026-09-18.

> **This is a document, not a support surface.** No help centre, no ticketing, no chat.
> Five questions, in the charity's register, so Jack's team can answer a runner without
> routing them to us. Traynor's reasoning: the failure mode is not ticket volume, it is
> **the charity fielding our questions**, and that is what damages the referral.
>
> ⚠️ **DRAFT — founder edits before it goes out.** SLT `CONTENT-AUTHORSHIP-01`: Claude
> drafts, the founder edits and reads it end to end. It is partner-facing copy in someone
> else's voice, so the register is the founder's call, not mine.

---

## Before you send it, Jack — three things on our side

**1. A handful of your 500 will not be able to install at all.** Zonna is iOS only and
needs iOS 16.6 or newer, which rules out an iPhone 7 and anything older. There is no
Android version and no mobile web version. It is worth saying this in your covering note
rather than letting someone spend an evening thinking they have done something wrong.
We are not planning to build Android for this.

**2. The codes come from you, not from us.** We cannot issue one directly to a runner, so
anyone who contacts us gets sent back to you, which is the loop this document exists to
prevent. One code each, used once.

**3. Tell them to redeem when they install, not when they get stuck.** It costs them
nothing to do it on day one, and it means nobody discovers a problem in week six.

---

## The FAQ

### "My code will not work."

Nine times in ten this is one of three things.

The link we sent opens the App Store with the code already filled in. Redeem it there, in
the same place you install the app, rather than typing it in somewhere else. If you have
already installed Zonna, the link still works: it just takes you back to the App Store to
redeem.

If it says the offer is not available, check you are signed in to the Apple ID you want
the access on. The access attaches to the Apple ID that redeems the code, not to the email
address you later sign in with. If you redeemed on a family member's iPad, that is where
it went.

And if a code has already been used once, it is spent. Come back to us and we will look at
whether there is a spare in the batch.

### "I have redeemed it, but my plan has not started yet."

That is almost certainly correct, and it is the part of Zonna people find strangest.

The plan is built backwards from your race day, not forwards from today. If your race is
in April and you are setting this up in October, a full marathon block does not need to
start yet, so the app will tell you how many weeks early you are and give you something
much gentler to be getting on with in the meantime.

It is not a fault and you have not missed a setting. Almost every other running app would
fill those months with training. We would rather you arrived at the start of the real
block fresh than arrive at the start line injured, and the months before a block are where
most charity runners quietly get hurt.

### "Why is so much of my plan easy? I have a marathon to train for."

Because that is what works, and because the alternative is what breaks people.

Running genuinely easy on your easy days is what allows the one hard session in your week
to actually be hard. Most charity runners do not miss their race because they were too
slow. They miss it because they got injured in training, usually by running every run at
the same middling effort because it felt like trying.

If the easy days feel almost embarrassingly slow, the plan is working. That is the whole
idea, and it is not us going easy on you.

### "It says it has no heart rate data."

Zonna works best with a heart rate source: an Apple Watch, or a chest strap that writes
into Apple Health. That is what proves your easy days are genuinely easy rather than
merely feeling easy.

Without one you still get the full plan, the paces, the structure and the coaching. You
judge the effort yourself instead of the app checking it for you. To be straight with you,
if you run with just an iPhone and no watch, the heart rate side of the coaching will stay
switched off. Everything else works.

### "How long does the access last, and what happens at the end?"

Twelve months from the day you redeem the code. Redeem in December and it runs to the
following December, which covers a spring race and the whole block in front of it with
room to spare.

It does not renew and it will not start charging you. It simply stops.

When it does, you keep the plan you built and drop to the free version. Nothing is deleted
and nothing will nag you. If by then you want to keep the coaching and the automatic
reshaping, it is £7.99 a month or £59.99 a year, and if you would rather not, that is
genuinely fine. Your place and your plan are not conditional on it.

---

## Notes for us, not for the runners

- ⚠️ **Hutchinson's condition is binding and I have kept it:** *"why is my plan so easy"*
  is answered by §1 and §12 and **must not be softened into an apology.** It is the
  product. If this gets edited, that answer is the one to leave alone.
- ⚠️ **Wood added the runway question** and it was not on anyone's original list. The
  28-week Oct-to-April gap will generate support load nobody has planned for, and it is
  the question most likely to be read as a bug.
- **Sutherland, on the same point:** *"Oct to April is twenty-eight weeks. Every other
  running app would fill that with training. We are going to tell 500 anxious first-timers
  do almost nothing yet. That is the brand, in the one moment it matters most."*
- **Consistency checked against `/charity-runners`**, which is the page these runners are
  linked to: the three redeem steps, the twelve months, the free-tier landing and the
  pricing all match it. `REDEEM-MECHANISM-TRUTH-01` was that page describing a screen that
  no longer existed, so this was verified against the live copy rather than from memory.
- **Facts verified in code, not recalled:** pricing from `BRAND.PRICING`; the redeem flow
  from `app/charity-runners/page.tsx`; the anonymous-redemption behaviour from
  `CHARITY-OFFER-CODE-01`; the iOS floor from the SLT's 2026-09-18 note.
