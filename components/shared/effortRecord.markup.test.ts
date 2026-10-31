// COACH-EFFORT-PICTURE-01 — every run, by where its time went (§132; founder picked option A, 2026-10-31).
import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import EffortRecord, { effortHeadline, EFFORT_RECORD_MAX_COLUMNS } from './EffortRecord'
import { COACH_EFFORT_MIN_RUNS } from '@/lib/coaching/constants'
import type { EffortRun } from '@/lib/coaching/runEffort'

const run = (kind: EffortRun['kind'], thisWeek = false): EffortRun => ({ date: '2026-10-01T07:00:00Z', z1: 5, z2: 40, z3: 45, z45: 10, kind, thisWeek })
const html = (runs: EffortRun[]) => renderToStaticMarkup(React.createElement(EffortRecord, { runs, weeks: 8 }))
const text = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

describe('EffortRecord', () => {
  it('draws nothing below the minimum runs', () => {
    expect(html(Array.from({ length: COACH_EFFORT_MIN_RUNS - 1 }, () => run('easy')))).toBe('')
  })

  it('🔴 counts only grey runs: split and planned never count, and carry no dot', () => {
    const h = html([run('grey'), run('grey'), run('split'), run('planned'), run('easy'), run('hard', true)])
    expect(text(h)).toContain('2 of your 6 runs spent most of their time in Zone 3.')
    expect((h.match(/data-run="/g) ?? []).length).toBe(6)
    const dots = Array.from(h.matchAll(/data-run="(\w+)"[^]*?border-radius:50%;background:([^"]+)"/g)).map(m => [m[1], m[2]])
    for (const [kind, bg] of dots) expect(bg === 'transparent').toBe(kind !== 'grey')
  })

  it('names Zone 3 as the grey zone on easy days, and makes no claim about intent', () => {
    const t = text(html(Array.from({ length: 6 }, () => run('grey'))))
    expect(t).toContain('Zone 3 is the grey zone on easy days. A tempo belongs there')
    expect(t).not.toMatch(/should have been|too hard|lazy/i)
  })

  it('🔴 a dense record draws the most recent runs, at most the cap, and says so (Design Board 2026-10-31)', () => {
    const many = Array.from({ length: 40 }, (_, i) => run(i === 39 ? 'grey' : 'easy', i === 39))
    const h = html(many)
    expect((h.match(/data-run="/g) ?? []).length).toBe(EFFORT_RECORD_MAX_COLUMNS)
    expect(text(h)).toContain(`last ${EFFORT_RECORD_MAX_COLUMNS} runs`)
    expect(text(h)).toContain(`1 of your ${EFFORT_RECORD_MAX_COLUMNS} runs spent most of its time in Zone 3.`)
    expect(h).toContain('data-this-week="true"')
  })

  it('headline grammar', () => {
    expect(effortHeadline(0, 9)).toBe('None of your 9 runs spent most of their time in Zone 3.')
    expect(effortHeadline(1, 9)).toBe('1 of your 9 runs spent most of its time in Zone 3.')
  })

  it('rings this week and colours the count in ink, never a verdict hue', () => {
    const h = html([...Array.from({ length: 5 }, () => run('easy')), run('grey', true)])
    expect((h.match(/data-this-week="true"/g) ?? []).length).toBe(1)
    expect(h).not.toMatch(/var\(--warn\)|var\(--danger\)/)
  })
})

describe('🔴 Coach mounts it after "This week" and before the easy run trend', () => {
  const src = readFileSync('app/dashboard/DashboardClient.tsx', 'utf8')
  it('order', () => {
    const facts = src.indexOf('<WeekFacts')
    const effort = src.indexOf('<EffortRecord')
    const trend = src.indexOf('<TrendCard state="skeleton"')
    expect(facts).toBeGreaterThan(-1)
    expect(effort).toBeGreaterThan(facts)
    expect(trend).toBeGreaterThan(effort)
  })
})
