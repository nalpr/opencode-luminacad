import * as THREE from 'three'

import type { DesignParams } from '../state'
import { buildLampShadeGeometry } from './kernel'

export interface ExportOptions {
  readonly design: DesignParams
  readonly radialSegments: number
  readonly heightSegments: number
  readonly presetName: string
}

export interface ExportResult {
  readonly fileName: string
  readonly triangles: number
  readonly bytes: number
}

const sanitize = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')

export const buildBinaryStl = (
  options: ExportOptions,
): { readonly buffer: ArrayBuffer; readonly triangles: number } => {
  const geometry = buildLampShadeGeometry({
    design: options.design,
    activeStep: 8,
    radialSegments: options.radialSegments,
    heightSegments: options.heightSegments,
    forExport: true,
  })

  const position = geometry.getAttribute('position') as THREE.BufferAttribute
  const index = geometry.getIndex() as THREE.BufferAttribute
  const triangleCount = index.count / 3

  const buffer = new ArrayBuffer(84 + triangleCount * 50)
  const view = new DataView(buffer)

  const header = `LuminaCAD Studio Pro manifold lamp shade (${options.presetName}) - unit: mm`
  for (let i = 0; i < 80; i++) {
    view.setUint8(i, i < header.length ? header.charCodeAt(i) : 32)
  }
  view.setUint32(80, triangleCount, true)

  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  const c = new THREE.Vector3()
  const cb = new THREE.Vector3()
  const ab = new THREE.Vector3()

  let offset = 84
  for (let i = 0; i < triangleCount; i++) {
    const i0 = index.getX(i * 3)
    const i1 = index.getX(i * 3 + 1)
    const i2 = index.getX(i * 3 + 2)

    a.set(position.getX(i0), -position.getZ(i0), position.getY(i0))
    b.set(position.getX(i1), -position.getZ(i1), position.getY(i1))
    c.set(position.getX(i2), -position.getZ(i2), position.getY(i2))

    cb.subVectors(c, b)
    ab.subVectors(a, b)
    cb.cross(ab).normalize()

    view.setFloat32(offset, cb.x, true); offset += 4
    view.setFloat32(offset, cb.y, true); offset += 4
    view.setFloat32(offset, cb.z, true); offset += 4

    view.setFloat32(offset, a.x, true); offset += 4
    view.setFloat32(offset, a.y, true); offset += 4
    view.setFloat32(offset, a.z, true); offset += 4

    view.setFloat32(offset, b.x, true); offset += 4
    view.setFloat32(offset, b.y, true); offset += 4
    view.setFloat32(offset, b.z, true); offset += 4

    view.setFloat32(offset, c.x, true); offset += 4
    view.setFloat32(offset, c.y, true); offset += 4
    view.setFloat32(offset, c.z, true); offset += 4

    view.setUint16(offset, 0, true); offset += 2
  }

  geometry.dispose()
  return { buffer, triangles: triangleCount }
}

export const downloadBuffer = (
  buffer: ArrayBuffer,
  fileName: string,
  mimeType: string,
): void => {
  const blob = new Blob([buffer], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export const exportBinaryStl = (options: ExportOptions): ExportResult => {
  const { buffer, triangles } = buildBinaryStl(options)
  const fileName = `luminacad_${sanitize(options.presetName)}_${options.design.height}mm.stl`
  downloadBuffer(buffer, fileName, 'application/octet-stream')
  return { fileName, triangles, bytes: buffer.byteLength }
}

export const buildStepScript = (options: ExportOptions): string => {
  const d = options.design
  const lines: Array<string> = []
  lines.push('ISO-10303-21;')
  lines.push('HEADER;')
  lines.push(
    `FILE_DESCRIPTION(('LuminaCAD Studio Pro lamp shade - ${options.presetName}'),'2;1');`,
  )
  lines.push(
    `FILE_NAME('${sanitize(options.presetName)}.step','2026-10-19T00:00:00',('LuminaCAD'),('LuminaCAD Studio Pro'),'LuminaCAD 0.1.0','LuminaCAD Studio Pro','');`,
  )
  lines.push("FILE_SCHEMA(('AUTOMOTIVE_DESIGN { 1 0 10303 214 3 1 1 }'));")
  lines.push('ENDSEC;')
  lines.push('DATA;')
  lines.push(`/* LuminaCAD parametric lamp shade: height=${d.height}mm bottomR=${d.bottomRadius}mm topR=${d.topRadius}mm wall=${d.wallThickness}mm */`)
  lines.push(`#1=PRODUCT('${sanitize(options.presetName)}','${options.presetName}','',(#2));`)
  lines.push('#2=PRODUCT_DEFINITION_FORMATION_WITH_SPECIFIED_SOURCE(\'1\',\'\',#3,.NOT_KNOWN.);')
  lines.push('#3=PRODUCT_DEFINITION_CONTEXT(\'part definition\',#4,\'design\');')
  lines.push('#4=APPLICATION_CONTEXT(\'automotive design\');')
  lines.push('#5=PRODUCT_DEFINITION(\'design\',\'\',#3,#2);')
  lines.push('#6=PRODUCT_DEFINITION_SHAPE(\'\',\'\',#5);')
  lines.push('#7=SHAPE_REPRESENTATION(\'LampShade\',(#8),#9);')
  lines.push('#8=AXIS2_PLACEMENT_3D(\'\',#10,#11,#12);')
  lines.push('#9=CARTESIAN_POINT(\'\',(0.,0.,0.));')
  lines.push('#10=CARTESIAN_POINT(\'\',(0.,0.,0.));')
  lines.push('#11=DIRECTION(\'\',(0.,0.,1.));')
  lines.push('#12=DIRECTION(\'\',(1.,0.,0.));')
  lines.push('#13=ADVANCED_BREP_SHAPE_REPRESENTATION(\'LampShade\',(#7),#9);')
  lines.push('#14=SHAPE_DEFINITION_REPRESENTATION(#6,#13);')
  lines.push(`/* profile: ${d.profileType} curve, bottomR=${d.bottomRadius}mm topR=${d.topRadius}mm curvature=${d.curvature} */`)
  lines.push(`/* pattern: ${d.patternType} count=${d.radialFreq} depth=${d.patternDepth}mm twist=${d.twistAngle}deg */`)
  lines.push(`/* fitter: ${d.fitterType} bore=${d.socketDiameter}mm spokes=${d.spokeCount} */`)
  lines.push('ENDSEC;')
  lines.push('END-ISO-10303-21;')
  return lines.join('\n')
}

export const exportStepScript = (options: ExportOptions): ExportResult => {
  const script = buildStepScript(options)
  const buffer = new TextEncoder().encode(script).buffer as ArrayBuffer
  const fileName = `luminacad_${sanitize(options.presetName)}_${options.design.height}mm.step`
  downloadBuffer(buffer, fileName, 'application/step')
  return { fileName, triangles: 0, bytes: buffer.byteLength }
}
