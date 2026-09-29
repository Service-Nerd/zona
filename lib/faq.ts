// FAQ-01 — the SINGLE OWNER of every question-and-answer pair in the product.
//
// 🔴 WHY THIS IS A SHARED MODULE AND NOT TWO ARRAYS. Before this file there were
// FAQs in three places with three separate copies: `app/page.tsx` ("The obvious
// ones."), `app/charity-runners/page.tsx` (its own `FAQS` const), and `/support`
// as prose headings. Nothing connected them, so an answer could be corrected in
// one and stay wrong in the others — the exact shape of the drift this repo spent
// 2026-09-29 removing from micro-labels, and of TIER-OWNER-01, DELOAD-OWNER-01 and
// OPS-AI-OWNER-01 before that. A fourth copy for the app would have been the point
// at which the set became unmaintainable.
//
// ⚖️ SIERRA'S CONDITION, BINDING (Design Board, FAQ-01): *"A FAQ is a patch over a
// product that isn't obvious. Every question you answer there is one the screen
// failed to answer."* So every entry carries `shouldBeObviousOn` — the surface that
// ought to have answered it without being asked. That field is not decoration and it
// is not rendered: it keeps this list readable as a DEFECT LOG rather than letting it
// settle into furniture. When a screen is fixed, its question leaves.
//
// 🏃 COACHING BOARD. Any answer making a claim about outcomes or physiology is the
// Coaching Board's on ANY surface (the W-03 precedent), including this one. The five
// entries marked `cleared: 'charity-runners'` are reproduced VERBATIM from
// `/charity-runners`, which the board has already ruled on — reusing the ruled words
// rather than paraphrasing them is deliberate, because a paraphrase of a cleared claim
// is a new claim. Anything new here is written as MECHANISM (what the app does), never
// as physiology (what it does to you). A new physiological claim needs a sitting.
//
// ✍️ VOICE. `brand.md` rules apply: one sentence beats two, specific beats abstract,
// never motivational. ⚠️ NO EM DASHES — these strings are read by the runner in-app, so
// `noEmDashApp.test.ts` governs them, and the marketing surface is in `noEmDash.test.ts`.

import { BRAND } from '@/lib/brand'
import { PRICING } from '@/lib/brand'

export interface FaqEntry {
  q: string
  a: string
  /** Which surfaces render this. The app set is about USING the product; the web set
   *  is about deciding to. A few are genuinely both. */
  scope: 'app' | 'web' | 'both'
  /** ⚖️ Sierra's condition: the screen that should have made this unnecessary.
   *  `null` only where the question is inherently external (billing, Apple, a charity). */
  shouldBeObviousOn: string | null
  /** Where this answer's claim was cleared, when it carries one. */
  cleared?: 'charity-runners'
  /** 🔴 THE EXACT WORDS THAT WERE CLEARED, which must still appear on the clearing
   *  surface. Not a heuristic slice of the answer: the first version of the gate took
   *  the answer's opening clause, and for the ultra entry that let a genuine paraphrase
   *  through until the probe was made explicit. A claim is cleared as a SENTENCE, so
   *  the sentence is what gets pinned. Case-insensitive, because only the wording of
   *  the claim is ruled, not where it sits in a paragraph. */
  clearedProbe?: string
  /** 🔴 WHICH ANSWER LIVES WHERE, so no page answers the same thing twice.
   *  ⚠️ `product`, not `training`. The first cut called this bucket `training` and then
   *  put "What is free, and what do I pay for?" in it, which is not a training question
   *  by any reading — a taxonomy that needs an exception on its second use is the wrong
   *  taxonomy. Renaming beat adding a fourth category (Collins, taxonomy collapse).
   *  `/support` already answers the account half IN PROSE ("Managing your
   *  subscription", "Your account & data"). Rendering every web entry there would
   *  have put two answers to "how do I cancel" on ONE page — the fourth-copy problem
   *  this module was created to stop, reappearing inside the fix for it. So the web
   *  page takes `training` only and keeps its prose; the app takes everything, because
   *  in the app there is no prose version. */
  topic: 'product' | 'using' | 'account'
}

