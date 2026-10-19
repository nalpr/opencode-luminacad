import { describe, expect, test } from 'vitest'

import { buildLampShadeGeometry, patternOffset, profileRadius, sampleProfile } from './kernel'
import { designOf, initialModel } from '../state'

const design = designOf(initialModel)

describe('profileRadius', () => {
  test('every profile type returns a positive radius across the full height', () => {
    const types = [
      'bulbous',
      'cylinder',
      'hourglass',
      'bell',
      'organic',
      'pagoda',
    ] as const
    for (const profileType of types) {
      for (let i = 0; i <= 20; i++) {
        const radius = profileRadius({ ...design, profileType }, i / 20)
        expect(radius).toBeGreaterThan(0)
      }
    }
  })

  test('a cylinder with no curvature keeps a near-constant radius', () => {
    const flat = { ...design, profileType: 'cylinder' as const, curvature: 0 }
    expect(profileRadius(flat, 0)).toBeCloseTo(flat.bottomRadius, 5)
    expect(profileRadius(flat, 1)).toBeCloseTo(flat.topRadius, 5)
  })

  test('sampleProfile spans the full height', () => {
    const points = sampleProfile(design, 32)
    expect(points.length).toBe(33)
    expect(points[0].z).toBe(0)
    expect(points[32].z).toBeCloseTo(design.height, 5)
  })
})

describe('patternOffset', () => {
  test('steps before the pattern stage carry no relief', () => {
    for (let step = 1; step <= 4; step++) {
      expect(patternOffset(design, 1.2, 0.5, step)).toBe(0)
    }
  })

  test('the pattern stage isolates a single rib', () => {
    const onSector = patternOffset(design, 0, 0.5, 5)
    const offSector = patternOffset(design, Math.PI, 0.5, 5)
    expect(onSector).toBeGreaterThan(0)
    expect(offSector).toBe(0)
  })

  test('the array stage applies relief all the way around', () => {
    expect(patternOffset(design, 0, 0.5, 6)).toBeGreaterThan(0)
    expect(patternOffset(design, Math.PI, 0.5, 6)).toBeGreaterThan(0)
  })

  test('the rim margin flattens the relief at the top and bottom', () => {
    const atRim = patternOffset(design, 0, 0, 6)
    const atMiddle = patternOffset(design, 0, 0.5, 6)
    expect(atRim).toBeLessThan(atMiddle)
  })

  test('a zero-depth pattern produces no relief', () => {
    expect(patternOffset({ ...design, patternDepth: 0 }, 0, 0.5, 6)).toBe(0)
  })
})

describe('buildLampShadeGeometry', () => {
  test('produces an indexed, non-empty, watertight-looking shell', () => {
    const geometry = buildLampShadeGeometry({
      design,
      activeStep: 8,
      radialSegments: 48,
      heightSegments: 24,
    })
    const position = geometry.getAttribute('position')
    const index = geometry.index
    expect(position.count).toBeGreaterThan(0)
    expect(index).not.toBeNull()
    expect(index!.count % 3).toBe(0)
    geometry.dispose()
  })

  test('the revolve stage is a solid, so the shell has no inner wall', () => {
    const solid = buildLampShadeGeometry({
      design,
      activeStep: 3,
      radialSegments: 32,
      heightSegments: 16,
    })
    const shelled = buildLampShadeGeometry({
      design,
      activeStep: 4,
      radialSegments: 32,
      heightSegments: 16,
    })
    const solidTriangles = solid.index!.count / 3
    const shelledTriangles = shelled.index!.count / 3
    expect(solidTriangles).toBeLessThan(shelledTriangles)
    expect(solidTriangles * 2).toBe(shelledTriangles)
    solid.dispose()
    shelled.dispose()
  })

  test('the export build is watertight enough to write an STL', () => {
    const geometry = buildLampShadeGeometry({
      design,
      activeStep: 8,
      radialSegments: 64,
      heightSegments: 32,
      forExport: true,
    })
    const index = geometry.index
    expect(index).not.toBeNull()
    expect(index!.count / 3).toBeGreaterThan(1000)
    geometry.dispose()
  })
})
