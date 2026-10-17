// STRENGTH-NOTE-01 — the weekly strength coach note: one or two sentences in the house voice.
//
// ⚖️ Coaching Board (2026-10-17): the note DESCRIBES the week, it never prescribes, and it
// makes no claim about what strength does for running or injury (the 2024 runner
// meta-analysis found unsupervised programmes did not reduce injury). The prompt says so,
// and `parseStrengthNote` refuses a reply that says otherwise, so a model slip renders
// NOTHING rather than a claim. Silent on failure (ADR-006).

import { buildVoiceHeader } from './voiceRules'
import { formatDuration, type DistanceUnits } from '@/lib/format'

export interface StrengthWeeklyNoteInput {
  units: DistanceUnits
  firstName: string | null
  weekN: number
  phase: string
  focus: 'running' | 'general'
  experience: 'new' | 'some' | 'regular'
  sessions: { day: string; title: string; minutes: number; afterQualityRun: boolean; heavyLegs: boolean }[]
  /** The plan's honest notes that apply (e.g. legs limited by the run week, bodyweight only). */
  notes: string[]
  weeksToRace: number | null
}

export function buildStrengthWeeklyNotePrompt(i: StrengthWeeklyNoteInput): string {
  const header = buildVoiceHeader({
    role: 'writing a one-line note about the runner\'s strength sessions this week',
    outputConstraint: 'One or two short sentences. No list, no greeting.',
    includeVoiceAnchor: false,
    firstName: i.firstName,
    units: i.units,
  })
  const facts = [
    `Week ${i.weekN}, phase: ${i.phase}${i.weeksToRace != null ? `, ${i.weeksToRace} weeks to the race` : ''}`,
    `Focus: ${i.focus === 'running' ? 'running-focused' : 'general'}; lifting experience: ${i.experience}`,
    ...(i.sessions.length
      ? i.sessions.map(s => `${s.day}: ${s.title}, ${formatDuration(s.minutes)}${s.heavyLegs ? ', heavy legs' : ''}${s.afterQualityRun ? ', after a hard run the same day' : ''}`)
      : ['No strength sessions this week']),
    ...i.notes.map(n => `Note: ${n}`),
  ]
  return `${header}

Hard rules for this note:
- Describe the week: where the sessions sit and what kind they are. Do NOT tell them to add, cut or change any session.
- Make NO claim about what strength does for running, speed, economy, injury or finishing. Never say "prevent", "injury", "bulletproof", "faster", "economy" or "stronger runner".
- If heavy legs are limited by the run week, you may say legs were kept to the safe days. Never suggest adding them back.

The week:
${facts.map(f => `- ${f}`).join('\n')}

Write the note.`
}

/** Words that mean the note has made a claim or a prescription the board forbade. */
const FORBIDDEN = /\b(prevent\w*|injur\w*|bulletproof|faster|economy|stronger runner|add (an?|another|more)|skip (it|this)|cut (it|this)|drop (it|this))\b/i

/** The note to show, or null when the reply is empty, too long, or breaks a rule. */
export function parseStrengthNote(raw: string | null | undefined): string | null {
  const t = (raw ?? '').trim().replace(/^["']|["']$/g, '')
  if (!t || t.length > 260) return null
  if (t.includes('—')) return null
  if (FORBIDDEN.test(t)) return null
  if ((t.match(/[.!?](\s|$)/g) ?? []).length > 2) return null
  return t
}
