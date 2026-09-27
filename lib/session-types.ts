import { isLongRun } from '@/lib/plan/sessionRole'
import type { Session, SessionType } from '@/types/plan'

/** The shape `isLongRun` needs: a real classification signal, not a bare string. */
type ClassifiableSession = { type?: SessionType | string; role?: Session['role']; label?: string | null }

/**
 * Canonical session type → colour and label resolution.
 * This is the SINGLE owner of this mapping — see docs/canonical/session-types.md.
 * No component or utility should define its own colour/label map.
 */

export const SESSION_COLORS: Record<string, string> = {
  easy:          'var(--session-easy)',
  run:           'var(--session-long)',
  long:          'var(--session-long)',
  quality:       'var(--session-quality)',
  tempo:         'var(--session-quality)',
  intervals:     'var(--session-intervals)',
  // SESSION-COLOUR-TT-01 (2026-09-12) — `hard` is the 5K TIME TRIAL and nothing
  // else. Measured across the 621-plan cohort: 672 of 672 `type: 'hard'`
  // sessions are labelled "5K time trial" (§78's recalibration measurement),
  // and every one is a single continuous effort — 0 carry reps.
  //
  // It used to render in `--session-intervals`, which told the runner "this is
  // a reps session" on a key whose own name is `intervals`. A time trial is a
  // maximal CONTINUOUS effort, so its honest neighbour is the race colour: same
  // family (measured, maximal, one effort), and the two do not co-occur — a
  // time trial lands in a recalibration week, the race in race week.
  hard:          'var(--session-race)',
  race:          'var(--session-race)',
  recovery:      'var(--session-recovery)',
  strength:      'var(--session-strength)',
  'cross-train': 'var(--session-cross)',
  cross:         'var(--session-cross)', // legacy alias — hand-authored gists may use 'cross'
  rest:          'transparent',
}

export const SESSION_LABELS: Record<string, string> = {
  easy:          'Easy run — Zone 2',
  run:           'Long run',
  long:          'Long run',
  quality:       'Quality session',
  tempo:         'Tempo run',
  intervals:     'Intervals',
  hard:          'Hard session',
  race:          'Race',
  recovery:      'Recovery run',
  strength:      'Strength',
  'cross-train': 'Cross-training',
  cross:         'Cross-training', // legacy alias
  rest:          'Rest day',
}

/**
 * Returns the accent colour for a session.
 *
 * PLAN-LONGRUN-COLOUR-01 (2026-09-12) — pass the SESSION, not a bare type.
 * `--s-long` (#5E4FB0) was declared in `globals.css`, documented in CLAUDE.md's
 * session colour map and in `ui-patterns.md`, and was **unreachable for any
 * engine-generated plan**: the engine models a long run as `type: 'easy'` (so
 * that §52/§9 ratio rules treat it as aerobic volume), and every surface
 * coloured by `SESSION_COLORS[session.type]`. So the week's anchor session
 * rendered identical to a 5 km shakeout. Same class as `--section-gap` and the
 * decorative-config family: declared, ratified, consumed by nothing.
 *
 * The long run is told apart by `isLongRun`, the existing single owner of that
 * question — NOT by matching words in the label, which the AI enricher rewrites
 * (D-17). A bare string is still accepted for the handful of call sites that
 * genuinely hold only a type; those cannot detect a long run, by construction.
 */
export function getSessionColor(session: ClassifiableSession | string): string {
  if (typeof session === 'string') return SESSION_COLORS[session] ?? 'var(--session-easy)'
  if (isLongRun(session)) return SESSION_COLORS.long
  return SESSION_COLORS[session.type ?? ''] ?? 'var(--session-easy)'
}

/**
 * Returns the display label for a session.
 *
 * 🔴 SESSION-LABEL-LONGRUN-01 (2026-09-27) — THE TWIN OF `getSessionColor`, AND
 * IT WAS LEFT BEHIND FOR FIFTEEN DAYS.
 *
 * `PLAN-LONGRUN-COLOUR-01` fixed the COLOUR above by taking the whole session
 * and asking `isLongRun`, because the engine models a long run as `type:
 * 'easy'` (so §52/§9 ratio rules treat it as aerobic volume). **The label
 * function sitting directly beneath it kept the bare-type signature**, so
 * `SESSION_LABELS['easy']` was the only answer it could give and **"Long run"
 * was unreachable for every engine-generated plan** — exactly the sentence
 * written about the colour, about the function twenty lines away.
 *
 * 📐 Found on a real user's post-run screen: the header read **"Easy run —
 * Zone 2 · Sun"** while Kit's own prose two inches below read **"RPE 3 on a
 * long run is honest"**. The title contradicted the body, on one screen, and
 * the AI was the half that was right.
 *
 * Told apart by `isLongRun` — NOT by matching words in the label, which the
 * enricher rewrites (D-17). A bare string is still accepted for call sites that
 * genuinely hold only a type; those cannot detect a long run, by construction,
 * and `sessionLabelReach.test.ts` holds that boundary.
 */
export function getSessionLabel(session: ClassifiableSession | string): string {
  if (typeof session !== 'string') {
    if (isLongRun(session)) return SESSION_LABELS.long!
    return SESSION_LABELS[session.type ?? ''] ?? (session.type ?? '')
  }
  return SESSION_LABELS[session] ?? session
}
