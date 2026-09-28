'use client'

// /zones-preview — the real `TrainingZonesScreen` across every state, with fixture props.
// Dev only; 404s in production.
//
// 🔴 IT EXISTS BECAUSE THIS SURFACE IS THREE TAPS BEHIND AUTH and its states depend on
// data most accounts do not have. Measured: `meta.vdot` is present on 10 of 21 stored
// plans, so the pace-only and both-tabs states are unreachable for roughly half of real
// runners and completely unreachable on a test account without a benchmark.
//
// ⚠️ AND THE HARNESS MUST DERIVE, NOT TYPE. On 2026-09-28 `/me-preview` was found showing
// hand-written two-letter initials while the real function returned one — every state on
// the page was reassuring and wrong. So the guide here comes from the ENGINE'S producer,
// `buildPaceFromVDOT`, not from a hand-built object.

import { TrainingZonesScreen, type ZoneRow } from '@/components/shared/TrainingZonesScreen'
import { buildPaceFromVDOT } from '@/lib/plan/paceBands'

const ZONES: ZoneRow[] = [
  { zone: 1, name: 'Recovery',  desc: 'Active recovery, warm-up, cool-down', colour: 'var(--session-recovery)', minHR: 100, maxHR: 124 },
  { zone: 2, name: 'Aerobic',   desc: 'Aerobic base, conversational',        colour: 'var(--session-easy)',     minHR: 125, maxHR: 145 },
  { zone: 3, name: 'Grey zone', desc: 'Neither easy nor hard, the one that costs you', colour: 'var(--session-quality)', minHR: 146, maxHR: 160 },
  { zone: 4, name: 'Threshold', desc: 'Hard, sustained race effort',         colour: 'var(--session-race)',     minHR: 161, maxHR: 178 },
  { zone: 5, name: 'VO₂ Max',   desc: 'Maximum effort, short intervals only', colour: 'var(--coral)',           minHR: 179, maxHR: 195 },
]

const PACE = buildPaceFromVDOT(44, 46)
const BEGINNER = { ...PACE, marathonPaceStr: null, hmPaceStr: null, minPerKmMarathon: null, minPerKmHM: null }

const CASES = [
  { title: 'Both — the full screen', zones: ZONES, pace: PACE,
    note: 'Defaults to Heart rate. The ceiling leads in whichever unit the tab is showing.' },
  { title: 'HR only — 11 of 21 real plans', zones: ZONES, pace: null,
    note: 'No benchmark, so no pace bands. NOT a degraded state: this is the majority case, and "not above 145 bpm" is the same sentence as "not faster than 6:29 /km".' },
  { title: 'Pace only — no HR captured', zones: null, pace: PACE,
    note: 'No toggle at all. A two-option control with one option is noise.' },
  { title: 'Beginner — four bands, no apology', zones: null, pace: BEGINNER,
    note: 'Marathon and Half are null by design (§24b’s segment gate). No rows, and nothing said about them.' },
  { title: 'Neither — empty means calm', zones: null, pace: null,
    note: 'One quiet sentence. Not an error, not a prompt with nothing to tap.' },
]

export default function ZonesPreview() {
  return (
    <main style={{ minHeight: '100vh', background: 'var(--bg)', padding: '24px 16px' }}>
      <h1 style={{ fontFamily: 'var(--font-brand)', fontSize: '24px', color: 'var(--ink)', margin: '0 0 6px' }}>
        Training Zones — every state
      </h1>
      <p style={{ fontFamily: 'var(--font-ui)', fontSize: '13px', color: 'var(--mute)', margin: '0 0 24px' }}>
        Real component, fixture props. Dev only.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', maxWidth: '420px' }}>
        {CASES.map(c => (
          <div key={c.title} style={{ background: 'var(--card)', border: '1px solid var(--line)', borderRadius: 'var(--radius-lg)', padding: '16px' }}>
            <div style={{ fontFamily: 'var(--font-ui)', fontSize: '10px', fontWeight: 700, color: 'var(--mute)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>
              {c.title}
            </div>
            <div style={{ background: 'var(--bg)', padding: '12px 0', borderRadius: '10px' }}>
              <TrainingZonesScreen zones={c.zones} pace={c.pace} units="km" />
            </div>
            <p style={{ fontFamily: 'var(--font-ui)', fontSize: '12px', color: 'var(--mute)', lineHeight: 1.5, margin: '10px 0 0' }}>{c.note}</p>
          </div>
        ))}
      </div>
    </main>
  )
}
