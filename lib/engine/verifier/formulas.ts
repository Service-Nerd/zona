// ADR027-B3-VERIFIER — the checker's OWN pace and heart-rate maths (founder decision, 2026-11-22).
//
// Six rules check whether a pace or an HR band is right for the runner, and they can only answer by working the number
// out. Borrowing the planner's calculator would mean a mistake in it passes both: the builder writes the wrong pace
// and the checker, using the same sum, agrees. So the formulas are written here a second time, from the published
// facts only (Daniels' oxygen-cost curve and his %VO2max fractions, Karvonen's heart-rate reserve, the zone table in
// GENERATION_CONFIG). `formulas.test.ts` holds the two copies to the same answers across a grid of runners, so they
// cannot drift apart silently; nothing here imports the planner's pace or band code.
import { GENERATION_CONFIG } from '@/lib/plan/generationConfig'
import type { GeneratorInput } from '@/types/plan'

/** Daniels' %VO2max bands per pace anchor. Facts about his tables, not tunable coaching choices. */
export const PACE_FRACTIONS = {
  E: [0.59, 0.74], T: [0.83, 0.88], CV: [0.88, 0.92], I: [0.95, 1.00], M: [0.79, 0.79], HM: [0.84, 0.84],
} as const

/** Daniels' race-effort fraction at the four reference distances: a race is run at the nearest one. */
const RACE_FRACTIONS = [
  { km: 5, f: 0.961 }, { km: 10, f: 0.922 }, { km: 21.0975, f: 0.842 }, { km: 42.195, f: 0.792 },
] as const

/** Resting oxygen cost (ml/kg/min): the floor of the VO2 reserve. */
const RESTING_VO2 = 3.5

/** Velocity (m/min) at a fraction of VO2max: the positive root of Daniels' oxygen-cost curve. */
export function velocity(vdot: number, fraction: number): number {
  const a = 0.000104, b = 0.182258, c = -4.60 - fraction * vdot
  const disc = b * b - 4 * a * c
  if (disc < 0) return 100
  return (-b + Math.sqrt(disc)) / (2 * a)
}

/** Pace (min/km) at a fraction of VO2max. */
export const paceAt = (vdot: number, fraction: number) => 1000 / velocity(vdot, fraction)

/** The runner's paces (min/km, band midpoints). Easy, threshold, CV, marathon and HM run off the training (discounted)
 *  VDOT; interval runs off the raw one. */
export function paceGuide(trainingVdot: number, rawVdot: number) {
  const mid = (v: number, k: keyof typeof PACE_FRACTIONS) => (paceAt(v, PACE_FRACTIONS[k][0]) + paceAt(v, PACE_FRACTIONS[k][1])) / 2
  return {
    easy: mid(trainingVdot, 'E'), threshold: mid(trainingVdot, 'T'), cv: mid(trainingVdot, 'CV'), interval: mid(rawVdot, 'I'),
    marathon: paceAt(trainingVdot, PACE_FRACTIONS.M[0]), hm: paceAt(trainingVdot, PACE_FRACTIONS.HM[0]),
  }
}

/** Race pace (min/km) at a distance: the race time, rounded to the second as a race time is, over the distance. */
export function racePace(vdot: number, km: number): number {
  const f = RACE_FRACTIONS.reduce((best, r) => (Math.abs(r.km - km) < Math.abs(best.km - km) ? r : best)).f
  const seconds = Math.round(((km * 1000) / velocity(vdot, f)) * 60)
  return seconds / km / 60
}

/** The zone numbers a zone label spans: "Zone 3–4" → [3, 4]. */
export function zonesIn(label: string | null | undefined): number[] {
  const n = (String(label ?? '').match(/[1-5]/g) ?? []).map(Number)
  if (!n.length) return []
  const out: number[] = []
  for (let z = Math.min(...n); z <= Math.max(...n); z++) out.push(z)
  return out
}

type ZoneRow = { karvonen_pct: readonly number[]; maxhr_pct: readonly number[] }
const zoneRow = (z: number) => (GENERATION_CONFIG.ZONES as unknown as Record<string, ZoneRow>)[`Z${z}`]

/** The HR band (bpm) a zone label prescribes: Karvonen when resting HR is known, %max otherwise. */
export function bandForZoneLabel(label: string | null | undefined, rhr: number | null | undefined, max: number | null | undefined) {
  const z = zonesIn(label)
  if (!z.length || !max) return null
  const lo = zoneRow(Math.min(...z)), hi = zoneRow(Math.max(...z))
  if (rhr) return { lo: Math.round(rhr + (lo.karvonen_pct[0] / 100) * (max - rhr)), hi: Math.round(rhr + (hi.karvonen_pct[1] / 100) * (max - rhr)) }
  return { lo: Math.round((lo.maxhr_pct[0] / 100) * max), hi: Math.round((hi.maxhr_pct[1] / 100) * max) }
}

/** The zones an HR band overlaps. Touching a zone's edge counts only when it overlaps nothing else. */
export function zonesTouchedBy(lo: number, hi: number, max: number, rhr: number | null | undefined): number[] {
  const r = typeof rhr === 'number' && Number.isFinite(rhr) && rhr > 0 ? rhr : null
  const bpm = (pct: number) => Math.round(r !== null ? r + (pct / 100) * (max - r) : (pct / 100) * max)
  const rows = Object.entries(GENERATION_CONFIG.ZONES as unknown as Record<string, ZoneRow>)
  const edges = (row: ZoneRow) => (r !== null ? row.karvonen_pct : row.maxhr_pct)
  const hit = rows.filter(([, row]) => hi > bpm(edges(row)[0]) && lo < bpm(edges(row)[1])).map(([k]) => Number(k.slice(1)))
  if (!hit.length) {
    const touch = rows.find(([, row]) => hi >= bpm(edges(row)[0]) && lo <= bpm(edges(row)[1]))
    if (touch) hit.push(Number(touch[0].slice(1)))
  }
  return hit.sort((a, b) => a - b)
}

