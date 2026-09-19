import { distanceEnvelope, DISTANCE_BANDS } from '../../lib/plan/useCaseEnvelope'
let tot=0, incoherent=0
const cells: Record<string, number> = {}
for (const d of DISTANCE_BANDS) for (const c of distanceEnvelope(d.value)) {
  const i = c.input as any; const w = c.weight * d.weight
  tot += w
  // implausible pairings my envelope can construct
  const beginnerHighVol = i.fitness_level==='beginner' && i.current_weekly_km >= 40
  const expLowVol = i.fitness_level==='experienced' && i.current_weekly_km <= 10
  if (beginnerHighVol || expLowVol) {
    incoherent += w
    const k = beginnerHighVol ? `beginner@${i.current_weekly_km}km` : `experienced@${i.current_weekly_km}km`
    cells[k] = (cells[k]??0)+w
  }
}
console.log(`weight of IMPLAUSIBLE level/volume pairings my envelope constructs: ${(incoherent/tot*100).toFixed(1)}%`)
for (const [k,v] of Object.entries(cells).sort((a,b)=>b[1]-a[1])) console.log(`   ${k.padEnd(22)} ${(v/tot*100).toFixed(2)}%`)
