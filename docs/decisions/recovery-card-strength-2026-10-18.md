# Design Board — strength in the recovery moment (2026-10-18)

**Chair:** Zhuo. **Seats:** Silvanto, Sierra, Wroblewski, Collins. **Ruling:** SHIP WITH AMENDMENT.
**Items:** `STRENGTH-RECOVERY-01` × `READINESS-SURFACE-01` item 2. **Inputs:** Coaching Board re-sitting
2026-10-17 (`strength-recovery-resitting-2026-10-17.md`: the runner decides; one answer covers both sessions).
**Copy:** drafts A–D approved by the founder the same day (*"I like what you've done"*).

## Settled-ground scan
- READINESS-SURFACE-01 (2026-10-17): the moment leads with the runner's reading against their own normal, then the
  change, then *Ease the session* / *Run it anyway*, **equally visible**. Collins lost the amber tile. No dashboard,
  no count, no streak.
- STRENGTH-APP-01 (A): on a run day strength is one compact row; on a no-run day the strength session is the day.
- GHOST-AFFORDANCE-01: no full-width ghost.
- **Measured:** the live card broke "equally visible": a full-width primary beside a small ghost text link.

## Seats
- **Zhuo:** one decision, not two. The lift is a consequence of the same reading: a line on the same card.
- **Silvanto:** reading, then what changes, then the choice. Strength's line in the same 15px register. No new size,
  no colour. No veto.
- **Sierra:** naming both changes on one card teaches that a bad night changes the whole day.
- **Wroblewski:** the override must be a real button the same size as *Ease*. On a no-run day the card sits above
  the strength session and the override says what it keeps. Once answered, the card goes.
- **Collins:** argued for one combined line ("Run and lifts both lighter today"). **Lost**: one line per session is
  clearer when only one of them changes.

## Ruling
1. One card a day, shown when recovery would ease either session; it lists only the sessions that change.
2. Strength line: one sentence in the body register, under the run line if there is one.
3. Two equal buttons; *Ease the session* primary, the override secondary. Fixes the live card.
4. No-run day: the same card, above the strength session; the override reads *Lift as planned*.
5. After answering the card goes; Ease puts "Eased for recovery" on whatever changed; the override changes nothing.

## Read at build time (no new ruling)
- **Stacked, not side by side.** Half-width each at 375pt wrapped *Ease the session* onto two lines; the two buttons
  stack full-width instead (measured 299 × 51 and 299 × 53). Same size, same tap target, which is the ruling's point.
- **The override reads *Lift as planned* whenever the run is not changing**, including an easy-run day with a lift
  (the easy run is never eased), not only a day with no run.
- **The strength line is read from what the ease keeps**, so it never names work the session does not hold. Found
  doing so: running-focus "Full body" sessions at 30 and 45 minutes often hold no upper-body work at all
  (`STRENGTH-FULLBODY-NO-UPPER-01`), and their line honestly reads "core and calf work".
- **Not optimistic.** The card stays until the server has the answer; a failed save is said (InlineError) and the
  card can be retried. If the run's answer saves and the lift's does not, the card returns strength-only.

## Artifacts
Pattern: `ui-patterns.md` § 17b amended. Constants: `lib/ui/recoveryCardCopy.ts` (A–D, `EASE_LABEL`). Checks:
`components/dashboard/recoveryCard.markup.test.ts`, `lib/ui/recoveryCardCopy.test.ts`, `lib/api/readinessStrengthDay.test.ts`.

## What this does not settle
Nothing felt in a hand on a device (Chromium at 375pt only). The website and push words (item 5, item 6) still need
the Coaching Board.
