// SC-08a — the single owner of "which catalogue row produced this session?".
//
// The rep structure a runner sees ("4 × 1000 m at 5K pace, 2 min jog") lives on
// the catalogue row, not on the session. Something has to re-join them at
// display time, and until now that join matched `session.label` against
// `row.name`.
//
// THAT JOIN FAILED ON 31% OF QUALITY SESSIONS, and not randomly: §22 renames
// race-pace sessions for a time goal ("MARATHON-pace progression"), so a
// marathon time-goal plan lost 5 of its 9 quality sessions. The runner saw a
// distance, a duration and a pace band, and no indication of what to actually
// do. The AI enricher can rewrite labels too, so an enriched plan could lose
// structure the rule plan had — D-17 exactly: never couple logic to a display
// string another layer is allowed to change.
//
// The generator now stamps `catalogue_id` at construction. This module reads it,
// and keeps the name match ONLY as a legacy fallback for plans generated before
// the stamp existed. It lives in lib/ rather than in the component because two
// call sites in DashboardClient had independently duplicated the join.
import { V1_SESSION_CATALOGUE } from './sessionCatalogueData'
import type { SessionCatalogueRow } from './sessionCatalogueData'

type LinkableSession = { catalogue_id?: string; label?: string | null }

export function catalogueRowFor(
  session: LinkableSession | null | undefined,
  catalogue: SessionCatalogueRow[] = V1_SESSION_CATALOGUE,
): SessionCatalogueRow | null {
  if (!session) return null

  // Stamped identity — authoritative, survives renaming and enrichment.
  if (session.catalogue_id) {
    return catalogue.find(r => r.id === session.catalogue_id) ?? null
  }

  // LEGACY ONLY. Plans generated before SC-08a carry no stamp. Correct for
  // those, and never reached once a plan carries one — the same shape as
  // sessionRole.ts's fallback. Do not extend this path; a new session type that
  // needs a row should stamp the id at construction instead.
  if (!session.label) return null
  return catalogue.find(r => r.name === session.label) ?? null
}
