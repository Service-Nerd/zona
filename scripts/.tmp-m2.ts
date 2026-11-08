import { MARKETING_ARTICLES, COMPETITOR_FACTS, twelveMonthsAtMonthly, annualGapToOurs, coachMarket } from '@/lib/marketing/articles'
import { PRICING } from '@/lib/brand'
const MONEY = /£\d+(?:\.\d+)?(?![\d.]|\s*m\b)/g
const OURS = new Set<string>([PRICING.monthly.display, PRICING.annual.display, PRICING.annual.perMonthDisplay,
  PRICING.monthly.perWeekDisplay, PRICING.annual.perWeekDisplay,
  coachMarket().low, coachMarket().high, coachMarket().typical, coachMarket().lowYear])
type K = keyof typeof COMPETITOR_FACTS
const keys = Object.keys(COMPETITOR_FACTS) as K[]
const own = (k: K) => new Set<string>([COMPETITOR_FACTS[k].monthly, COMPETITOR_FACTS[k].annual,
  COMPETITOR_FACTS[k].monthly ? twelveMonthsAtMonthly(k) : null,
  COMPETITOR_FACTS[k].annual ? annualGapToOurs(k) : null].filter((x): x is string => !!x))
const copyOf = (b: any): string => {
  const out: string[] = []
  const w = (v: any) => { if (typeof v === 'string') out.push(v); else if (Array.isArray(v)) v.forEach(w); else if (v && typeof v === 'object') Object.values(v).forEach(w) }
  w(b); return out.join(' ')
}
let bySentence = 0, byHeading = 0, flagged = 0
const hits: string[] = []
for (const a of MARKETING_ARTICLES) {
  let subject: K | null = null
  for (const b of a.body as any[]) {
    if (b.kind === 'h2' || b.kind === 'h3') {
      const t = copyOf(b)
      const named = keys.filter(k => t.includes(COMPETITOR_FACTS[k].name))
      subject = named.length === 1 ? named[0] : null
      continue
    }
    if (b.kind === 'table') continue
    for (const s of copyOf(b).split(/(?<=[.!?])\s+/)) {
      const named = keys.filter(k => s.includes(COMPETITOR_FACTS[k].name))
      let k: K | null = null, via = ''
      if (named.length === 1) { k = named[0]; via = 'sentence'; bySentence++ }
      else if (named.length === 0 && subject) { k = subject; via = 'heading'; byHeading++ }
      if (!k) continue
      const figs = s.match(MONEY) ?? []
      if (!figs.length) continue
      const legal = own(k)
      const bad = figs.filter(f => !legal.has(f) && !OURS.has(f))
      if (bad.length) { flagged++; hits.push(`[${via}] ${a.slug} ${COMPETITOR_FACTS[k].name}: ${bad.join(',')} :: ${s.trim().slice(0,110)}`) }
    }
  }
}
console.log(`attributed by sentence ${bySentence} · by HEADING ${byHeading} · FLAGGED ${flagged}`)
for (const h of hits) console.log('  ', h)
