import { describe, it, expect } from 'vitest'
import { upgradeFraming, isLossFraming } from './upgradeFraming'

describe('upgradeFraming', () => {
  it('says nothing ended when nothing has', () => {
    expect(upgradeFraming({ trialExpired: false, grantExpired: false })).toBe('gain')
  })

  it('an ordinary lapsed trial still gets the trial story', () => {
    expect(upgradeFraming({ trialExpired: true, grantExpired: false })).toBe('trial-ended')
  })

  it('a lapsed grant gets the grant story', () => {
    expect(upgradeFraming({ trialExpired: false, grantExpired: true })).toBe('grant-ended')
  })

  // THE ACTUAL DEFECT. A comped runner's trial clock lapsed months before the
  // grant did, so in practice BOTH are true and the old boolean resolved to the
  // trial. That is how a charity runner was told "14 days done".
  it('the grant wins when both are set, which is the normal comped case', () => {
    expect(upgradeFraming({ trialExpired: true, grantExpired: true })).toBe('grant-ended')
  })

  it('both endings use loss framing; only the gain state does not', () => {
    expect(isLossFraming('grant-ended')).toBe(true)
    expect(isLossFraming('trial-ended')).toBe(true)
    expect(isLossFraming('gain')).toBe(false)
  })
})