const zoneLabel = (z: number[]) => (!z.length ? '' : z.length === 1 ? `Zone ${z[0]}` : `Zone ${z[0]}–${z[z.length - 1]}`)

/** The HR band a pace anchor implies: the anchor's %VO2max re-expressed as heart-rate reserve (%HRR ≈ %VO2R). An I band
 *  runs from the top of CV to max HR. Several anchors give their union, named by the widest. Null when it cannot be
 *  derived (an unbandable anchor, missing or impossible HR, no VDOT). */
export function bandForPaceAnchors(anchors: readonly (string | null | undefined)[], vdot: number | null | undefined,
  max: number | null | undefined, rhr: number | null | undefined): { lo: number; hi: number; hr: string; zone: string; anchor: string } | null {
  if (!anchors.length) return null
  const one = (a: string | null | undefined) => {
    if (a !== 'T' && a !== 'CV' && a !== 'I') return null
    if (typeof max !== 'number' || !Number.isFinite(max) || max <= 0) return null
    if (typeof rhr !== 'number' || !Number.isFinite(rhr) || rhr <= 0) return null
    if (typeof vdot !== 'number' || !Number.isFinite(vdot) || vdot <= RESTING_VO2 || rhr >= max) return null
    const reserve = (f: number) => (f * vdot - RESTING_VO2) / (vdot - RESTING_VO2)
    const [fLo, fHi] = a === 'I' ? [PACE_FRACTIONS.CV[1], PACE_FRACTIONS.I[1]] : PACE_FRACTIONS[a]
    const lo = Math.round(rhr + reserve(fLo) * (max - rhr))
    const hi = a === 'I' ? max : Math.round(rhr + reserve(fHi) * (max - rhr))
    return hi > lo ? { lo, hi, anchor: a } : null
  }
  const parts = anchors.map(one)
  if (parts.some(p => p === null)) return null
  const bands = parts as { lo: number; hi: number; anchor: string }[]
  const lo = Math.min(...bands.map(b => b.lo)), hi = Math.max(...bands.map(b => b.hi))
  const anchor = bands.reduce((a, b) => (b.hi > a.hi ? b : a)).anchor
  return { lo, hi, hr: `${lo}–${hi} bpm`, zone: zoneLabel(zonesTouchedBy(lo, hi, max as number, rhr as number)), anchor }
}

/** A pace as "m:ss". */
export function paceText(minPerKm: number): string {
  const m = Math.floor(minPerKm), sec = Math.round((minPerKm - m) * 60)
  return sec === 60 ? `${m + 1}:00` : `${m}:${String(sec).padStart(2, '0')}`
}

/** A band around a centre pace, ±pct, as the plan writes it: "fast–slow /km". */
export const bandAround = (centre: number, pct: number) => `${paceText(centre * (1 - pct / 100))}–${paceText(centre * (1 + pct / 100))} /km`

/** The fast end of a band string ("4:05–4:20 /km" → "4:05"). */
export function fastEnd(band: string | null | undefined): string | null {
  const m = band ? /^\s*(\d+:\d{2})\s*\u2013/.exec(band) : null
  return m ? m[1] : null
}

/** The runner's pace bands per anchor, as text: E, T, CV, I from their fraction bands; M and HM ±3% of their point. */
export function anchorBands(trainingVdot: number, rawVdot: number): Record<'E' | 'T' | 'CV' | 'I' | 'M' | 'HM', string> {
  const band = (v: number, k: 'E' | 'T' | 'CV' | 'I') => `${paceText(paceAt(v, PACE_FRACTIONS[k][1]))}–${paceText(paceAt(v, PACE_FRACTIONS[k][0]))} /km`
  return {
    E: band(trainingVdot, 'E'), T: band(trainingVdot, 'T'), CV: band(trainingVdot, 'CV'), I: band(rawVdot, 'I'),
    M: bandAround(paceAt(trainingVdot, PACE_FRACTIONS.M[0]), 3), HM: bandAround(paceAt(trainingVdot, PACE_FRACTIONS.HM[0]), 3),
  }
}

/** 🔻 The easy pace (min/km) the planner assumes for a runner with no benchmark, by level. A table of coaching numbers
 *  private to `ruleEngine.ts`, not in config: copied so the checker agrees, and raised for the board. */
export const FALLBACK_EASY_MIN_PER_KM = { beginner: 8.0, intermediate: 7.0, experienced: 6.25 } as const

/** The weekly volume a plan builds FROM, for a request: a fresh return starts at a fraction of the declared volume
 *  (unless the volume was observed), and a runner under six months is capped at the week-1 ceiling. */
export function startVolume(i: GeneratorInput): number {
  const fresh = !i.volume_observed && ((i.weeks_at_current_volume !== undefined && i.weeks_at_current_volume < GENERATION_CONFIG.FRESH_RETURN_WEEKS_THRESHOLD)
    || ((i.training_age === '2-5yr' || i.training_age === '5yr+') && i.current_weekly_km < GENERATION_CONFIG.HEURISTIC_FRESH_RETURN_WEEKLY_KM
      && i.longest_recent_run_km < GENERATION_CONFIG.HEURISTIC_FRESH_RETURN_LONG_RUN_KM))
  const declared = fresh ? i.current_weekly_km * GENERATION_CONFIG.FRESH_RETURN_START_FRACTION : i.current_weekly_km
  return i.training_age === '<6mo' ? Math.min(declared, GENERATION_CONFIG.BEGINNER_WEEK1_VOLUME_CAP_KM) : declared
}
