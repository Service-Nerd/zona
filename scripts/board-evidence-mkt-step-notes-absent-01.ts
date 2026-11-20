// READ-ONLY board evidence for MKT-STEP-NOTES-ABSENT-01 (Design Board, 2026-11-20).
// Counts, per published plan page, the step notes the engine stamps on quality sessions'
// derived sets, how many the page renders today (the SessionSteps exemplar), and how many
// a "note under every step" in the week table would add. Writes nothing.
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MARKETING_PLANS } from '@/lib/marketing/plans'
import { generateMarketingPlan } from '@/lib/marketing/marketingPlan'
import { isHardEffort } from '@/lib/plan/sessionRole'
import { composeSession } from '@/lib/plan/sessionComposer'
import { catalogueRowFor } from '@/lib/plan/catalogueLink'
import { displayDerivedSet } from '@/lib/plan/runWalkPlan'
import { getSessionColor } from '@/lib/session-types'
import { stepParts } from '@/lib/plan/resolveMainSet'

// tsx compiles JSX with the classic runtime here, so React must be global before the components load.
;(globalThis as any).React = React
const { default: SessionSteps } = require('@/components/shared/SessionSteps')
const { displayZonesForSession } = require('@/components/dashboard/dashboardHelpers')

const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;')

let T = { qs: 0, steps: 0, noted: 0, chars: 0, distinct: new Set<string>(), exNotes: 0, exRendered: 0, tableSteps: 0 }
for (const meta of MARKETING_PLANS) {
  const plan = generateMarketingPlan(meta).plan as any
  const weeks = (plan.weeks ?? []).filter((w: any) => w.n >= 1)
  let qs = 0, steps = 0, noted = 0, chars = 0
  let ex: any = null
  for (const w of weeks) for (const d of DAY_ORDER) {
    const s = w.sessions?.[d]
    if (!s || !isHardEffort(s)) continue
    qs++
    if (!ex && s.derived_set) ex = s
    for (const b of s.derived_set?.blocks ?? []) for (const st of b.steps ?? []) {
      steps++; stepParts(st)
      if (st.note) { noted++; chars += st.note.length; T.distinct.add(st.note) }
    }
  }
  let exNotes = 0, exRendered = 0
  if (ex && !meta.staged) {
    const structure = composeSession({ session: ex, catalogueRow: catalogueRowFor(ex) })
    if (structure) {
      const dz = displayZonesForSession(ex)
      const html = renderToStaticMarkup(React.createElement(SessionSteps as any, {
        structure, derivedSet: (displayDerivedSet(ex, structure) as any) ?? null, sessionType: ex.type,
        displayZones: dz?.zones ?? [], zoneRangeLabel: dz?.rangeLabel ?? structure.main.zone,
        metric: ex.distance_km != null ? 'distance' : 'duration', preferredUnits: 'km',
        sessionDistanceKm: ex.distance_km ?? null, catalogueId: ex.catalogue_id, silhouetteColour: getSessionColor(ex),
      }))
      for (const b of ex.derived_set?.blocks ?? []) for (const st of b.steps ?? []) {
        if (!st.note) continue
        exNotes++
        if (html.includes(esc(st.note)) || html.includes(st.note)) exRendered++
      }
    }
  }
  console.log(`${meta.slug.padEnd(34)} staged=${!!meta.staged} quality=${qs} steps=${steps} noted=${noted} noteChars=${chars} exemplarNotes=${exNotes} exemplarRendered=${exRendered}`)
  T.qs += qs; T.steps += steps; T.noted += noted; T.chars += chars; T.exNotes += exNotes; T.exRendered += exRendered
}
console.log(`TOTAL pages=${MARKETING_PLANS.length} quality=${T.qs} steps=${T.steps} noted=${T.noted} (${(100 * T.noted / T.steps).toFixed(1)}%) distinctNotes=${T.distinct.size} noteChars=${T.chars} meanNoteChars=${(T.chars / T.noted).toFixed(1)} exemplarNotes=${T.exNotes} exemplarRendered=${T.exRendered}`)
