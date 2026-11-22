// HR-RETRY-SILENT-01 — what the HR retry reports, and how rarely.
//
// `retryPendingHrRows` re-reads heart rate for HealthKit runs stored without it. It could not say WHY a retry found
// nothing: `if (!hrRes.samples.length) continue` and a swallowed `catch` look identical from the server, so "Apple
// Health has no HR for this window" and "the phone was locked and refused the read" were indistinguishable. Measured
// 2026-11-22 on two HR-less runs (Tue 17 and Fri 20 Nov, both retried for 48 h): the data could only be inferred.
//
// It runs on EVERY observer wake (254 sweeps in five days for one runner), so reporting every outcome would be noise.
// Each (run, outcome) is reported once. 'found' is never reported: the arrival is already stamped on the activity row
// (`hr_arrived_late_at`).

export type HrRetryResult = 'found' | 'empty' | 'error'

export interface HrRetryOutcome {
  /** HealthKit workout uuid. Used only for the once-per-outcome throttle; it is never sent. */
  uuid: string
  result: HrRetryResult
  /** Hours since the run started. */
  ageHours: number
  /** Truncated error text, for 'error' only. */
  message?: string
}

export interface HrRetryReport {
  result: 'empty' | 'error'
  age_hours: number
  message: string | null
}

const keyOf = (o: HrRetryOutcome) => `${o.uuid}:${o.result}${o.result === 'error' ? `:${(o.message ?? '').slice(0, 60)}` : ''}`

/**
 * The reports to send, and the throttle keys to remember. Pure.
 * `seen` is what was already reported; a returned `remember` key joins it.
 */
export function decideHrRetryReports(outcomes: HrRetryOutcome[], seen: ReadonlySet<string>): { send: HrRetryReport[]; remember: string[] } {
  const send: HrRetryReport[] = []
  const remember: string[] = []
  for (const o of outcomes) {
    if (o.result === 'found') continue
    const k = keyOf(o)
    if (seen.has(k) || remember.includes(k)) continue
    remember.push(k)
    send.push({
      result:    o.result,
      age_hours: Math.max(0, Math.round(o.ageHours)),
      message:   o.result === 'error' ? (o.message ?? 'unknown').slice(0, 200) : null,
    })
  }
  return { send, remember }
}
