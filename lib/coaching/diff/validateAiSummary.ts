// RESHAPE-FIX-WAVE2A — AI summary fidelity validator
//
// The 2026-06-26 incident exposed an AI summary that said "the 24km run
// and hard-easy rhythm stay intact" while the engine had just swapped
// Sunday's long run with Tuesday's rest. The anti-confabulation rules
// in the prompt itself failed to catch it — the model read the trigger
// type ("session_reorder, rest day moved") and generated a reassuring
// sentence about the surrounding sessions, divorced from the actual
// sessionsAfter array.
//
// Solution doctrine (SLT 2026-06-26): voice prose handles WHY, the
// rule-engine diff handles WHAT. The AI is never trusted to summarise
// structural change — it's only trusted to explain the engine's
// reasoning. This validator is the safety net that enforces that
// separation by rejecting AI output that makes a structural claim
// contradicted by the diff.
//
// Conservative bias: false positives (rejecting a good summary)
// degrade to rule-engine prose silently and cost nothing user-visible.
// False negatives (passing a confabulation) re-create the incident.
// So the patterns below skew toward rejecting anything that *might*
// be lying. Only the structural-claim shapes the incident produced
// are checked; pure-voice prose passes through.

import type { DiffEntry } from './sessionDiff'

export interface ValidationResult {
  ok:     boolean
  reason: string
}

const DAY_WORDS: Record<string, string> = {
  monday:    'mon',  mon: 'mon',
  tuesday:   'tue',  tue: 'tue',  tues: 'tue',
  wednesday: 'wed',  wed: 'wed',
  thursday:  'thu',  thu: 'thu',  thurs: 'thu',
  friday:    'fri',  fri: 'fri',
  saturday:  'sat',  sat: 'sat',
  sunday:    'sun',  sun: 'sun',
}

/**
 * Validate an AI-generated adjustment summary against the structural
 * diff. Returns `ok: false` with a reason when a structural claim in
 * the prose contradicts the diff.
 *
 * The caller should fall back to the rule-engine summary on failure
 * (silent fallback per ADR-006 hybrid generation pattern). The reason
 * is logged for telemetry — surfaces drift between prompt evolution
 * and validator coverage.
 */
export function validateSummaryAgainstDiff(
  summary: string,
  diff: DiffEntry[],
): ValidationResult {
  const text = summary.toLowerCase()

  // Set of days that actually changed in the diff (structural changes).
  const changedDays = new Set(
    diff.filter(e => e.kind !== 'unchanged').map(e => e.day),
  )

  // Set of changed session types — used to detect "the long run stays"
  // claims when the long run actually moved.
  const changedTypes = new Set<string>()
  for (const e of diff) {
    if (e.kind === 'unchanged') continue
    if (e.before?.type) changedTypes.add(String(e.before.type))
    if (e.after?.type)  changedTypes.add(String(e.after.type))
  }

  // --- Pattern 1: "X stays / remains / is preserved / unchanged" where
  //                X is a session type that actually moved.
  //
  // This is the exact incident pattern: "the 24km run and hard-easy
  // rhythm stay intact" — said while the 24km run moved sun → tue.
  //
  // We check for "stays/stay/remains/remain/unchanged/preserved/intact"
  // in the same clause as one of the changed types.
  const STABILITY_VERBS = /(stays?|remains?|unchanged|preserved|intact|untouched|stays? put|same|kept)\b/
  // CLAUDE.md: Array.from on Set<string>, not spread (Set iteration target gotcha)
  for (const type of Array.from(changedTypes)) {
    // Build a pattern that looks for "<type-mention> ... stability-verb"
    // in a short window — same sentence. We use a coarse approach:
    // split on punctuation, look for any sentence containing both.
    const sentences = text.split(/[.!?]+/)
    for (const s of sentences) {
      if (!s.includes(type)) continue
      if (STABILITY_VERBS.test(s)) {
        return {
          ok:     false,
          reason: `claims "${type}" is stable, but the diff shows ${type} sessions changed`,
        }
      }
    }
  }

  // --- Pattern 2: explicit day reference + stability claim about that day.
  //                e.g. "Sunday's long run stays" when sun changed.
  for (const [word, dayKey] of Object.entries(DAY_WORDS)) {
    if (!changedDays.has(dayKey as DiffEntry['day'])) continue
    // Look for "<dayword> ... stability-verb" in any sentence
    const sentences = text.split(/[.!?]+/)
    for (const s of sentences) {
      // Word boundary check — avoid matching "thumb" via "thu"
      const re = new RegExp(`\\b${word}\\b`)
      if (!re.test(s)) continue
      if (STABILITY_VERBS.test(s)) {
        return {
          ok:     false,
          reason: `claims ${word} unchanged, but the diff shows ${dayKey} changed`,
        }
      }
    }
  }

  // --- Pattern 3: distance-tagged stability claim ("the 24km run stays")
  //                where a session of that distance actually moved.
  //
  // This is the EXACT 2026-06-26 incident pattern. Sonnet wrote "The
  // 24km run and hard-easy rhythm stay intact" while the long run had
  // just moved sun → tue. Pattern 1 didn't catch it because the prose
  // referred to "24km run" instead of "long". This pattern bridges
  // the type-name gap by matching numeric distance mentions to the
  // distances of changed sessions in the diff.
  //
  // Collect distances (km) of every session that participated in a
  // change — before-side distances (what moved away) and after-side
  // distances (what arrived).
  const changedDistances = new Set<number>()
  for (const e of diff) {
    if (e.kind === 'unchanged') continue
    if (typeof e.before?.distance_km === 'number' && e.before.distance_km > 0) {
      changedDistances.add(e.before.distance_km)
    }
    if (typeof e.after?.distance_km  === 'number' && e.after.distance_km  > 0) {
      changedDistances.add(e.after.distance_km)
    }
  }
  if (changedDistances.size > 0) {
    const sentences = text.split(/[.!?]+/)
    for (const s of sentences) {
      // Find every "<N>km" or "<N> km" mention in this sentence
      const distMatches = Array.from(s.matchAll(/(\d+(?:\.\d+)?)\s*km\b/g))
      if (distMatches.length === 0) continue
      if (!STABILITY_VERBS.test(s)) continue
      for (const m of distMatches) {
        const km = Number(m[1])
        if (changedDistances.has(km)) {
          return {
            ok:     false,
            reason: `claims ${km}km session is stable, but the diff shows a ${km}km session changed`,
          }
        }
      }
    }
  }

  // --- Pattern 4: "moved X from A to B" where the diff disagrees.
  //
  // This catches the inverse confabulation: the model invents a move
  // that didn't happen. Only flagged when both day mentions are
  // present AND the diff shows no relocation between them.
  const moveMatch = text.match(/moved?\s+(?:the\s+)?(\w+)\s+(?:from\s+)?(\w+)\s+to\s+(\w+)/)
  if (moveMatch) {
    const [, , fromWord, toWord] = moveMatch
    const fromDay = DAY_WORDS[fromWord]
    const toDay   = DAY_WORDS[toWord]
    if (fromDay && toDay) {
      // The "from" day should have changed (something left it) AND the
      // "to" day should have changed (something arrived). If neither
      // changed, the prose invented the move.
      const fromChanged = changedDays.has(fromDay as DiffEntry['day'])
      const toChanged   = changedDays.has(toDay   as DiffEntry['day'])
      if (!fromChanged && !toChanged) {
        return {
          ok:     false,
          reason: `claims move ${fromWord} → ${toWord}, but neither day shows a change in the diff`,
        }
      }
    }
  }

  return { ok: true, reason: '' }
}
