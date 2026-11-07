import { describe, expect, it } from 'vitest'
import { canResetDemo } from './demo'

describe('demo reset safety', () => {
  it('allows execs only on a marked (demo) club', () => {
    expect(canResetDemo(true, 'Demo Business Club (demo)', true)).toBe(true)
    expect(canResetDemo(false, 'Demo Business Club (demo)', true)).toBe(false)
    expect(canResetDemo(true, 'Business Club', true)).toBe(false)
    expect(canResetDemo(true, 'Business Club (demo)', false)).toBe(false)
  })
})