import { generateRulePlan } from '../../lib/plan/ruleEngine'
import { isDesignedRefusal } from '../../lib/plan/designedRefusal'
import { effectiveStartKm } from '../../lib/plan/startVolume'
import { GENERATION_CONFIG as G } from '../../lib/plan/generationConfig'
import { distanceEnvelope } from '../../lib/plan/useCaseEnvelope'
const cappedPeaks: number[] = []
let n=0, above=0, below=0
const floor = 42.2 * G.MARATHON_PEAK_VOLUME_FLOOR_RATIO
console.log(`credible marathon peak floor = ${floor.toFixed(1)} km (MARATHON_PEAK_VOLUME_FLOOR_RATIO ${G.MARATHON_PEAK_VOLUME_FLOOR_RATIO} x 42.2)`)
console.log(`§111 cap ratio = ${G.MAX_BASE_BUILD_RATIO}x effective start\n`)
for (const c of distanceEnvelope(42.2)) {
  try { generateRulePlan(c.input,'paid'); continue }
  catch(e:any){ if(!isDesignedRefusal(e) || e.name!=='BaseVolumeError') continue }
  n++
  const start = effectiveStartKm(c.input)
  const capped = start * G.MAX_BASE_BUILD_RATIO
  cappedPeaks.push(capped)
  if (capped >= floor) above++; else below++
}
cappedPeaks.sort((a,b)=>a-b)
console.log(`§111-refused marathon cases: ${n}`)
console.log(`  if capped at ${G.MAX_BASE_BUILD_RATIO}x start, their peak would be:`)
console.log(`     median ${cappedPeaks[Math.floor(n/2)].toFixed(1)} km, p90 ${cappedPeaks[Math.floor(n*0.9)].toFixed(1)} km, max ${cappedPeaks[n-1].toFixed(1)} km`)
console.log(`  ABOVE the credible floor (${floor.toFixed(0)}km): ${above} (${Math.round(above/n*100)}%)`)
console.log(`  BELOW it — a plan that cannot prepare them: ${below} (${Math.round(below/n*100)}%)`)
