import { describe, it, expect } from 'vitest'
import { summariseGoalGap } from './planAuditGoalGap'

const plan = (meta: Record<string, unknown>) => ({ meta } as any)

describe('summariseGoalGap — the digest\'s count of runners told their goal is past their fitness (RCA-1026)', () => {
  it('counts what the engine recorded: decided, withheld, and the median gap', () => {
    const s = summariseGoalGap([
      plan({ goal_pace_reach: { gap_pct: 2, vdot: 40 } }),
      plan({ goal_pace_reach: { gap_pct: 8, vdot: 35 }, goal_pace_withheld: { gap_pct: 8 } }),
      plan({ goal_pace_reach: { gap_pct: 12.4, vdot: 30 }, goal_pace_withheld: { gap_pct: 12.4 } }),
      plan({}),   // built before the rule: in neither count
    ])
    expect(s).toEqual({ goal_gap: { decided: 3, withheld: 2, median_gap_pct: 10.2 } })
  })
  it('present with zeros when nobody is past the line, so the first day it moves is visible', () => {
    expect(summariseGoalGap([plan({ goal_pace_reach: { gap_pct: 1, vdot: 45 } })])).toEqual({ goal_gap: { decided: 1, withheld: 0, median_gap_pct: null } })
    expect(summariseGoalGap([])).toEqual({ goal_gap: { decided: 0, withheld: 0, median_gap_pct: null } })
  })
  it('🔴 reads the recorded withholding, not the decision alone (a decided-but-inside plan is not withheld)', () => {
    expect(summariseGoalGap([plan({ goal_pace_reach: { gap_pct: 30, vdot: 30 } })]).goal_gap.withheld).toBe(0)
  })
})
