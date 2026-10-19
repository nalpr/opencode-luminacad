import { describe, expect, test } from 'vitest'

import { auditPrintability } from './constraints'
import { designOf, initialModel } from '../state'

const design = designOf(initialModel)

describe('auditPrintability', () => {
  test('the default design is printable', () => {
    const report = auditPrintability(design)
    expect(report.printable).toBe(true)
    expect(report.errors.length).toBe(0)
  })

  test('a wall thinner than 0.8mm is an error', () => {
    const report = auditPrintability({ ...design, wallThickness: 0.6 })
    expect(report.printable).toBe(false)
    expect(report.errors.some((f) => f.code === 'wall-too-thin')).toBe(true)
  })

  test('a shade taller than the build volume is an error', () => {
    const report = auditPrintability({ ...design, height: 300 })
    expect(report.printable).toBe(false)
    expect(report.errors.some((f) => f.code === 'height-exceeds-volume')).toBe(true)
  })

  test('a shade wider than the build plate is an error', () => {
    const report = auditPrintability({ ...design, bottomRadius: 200 })
    expect(report.printable).toBe(false)
    expect(report.errors.some((f) => f.code === 'footprint-exceeds-plate')).toBe(true)
  })

  test('a socket ring that intersects the wall is an error', () => {
    const report = auditPrintability({
      ...design,
      bottomRadius: 30,
      socketDiameter: 70,
      socketRingWidth: 12,
    })
    expect(report.printable).toBe(false)
    expect(report.errors.some((f) => f.code === 'socket-intersects-wall')).toBe(true)
  })

  test('a wall that is not a nozzle multiple is a warning, not an error', () => {
    const report = auditPrintability({ ...design, wallThickness: 1.7 })
    expect(report.printable).toBe(true)
    expect(report.warnings.some((f) => f.code === 'wall-not-nozzle-multiple')).toBe(true)
  })

  test('a steep taper warns that supports will be needed', () => {
    const report = auditPrintability({
      ...design,
      profileType: 'bell',
      bottomRadius: 30,
      topRadius: 120,
      height: 120,
    })
    expect(report.warnings.some((f) => f.code === 'overhang-requires-support')).toBe(true)
  })

  test('a self-supporting taper does not warn about supports', () => {
    const report = auditPrintability({
      ...design,
      profileType: 'cylinder',
      curvature: 0,
      bottomRadius: 120,
      topRadius: 20,
      height: 280,
    })
    expect(report.warnings.some((f) => f.code === 'overhang-requires-support')).toBe(false)
  })

  test('every finding carries a code, a message, and a severity', () => {
    const report = auditPrintability({ ...design, wallThickness: 0.4, height: 400 })
    for (const finding of report.findings) {
      expect(finding.code.length).toBeGreaterThan(0)
      expect(finding.message.length).toBeGreaterThan(0)
      expect(['error', 'warning']).toContain(finding.severity)
    }
  })
})
