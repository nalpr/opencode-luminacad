import { describe, expect, test } from 'vitest'

import { buildBinaryStl, buildStepScript } from './exporters'
import { designOf, initialModel } from '../state'

const design = designOf(initialModel)

const options = {
  design,
  presetName: 'Nordic Fluted',
  radialSegments: 32,
  heightSegments: 16,
}

describe('buildBinaryStl', () => {
  test('writes a valid STL header and triangle count', () => {
    const { buffer, triangles } = buildBinaryStl(options)
    expect(triangles).toBeGreaterThan(0)
    expect(buffer.byteLength).toBe(84 + triangles * 50)

    const view = new DataView(buffer)
    expect(view.getUint32(80, true)).toBe(triangles)
  })

  test('names the part in the header', () => {
    const { buffer } = buildBinaryStl(options)
    const header = new TextDecoder().decode(new Uint8Array(buffer, 0, 80))
    expect(header).toContain('Nordic Fluted')
    expect(header).toContain('mm')
  })

  test('every triangle has a unit normal', () => {
    const { buffer, triangles } = buildBinaryStl(options)
    const view = new DataView(buffer)
    for (let i = 0; i < triangles; i++) {
      const offset = 84 + i * 50
      const nx = view.getFloat32(offset, true)
      const ny = view.getFloat32(offset + 4, true)
      const nz = view.getFloat32(offset + 8, true)
      const length = Math.sqrt(nx * nx + ny * ny + nz * nz)
      expect(length).toBeCloseTo(1, 3)
    }
  })
})

describe('buildStepScript', () => {
  test('writes a valid ISO-10303-21 envelope', () => {
    const script = buildStepScript(options)
    expect(script.startsWith('ISO-10303-21;')).toBe(true)
    expect(script.endsWith('END-ISO-10303-21;')).toBe(true)
    expect(script).toContain('HEADER;')
    expect(script).toContain('DATA;')
    expect(script).toContain('ENDSEC;')
  })

  test('records the design parameters in the data section', () => {
    const script = buildStepScript(options)
    expect(script).toContain(`height=${design.height}mm`)
    expect(script).toContain(`bottomR=${design.bottomRadius}mm`)
    expect(script).toContain(design.profileType)
    expect(script).toContain(design.patternType)
  })
})
