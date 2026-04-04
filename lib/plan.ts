import type { Plan } from '@/types/plan'

const GIST_URL = process.env.NEXT_PUBLIC_GIST_URL ||
  'https://gist.githubusercontent.com/Service-Nerd/efec07a87f65494f0e078a1ccb136100/raw/rts_plan.json'

// Embedded fallback — full plan so the app always works even if Gist is unreachable
const PLAN_FALLBACK: Plan = {
  meta: {
    athlete: 'Russ Shear', handle: '@doinghardthingsbadly',
    race_name: 'Race to the Stones', race_date: '2026-07-11', race_distance_km: 100,
    charity: 'Make-A-Wish UK', plan_start: '2026-01-19', quit_date: '2026-04-03',
    resting_hr: 48, max_hr: 188, zone2_ceiling: 145,
    version: '2.0', last_updated: '2026-04-05',
    notes: 'Plan updated: 50k race 10 May added as training run.'
  },
  weeks: [
    { n:1,  date:'2026-01-19', label:'Post-illness — full rest',                     theme:'Illness week. Body said no.',                                       type:'completed',    sessions:{}, long_run_hrs:0,    weekly_km:0  },
    { n:2,  date:'2026-01-26', label:'Returning to training',                         theme:'Easy return. No heroics.',                                          type:'completed',    sessions:{}, long_run_hrs:2.5,  weekly_km:38 },
    { n:3,  date:'2026-02-02', label:'Reduced volume — Zone 2 begins',               theme:'Still recovering. Zone 2 only.',                                    type:'completed',    sessions:{}, long_run_hrs:3.0,  weekly_km:35 },
    { n:4,  date:'2026-02-09', label:'Zone 2 base building',                          theme:'HR discipline. Slower than feels right. Correct.',                  type:'completed',    sessions:{}, long_run_hrs:3.0,  weekly_km:40 },
    { n:5,  date:'2026-02-16', label:'Zone 2 all runs — HR cap discipline',          theme:'If it feels too easy, it\'s probably right.',                       type:'completed',    sessions:{}, long_run_hrs:3.0,  weekly_km:35 },
    { n:6,  date:'2026-02-23', label:'Canal towpath long run',                        theme:'Flat and forgiving. Zone 2 locked in.',                             type:'completed',    sessions:{}, long_run_hrs:3.25, weekly_km:42 },
    { n:7,  date:'2026-03-02', label:'Zone 2 locked in',                              theme:'Aerobic base building properly now.',                               type:'completed',    sessions:{}, long_run_hrs:3.5,  weekly_km:44 },
    { n:8,  date:'2026-03-09', label:'Deload',                                         theme:'Adaptation happens during rest, not during work.',                  type:'deload_done',  sessions:{}, long_run_hrs:2.5,  weekly_km:28, badge:'deload' },
    { n:9,  date:'2026-03-16', label:'Peak long run to date — 3h40',                 theme:'Base is building. Evidence it\'s working.',                         type:'completed',    sessions:{}, long_run_hrs:3.67, weekly_km:38 },
    { n:10, date:'2026-03-23', label:'Strong build week',                              theme:'Building confidence as much as fitness.',                           type:'completed',    sessions:{}, long_run_hrs:4.0,  weekly_km:48 },
    { n:11, date:'2026-03-30', label:'Back-to-back weekend — Sat 1h45 + Sun 3h30',  theme:'First back-to-back. Teaching legs to run on fatigue.',              type:'completed',    sessions:{}, long_run_hrs:3.5,  weekly_km:50 },
    { n:12, date:'2026-04-06', label:'Centre Parcs Deload',                           theme:'Rest. Repair. Eat well. Don\'t be a hero.',                        type:'current',      sessions:{}, long_run_hrs:3.0,  weekly_km:25, badge:'holiday' },
    { n:13, date:'2026-04-13', label:'Back to it — aerobic base',                    theme:'HR discipline back on. Quality starts appearing.',                  type:'normal',       sessions:{}, long_run_hrs:3.5,  weekly_km:42 },
    { n:14, date:'2026-04-20', label:'Build — back-to-back stimulus weekend',        theme:'Back-to-backs are the most important sessions in this block.',      type:'normal',       sessions:{}, long_run_hrs:3.75, weekly_km:46 },
    { n:15, date:'2026-04-27', label:'Build — time on feet priority',                theme:'Longest week yet. Fueling practice starts now.',                    type:'normal',       sessions:{}, long_run_hrs:4.0,  weekly_km:52 },
    { n:16, date:'2026-05-04', label:'Pre-race taper — gut test on long run',        theme:'Legs fresh for the 50k. Short, sharp, nothing stupid.',             type:'deload',       sessions:{}, long_run_hrs:2.75, weekly_km:25, badge:'deload' },
    { n:17, date:'2026-05-11', label:'🏁 RACE: 50k — training run with a bib',      theme:'Not a race. A long run with better aid stations.',                  type:'race_event',   sessions:{}, long_run_hrs:6.0,  weekly_km:54, race_notes:'HR-capped. Walk all climbs. Fuel every 45 mins. Finish feeling like you have 10k left.' },
    { n:18, date:'2026-05-18', label:'50k recovery — protect the adaptation',        theme:'Your legs did 50k last Sunday. They need this whether you feel it or not.', type:'normal', sessions:{}, long_run_hrs:3.0, weekly_km:36 },
    { n:19, date:'2026-05-25', label:'PEAK long run — gut test #2',                  theme:'Biggest single session of the plan. Treat it like a mini-race.',   type:'normal',       sessions:{}, long_run_hrs:4.75, weekly_km:52 },
    { n:20, date:'2026-06-01', label:"Deload — don't argue with it",                 theme:'Post-peak. Non-negotiable. This is when it all adapts.',            type:'deload',       sessions:{}, long_run_hrs:3.0,  weekly_km:38, badge:'deload' },
    { n:21, date:'2026-06-08', label:'Final big effort — 5hr mental dress rehearsal',theme:'Last big one. Practice your race-day routine end to end.',          type:'normal',       sessions:{}, long_run_hrs:5.0,  weekly_km:48 },
    { n:22, date:'2026-06-15', label:'Taper begins — reduce intensity, keep frequency', theme:'Taper is not laziness. It is the final training stimulus.',      type:'deload',       sessions:{}, long_run_hrs:3.5,  weekly_km:40, badge:'deload' },
    { n:23, date:'2026-06-22', label:'Taper — protect the legs, sleep, eat',         theme:'Sleep is training now. Treat it that way.',                        type:'deload',       sessions:{}, long_run_hrs:3.0,  weekly_km:32 },
    { n:24, date:'2026-06-29', label:'Race week prep — calm, nothing stupid',        theme:'You cannot get fitter this week. Only get to the start line healthy.', type:'deload',   sessions:{}, long_run_hrs:2.0,  weekly_km:18 },
    { n:25, date:'2026-07-06', label:'🔴 RACE WEEK — Race to the Stones 100km · 11 Jul', theme:'Everything since January was for this. Trust it.',            type:'race',         sessions:{}, long_run_hrs:null, weekly_km:100, badge:'race' },
  ]
}

export async function fetchPlan(): Promise<Plan> {
  try {
    const res = await fetch(GIST_URL, { next: { revalidate: 300 } }) // cache 5 min server-side
    if (!res.ok) throw new Error('Gist fetch failed')
    return await res.json() as Plan
  } catch {
    return PLAN_FALLBACK
  }
}

export function getCurrentWeek(weeks: Plan['weeks']) {
  return weeks.find(w => w.type === 'current') ?? weeks[weeks.length - 1]
}

export function getWeeksToRace(raceDate: string) {
  const ms = new Date(raceDate).getTime() - Date.now()
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24 * 7)))
}
