# `SignOutLink` — contract

**Component:** `components/shared/SignOutLink.tsx`

The single owner of *"sign out from a screen that has no other way out"*. **4 importers.**

⚠️ **Written 2026-11-15 (`CONTRACT-COVERAGE-03`, highest reach first).**

## Prop interface

```typescript
interface SignOutLinkProps {
  disabled?: boolean
}
```

⚠️ Declared inline; the name above is the contract's, for the prop-for-prop gate.

`disabled` is true while the host screen is mid-action, so the escape cannot fire underneath an
in-flight permission prompt or plan save. It composes with the component's own `busy` state:
either one blocks the tap.

## Invariants

1. 🔴 **IT EXISTS BECAUSE AN AUTHENTICATED USER WITH THE WRONG ACCOUNT WAS TRAPPED**
   (`ONBOARD-EXIT-01`). The onboarding gate sequence — wizard → Orientation → Connect Runs →
   push permission — renders IN FRONT of the Me screen, where sign-out lives, and the bottom nav
   is hidden throughout. A typo'd email, the wrong Google identity, a shared device or a demo
   meant backing out of the wizard to an empty Today, then Me, then the *"Careful Now"* section:
   four taps, the last beside the most destructive control in the app.
2. 🔴 **ONE COMPONENT, BECAUSE THE SECOND COPY HAD ALREADY DRIFTED.** `ConnectRunsScreen` had
   this button hand-rolled and **it never called `clearWidgetState()`** — a user at that screen
   HAS a plan, so signing out left the previous account's race countdown on the home-screen
   widget for whoever signed in next. The D-16 class this repo keeps paying for (the tier ladder
   had three copies, the deload cadence five).
3. ⚠️ **THE SEQUENCE IS OWNED ONE LEVEL DOWN, IN `lib/auth/signOut.ts`, AND MUST STAY THERE** —
   the Me screen's button is presented differently and must behave identically. This component
   owns the *presentation*, never the steps.
4. 🔴 **IT MUST BE A ROUTE CHANGE, NOT `window.location`.** On iOS a full-document load to a path
   outside `server.url`'s `/dashboard` prefix is handed to Safari, which ends the session outside
   the app. Enforced in `lib/auth/signOut.ts`.
5. ⚠️ **NOT the "Careful Now" treatment.** `ui-patterns.md` § SectionLabel groups sign-out with
   account deletion, which is right on Me — a considered action among your settings — and wrong
   here: a destructive-group heading on a screen whose job is to welcome someone builds an
   ejector seat. This is a quiet text link, secondary to whatever the screen's real secondary
   action is.
6. ⚠️ **`marginTop` IS SEPARATION, NOT DECORATION.** On Connect Runs this link sits directly
   under that screen's own *"Not now →"* skip, and at 375px the two read as a pair of
   near-identical muted links — one skips a step, the other ends the session, on the one
   onboarding screen where the runner already HAS a plan to lose. A rule would be a decorative
   divider (banned), so it is space. Caught on `/onboarding-preview`; **no test sees this.**
7. **A disabled control must LOOK unavailable.** `opacity: 0.4` as well as the cursor — `cursor`
   alone changed nothing a runner could see.
8. **`minHeight: TAP_TARGET_MIN_PX`** (44px, iOS HIG). The hand-rolled original used 40.
9. **No hardcoded colour.** `var(--mute)`, `var(--font-ui)`, `var(--space-2)`.

## Pattern

`ui-patterns.md` § quiet text link. Ruling: `ONBOARD-EXIT-01`.