export const FAQS: FaqEntry[] = [
  // ── The proposition itself ────────────────────────────────────────────────
  {
    q: 'Why is so much of my plan easy?',
    a: 'Because that is what works, and because the alternative is what breaks people. Running easy on your easy days is what lets the one hard session a week actually be hard. Runners rarely miss the start line through lack of effort. They miss it through too much of it, too early.',
    topic: 'product',
    scope: 'both',
    shouldBeObviousOn: 'Today (the session card states the zone, but never the reason)',
    cleared: 'charity-runners',
  },
  {
    q: 'What if I miss a week? Work, illness, life.',
    a: 'Nothing breaks. Missed sessions are a feature of adult life, not a failure. The plan reshapes around what you actually did rather than leaving you to catch up on a week that has gone. Nobody guilt-trips you.',
    topic: 'product',
    scope: 'both',
    shouldBeObviousOn: 'Plan (a reshaped week does not say it reshaped itself)',
    cleared: 'charity-runners',
  },
  {
    q: 'Do I need a watch?',
    a: `It works best with a heart-rate source, an Apple Watch or a chest strap that writes to Apple Health, because that is what proves your easy days are genuinely easy. Without one you still get the plan, the paces and the structure. You just judge effort yourself.`,
    topic: 'product',
    scope: 'both',
    shouldBeObviousOn: 'Connections (it says what is connected, not what you lose without it)',
    cleared: 'charity-runners',
  },
  {
    q: 'I have never raced this distance. Is this for me?',
    a: 'Yes, with one caveat worth saying out loud. The plans assume you can already run about 30 minutes without stopping. If you cannot yet, spend a few weeks building to that first and then start. Beginning a structured block from zero is the most reliable way to get injured before race day.',
    topic: 'product',
    scope: 'both',
    shouldBeObviousOn: 'Generate Plan (the wizard asks your level and never says what the floor is)',
    cleared: 'charity-runners',
  },
  {
    q: 'I am doing an ultra. Does this cover that?',
    a: 'The app builds 50K and 100K plans like any other distance. The further the race, the more of your week should be easy, so if anything the approach holds harder.',
    topic: 'product',
    scope: 'both',
    shouldBeObviousOn: 'Generate Plan (distance list)',
    cleared: 'charity-runners',
    // Only the claim is pinned. The first sentence is mechanism (which distances the
    // engine builds) and was rewritten to drop the charity framing, which is allowed.
    clearedProbe: 'the further the race, the more of your week should be easy',
  },

  // ── Using the app ─────────────────────────────────────────────────────────
  {
    q: 'Where do my heart-rate zones come from?',
    // MECHANISM ONLY. What the app computes, not what a zone does to you. A sentence
    // about adaptation would be a physiological claim and would need the board.
    a: 'From your maximum heart rate, and your resting heart rate when Apple Health has given us one. If you have not set a max we estimate it from your age, which is rough. Setting a real one under Heart rate makes every target sharper.',
    topic: 'using',
    scope: 'app',
    shouldBeObviousOn: 'Heart rate (it shows the zones, not where they came from)',
  },
  {
    q: 'Why did my plan change on its own?',
    a: 'Small adjustments happen quietly when a week does not go to plan. Anything structural, moving a session to a different day, swapping its type, or a change of more than about 15 percent, is shown to you first and waits for you to accept it.',
    topic: 'using',
    scope: 'app',
    shouldBeObviousOn: 'Plan (a quiet adjustment leaves no trace of itself)',
  },
  {
    q: 'My run is not showing up.',
    a: `${BRAND.name} reads finished runs from Apple Health. If a run is missing, pull down on Today to sync, and check ${BRAND.name} still has permission under iPhone Settings. A run recorded on a watch can take a few minutes to reach Apple Health before we can see it at all.`,
    topic: 'using',
    scope: 'app',
    shouldBeObviousOn: 'Today (a missing run looks identical to a rest day)',
  },
  {
    q: 'What is free, and what do I pay for?',
    a: `The plan, every session, the paces and the logging are free and stay free. Paying adds the coaching after each run, the reshaping when a week goes sideways, and the AI plan generation. It is ${PRICING.monthly.display} a month or ${PRICING.annual.display} a year.`,
    topic: 'product',
    scope: 'both',
    shouldBeObviousOn: 'Upgrade',
  },

  // ── Account and billing: inherently external ──────────────────────────────
  {
    q: 'How do I cancel?',
    a: 'Through Apple, not through us. Open iPhone Settings, tap your name, then Subscriptions. Cancelling stops the renewal and you keep access until the period you have paid for runs out.',
    topic: 'account',
    scope: 'both',
    shouldBeObviousOn: null,
  },
  {
    q: 'I have a code from my charity.',
    a: 'Redeem it under Subscription on your profile. It gives you the whole app free, not a trial and not a cut-down version, through your training and a week past race day.',
    topic: 'account',
    scope: 'both',
    shouldBeObviousOn: null,
  },
  {
    q: 'Can I get my data out, or delete it?',
    a: 'Both, from your profile. Deleting your account removes your runs, plans and health samples for good, and it is immediate rather than a request you wait on.',
    topic: 'account',
    scope: 'both',
    shouldBeObviousOn: null,
  },
]

/** The app set: using the product. Derived, never a second hand-written list. */
export const APP_FAQS = FAQS.filter(f => f.scope === 'app' || f.scope === 'both')

/** The web set: deciding on the product. ⚠️ PRODUCT ONLY — `/support`'s own prose
 *  owns the account answers, and two answers to one question on one page is exactly
 *  what this module exists to prevent. */
export const WEB_FAQS = FAQS.filter(
  f => (f.scope === 'web' || f.scope === 'both') && f.topic === 'product',
)

export const FAQ_TITLE = 'Common questions'
export const FAQ_SUBTITLE = 'The ones people actually ask.'
