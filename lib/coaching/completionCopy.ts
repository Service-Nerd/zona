// Hand-authored completion copy keyed by session type. Used on the
// post-log reflect view, on SessionCompleteCard (COMPLETE-01), and on
// the share-image OG route (SAVE-IMG-01).
//
// Rule-engine output — never marked with AIMark.
// Voice rules from CLAUDE.md / brand.md apply.

export function getCompletionCopy(type: string): { headline: string; body: string } {
  switch (type) {
    case 'easy':
    case 'run':      return { headline: 'Kept it easy.',           body: "That's where the fitness is built. Zone 2 does its work quietly." }
    case 'long':     return { headline: 'Long one done.',          body: "Resist the urge to add miles tomorrow. The adaptation happens now." }
    case 'quality':
    case 'tempo':    return { headline: 'Hard session logged.',    body: "Earn that rest. Don't follow it with more effort." }
    case 'intervals':
    case 'hard':     return { headline: 'That was the hard part.', body: "The next 48 hours are when your body catches up. Let it." }
    case 'race':     return { headline: 'Race done.',              body: "Whatever happened, happened. You showed up and finished." }
    case 'recovery': return { headline: 'Recovery done.',          body: "More useful than it felt. That one counts." }
    case 'strength': return { headline: 'Strength session done.',  body: "The legs will thank you when it matters." }
    default:         return { headline: 'Session done.',           body: "Next one when you're ready." }
  }
}
