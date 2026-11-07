import { describe, expect, it } from 'vitest'
import { canResetDemo } from './demo'
import { readFileSync } from 'node:fs'

let demoSql = readFileSync('drizzle/migrations/0005_safe_demo_and_category_access.sql', 'utf8')
for (const file of ['0006_demo_venue_within_budget.sql', '0008_demo_supplies_total.sql']) {
  const correction = readFileSync(`drizzle/migrations/${file}`, 'utf8')
  for (const match of correction.matchAll(/replace\(definition,'(ARRAY\[[\d,]+\])','(ARRAY\[[\d,]+\])'\)/g)) {
    if (match[1] && match[2]) demoSql = demoSql.replace(match[1], match[2])
  }
}

describe('demo reset safety', () => {
  it('allows execs only on a marked (demo) club', () => {
    expect(canResetDemo(true, 'Demo Business Club (demo)', true)).toBe(true)
    expect(canResetDemo(false, 'Demo Business Club (demo)', true)).toBe(false)
    expect(canResetDemo(true, 'Business Club', true)).toBe(false)
    expect(canResetDemo(true, 'Business Club (demo)', false)).toBe(false)
  })
  it('seeds integer-cent category totals that make Food yellow and Supplies red', () => {
    const arrays = [...demoSql.matchAll(/ARRAY\[([\d,]+)\]/g)].map(m => (m[1] ?? '').split(',').map(Number))
    expect(arrays).toHaveLength(4)
    expect(arrays.every(a => a.length === 10)).toBe(true)
    expect(arrays.flat().every(n => Number.isInteger(n) && n >= 1400 && n <= 57000)).toBe(true)
    expect(arrays[0]?.reduce((a,b) => a+b, 0)).toBe(59800)
    expect(arrays[3]?.reduce((a,b) => a+b, 0)).toBe(61000)
  })
})