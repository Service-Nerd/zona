// guideLink.ts — EMAIL-WAVE-4 (the buildable half).
//
// 🔴 FOUNDER PROPOSAL, 2026-09-24: *"we can have conditions in email to send
// certain links if they exist. If we build that now it would just work when the
// pages arrive."* Fried approved it without reservation — *"less code than the
// alternative and it deletes a future edit."*
//
// The catalogue is already the single source of truth for what is published, so
// this asks it rather than holding a second list that would drift.
//
// ── THE RULE THAT MATTERS ────────────────────────────────────────────────────
//
// **A null REMOVES the paragraph.** It never degrades to a generic line and never
// links a hub as a consolation. That is not fastidiousness: the CTA on every
// email pointed at the marketing homepage for months precisely because a fallback
// felt harmless, and it cost four steps and two guesses to the one action we ask
// for. **A link with nothing behind it is worse than no link.**
//
// ⚠️ ONLY GUIDES ARE ELIGIBLE. A guide carries `principleRefs`, so every claim in
// it names the `CoachingPrinciples.md` section behind it. A marketing page has no
// such citation and does not belong in a coaching email — that citation is the
// whole reason a Zonna guide is worth sending someone.

import { guideArticles, guidesArePublished, articlePath } from '@/lib/marketing/articles'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://www.zonna.run'

export interface GuideLink { href: string; title: string }

/**
 * The guide for a topic, or `null` when there is not one yet.
 *
 * ⚠️ Matched on the guide's INTENT, never its slug. A slug is a URL and URLs get
 * rewritten; `intent` is the hub grouping the SLT ruled on (W-01c) and it is the
 * field that actually answers "what is this guide for". Matching on a slug string
 * would be the label-based classification this codebase bans (D-17).
 */
export function guideLinkFor(intent: 'easy' | 'week' | 'wrong' | 'kit'): GuideLink | null {
  // The hub gate: an email must not link a page that 404s because the section
  // has not opened yet.
  if (!guidesArePublished()) return null

  const match = guideArticles().find(a => a.intent === intent)
  if (!match) return null

  return { href: `${BASE_URL}${articlePath(match)}`, title: match.metaTitle }
}
