import * as THREE from 'three'

import type { DesignParams } from '../state'

export interface ProfilePoint {
  readonly v: number
  readonly radius: number
  readonly z: number
}

export const smoothstep = (edge0: number, edge1: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - edge0) / Math.max(1e-5, edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

export const profileRadius = (design: DesignParams, v: number): number => {
  const Rb = design.bottomRadius
  const Rt = design.topRadius
  const linearR = Rb + (Rt - Rb) * v
  const c = design.curvature
  const w = design.waistPos

  const shiftedV =
    v < w
      ? 0.5 * (v / Math.max(0.05, w))
      : 0.5 + 0.5 * ((v - w) / Math.max(0.05, 1 - w))
  const arch = Math.sin(shiftedV * Math.PI)
  const avgR = 0.5 * (Rb + Rt)

  switch (design.profileType) {
    case 'cylinder':
      return Math.max(12, linearR + c * 15 * arch)
    case 'hourglass':
      return Math.max(12, linearR - Math.abs(c + 0.15) * avgR * 0.55 * Math.pow(arch, 1.4))
    case 'bulbous':
      return Math.max(12, linearR + c * avgR * 0.75 * Math.pow(arch, 1.1))
    case 'bell': {
      const bellCurve = Math.sin(v * Math.PI * 1.5) * (1 - v * 0.4)
      return Math.max(12, linearR + c * avgR * 0.55 * bellCurve)
    }
    case 'organic': {
      const wave = Math.sin(v * Math.PI * 2.5) * 0.6 + Math.sin(v * Math.PI) * 0.8
      return Math.max(12, linearR + c * avgR * 0.45 * wave)
    }
    case 'pagoda': {
      const tiers = 4
      const tierWave = Math.sin(v * Math.PI * tiers * 2) * 0.18 + arch * 0.6
      return Math.max(12, linearR + c * avgR * 0.45 * tierWave)
    }
    default:
      return Math.max(12, linearR)
  }
}

export const sampleProfile = (
  design: DesignParams,
  segments: number,
): ReadonlyArray<ProfilePoint> =>
  Array.from({ length: segments + 1 }, (_, index) => {
    const v = index / segments
    return { v, radius: profileRadius(design, v), z: v * design.height }
  })

export const patternOffset = (
  design: DesignParams,
  theta: number,
  v: number,
  step: number,
): number => {
  if (step < 5) return 0
  const depth = design.patternDepth
  if (depth <= 0.001) return 0

  const Nr = Math.round(design.radialFreq)
  const Nv = design.verticalFreq
  const sharp = design.sharpness

  // The twist is a function of the height fraction, so the relief rotates by
  // `twistAngle` over the full height and is aligned at the base.
  const twist = ((design.twistAngle * Math.PI) / 180) * v

  let singleSectorMask = 1.0
  if (step === 5) {
    const sectorWidth = (Math.PI * 2) / Math.max(4, Nr)
    const twistedTheta =
      (((theta + twist * 0.15) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
    singleSectorMask = twistedTheta <= sectorWidth * 1.35 ? 1.0 : 0.0
  }

  let rimFactor = 1.0
  if (design.rimBorder > 0) {
    const rimV = Math.min(0.35, design.rimBorder / design.height)
    rimFactor = smoothstep(0, rimV, v) * smoothstep(0, rimV, 1 - v)
  }

  let value = 0
  switch (design.patternType) {
    case 'flutes': {
      const phase = Nr * (theta - twist)
      value = Math.pow(0.5 + 0.5 * Math.cos(phase), sharp)
      break
    }
    case 'diamond': {
      const u1 = Nr * (theta - twist) + v * Nv * Math.PI * 2
      const u2 = Nr * (theta + twist) - v * Nv * Math.PI * 2
      value = Math.pow(Math.abs(Math.sin(u1 * 0.5) * Math.sin(u2 * 0.5)), sharp)
      break
    }
    case 'waves': {
      const wavePhase = v * Nv * Math.PI * 2 + Math.sin(Nr * (theta - twist)) * 1.4
      value = Math.pow(0.5 + 0.5 * Math.sin(wavePhase), sharp)
      break
    }
    case 'cellular': {
      const row = v * Nv * 2
      const rowIndex = Math.floor(row)
      const fv = row - rowIndex
      const colOffset = (rowIndex % 2) * 0.5
      const col = (theta / (Math.PI * 2)) * Nr + (twist / (Math.PI * 2)) * Nr + colOffset
      const fu = col - Math.floor(col)
      let minDist = 10
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const shift = (Math.abs(dy) % 2) * 0.5
          const cx = dx + 0.5 + shift
          const cy = dy + 0.5
          const cellHash =
            Math.sin((rowIndex + dy) * 127.1 + (Math.floor(col) + dx) * 311.7) * 43758.5453
          const jx = (cellHash - Math.floor(cellHash) - 0.5) * 0.25
          const dist = Math.hypot(fu - (cx + jx), (fv - cy) * 0.95)
          if (dist < minDist) minDist = dist
        }
      }
      value = Math.pow(Math.min(1, minDist * 1.55), sharp)
      break
    }
    case 'lattice': {
      const p1 = 0.5 + 0.5 * Math.cos(Nr * (theta - twist) + v * Nv * Math.PI * 2)
      const p2 = 0.5 + 0.5 * Math.cos(Nr * (theta + twist) - v * Nv * Math.PI * 2)
      value = Math.max(Math.pow(p1, sharp * 2.2), Math.pow(p2, sharp * 2.2))
      break
    }
    case 'moire': {
      const w1 = Math.sin(Nr * (theta - twist) + v * Nv * Math.PI * 2)
      const w2 = Math.sin((Nr + 2) * (theta + twist * 0.5) - v * (Nv * 1.3) * Math.PI * 2)
      value = Math.pow(Math.max(0, 0.5 + 0.25 * (w1 + w2)), sharp)
      break
    }
    case 'origami': {
      const tier = v * Nv
      const tierIndex = Math.floor(tier)
      const tv = tier - tierIndex
      const triV = tv < 0.5 ? tv * 2 : 2 - tv * 2
      const phaseShift = (tierIndex * 0.5 + triV * 0.5) * ((Math.PI * 2) / Nr)
      const angle = (theta + twist + phaseShift) * (Nr / (Math.PI * 2))
      const fu = angle - Math.floor(angle)
      const triU = fu < 0.5 ? fu * 2 : 2 - fu * 2
      const fold = (1 - Math.abs(triU - triV)) * 0.7 + triU * 0.3
      value = Math.pow(Math.max(0, fold), sharp * 0.85)
      break
    }
    default:
      value = 0
  }

  return value * depth * rimFactor * singleSectorMask
}

export interface MeshOptions {
  readonly design: DesignParams
  readonly activeStep: number
  readonly radialSegments: number
  readonly heightSegments: number
  readonly forExport?: boolean
}

export const buildLampShadeGeometry = (options: MeshOptions): THREE.BufferGeometry => {
  const { design, radialSegments, heightSegments } = options
  const step = options.forExport === true ? 8 : options.activeStep
  const wallT = design.wallThickness

  const positions: Array<number> = []
  const colors: Array<number> = []
  const indices: Array<number> = []

  let vertexCount = 0
  const addVertex = (
    x: number,
    y: number,
    z: number,
    localThickness: number,
    highlighted: boolean,
  ): number => {
    positions.push(x, y, z)
    if (highlighted && options.forExport !== true) {
      colors.push(1.0, 0.72, 0.15)
    } else {
      const transmit = Math.exp(-0.38 * Math.max(0.5, localThickness))
      colors.push(transmit, transmit, transmit)
    }
    return vertexCount++
  }

  const outerGrid: Array<Int32Array> = []
  const innerGrid: Array<Int32Array> = []
  const isSolid = step === 3

  for (let j = 0; j <= heightSegments; j++) {
    const v = j / heightSegments
    const y = v * design.height
    const baseRadius = profileRadius(design, v)

    const outerRow = new Int32Array(radialSegments)
    const innerRow = new Int32Array(radialSegments)

    for (let i = 0; i < radialSegments; i++) {
      const theta = (i / radialSegments) * Math.PI * 2
      const cosT = Math.cos(theta)
      const sinT = Math.sin(theta)

      const relief = patternOffset(design, theta, v, step)
      const rOuter = Math.max(8, baseRadius + relief)

      let rInner: number
      if (isSolid) {
        rInner = 0
      } else if (design.innerWallMode === 'smooth') {
        rInner = Math.min(rOuter - 0.8, Math.max(5, baseRadius - wallT * 0.6))
      } else {
        rInner = Math.max(5, rOuter - wallT)
      }

      const localThickness = isSolid ? 8.0 : rOuter - rInner
      const isStepFiveFeature = step === 5 && relief > 0.25

      outerRow[i] = addVertex(rOuter * cosT, y, rOuter * sinT, localThickness, isStepFiveFeature)
      innerRow[i] = addVertex(rInner * cosT, y, rInner * sinT, localThickness, false)
    }

    outerGrid.push(outerRow)
    innerGrid.push(innerRow)
  }

  for (let j = 0; j < heightSegments; j++) {
    for (let i = 0; i < radialSegments; i++) {
      const iNext = (i + 1) % radialSegments

      const oA = outerGrid[j][i]
      const oB = outerGrid[j][iNext]
      const oC = outerGrid[j + 1][i]
      const oD = outerGrid[j + 1][iNext]
      indices.push(oB, oD, oA)
      indices.push(oD, oC, oA)

      if (isSolid) continue

      const iA = innerGrid[j][i]
      const iB = innerGrid[j][iNext]
      const iC = innerGrid[j + 1][i]
      const iD = innerGrid[j + 1][iNext]
      indices.push(iA, iD, iB)
      indices.push(iA, iC, iD)
    }
  }

  if (isSolid) {
    // A solid revolve closes on the axis: one centre vertex caps each end.
    const bottomCentre = addVertex(0, 0, 0, 8.0, false)
    const topCentre = addVertex(0, design.height, 0, 8.0, false)

    for (let i = 0; i < radialSegments; i++) {
      const iNext = (i + 1) % radialSegments
      indices.push(bottomCentre, outerGrid[0][iNext], outerGrid[0][i])
      indices.push(topCentre, outerGrid[heightSegments][i], outerGrid[heightSegments][iNext])
    }
  } else {
    for (let i = 0; i < radialSegments; i++) {
      const iNext = (i + 1) % radialSegments
      indices.push(innerGrid[heightSegments][i], outerGrid[heightSegments][iNext], outerGrid[heightSegments][i])
      indices.push(innerGrid[heightSegments][i], innerGrid[heightSegments][iNext], outerGrid[heightSegments][iNext])
    }

    for (let i = 0; i < radialSegments; i++) {
      const iNext = (i + 1) % radialSegments
      indices.push(innerGrid[0][i], outerGrid[0][i], outerGrid[0][iNext])
      indices.push(innerGrid[0][i], outerGrid[0][iNext], innerGrid[0][iNext])
    }
  }

  if (step >= 7) {
    if (design.fitterType === 'solid_base') {
      addSolidBaseFloor(addVertex, indices, radialSegments, wallT, design)
    } else if (design.fitterType === 'bottom_ring' || design.fitterType === 'top_spider') {
      addSocketFitterGeometry(
        addVertex,
        indices,
        design,
        design.fitterType === 'top_spider',
        step === 7,
      )
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

const addSolidBaseFloor = (
  addVertex: (x: number, y: number, z: number, t: number, highlighted: boolean) => number,
  indices: Array<number>,
  radialSegments: number,
  wallT: number,
  design: DesignParams,
): void => {
  const baseRadius = profileRadius(design, 0)
  const floorRadius = Math.max(6, baseRadius - wallT * 0.35)
  const floorHeight = Math.max(1.6, wallT)
  const bottomCenter = addVertex(0, 0, 0, floorHeight * 2, false)
  const topCenter = addVertex(0, floorHeight, 0, floorHeight * 2, false)
  const bottomRing: Array<number> = []
  const topRing: Array<number> = []
  const sideBottomRing: Array<number> = []
  const sideTopRing: Array<number> = []

  for (let i = 0; i < radialSegments; i++) {
    const theta = (i / radialSegments) * Math.PI * 2
    const x = floorRadius * Math.cos(theta)
    const z = floorRadius * Math.sin(theta)
    bottomRing.push(addVertex(x, 0, z, floorHeight * 2, false))
    topRing.push(addVertex(x, floorHeight, z, floorHeight * 2, false))
    sideBottomRing.push(addVertex(x, 0, z, floorHeight * 2, false))
    sideTopRing.push(addVertex(x, floorHeight, z, floorHeight * 2, false))
  }

  for (let i = 0; i < radialSegments; i++) {
    const iNext = (i + 1) % radialSegments
    indices.push(bottomCenter, bottomRing[i], bottomRing[iNext])
    indices.push(topCenter, topRing[iNext], topRing[i])
    indices.push(sideBottomRing[iNext], sideTopRing[iNext], sideBottomRing[i])
    indices.push(sideTopRing[iNext], sideTopRing[i], sideBottomRing[i])
  }
}

const addSocketFitterGeometry = (
  addVertex: (x: number, y: number, z: number, t: number, highlighted: boolean) => number,
  indices: Array<number>,
  design: DesignParams,
  isTop: boolean,
  highlight: boolean,
): void => {
  const rInner = design.socketDiameter / 2
  const rOuter = rInner + design.socketRingWidth
  const spokeHeight = design.spokeThickness
  const y0 = isTop ? design.height - spokeHeight - 4 : 0
  const y1 = y0 + spokeHeight
  const mountV = ((y0 + y1) * 0.5) / design.height
  const shadeRadiusAtMount = profileRadius(design, mountV)

  if (rInner >= shadeRadiusAtMount - 4) return

  const ringSegments = 64
  const ringOuterBottom: Array<number> = []
  const ringOuterTop: Array<number> = []
  const ringInnerBottom: Array<number> = []
  const ringInnerTop: Array<number> = []

  for (let i = 0; i < ringSegments; i++) {
    const theta = (i / ringSegments) * Math.PI * 2
    const cosT = Math.cos(theta)
    const sinT = Math.sin(theta)
    ringOuterBottom.push(addVertex(rOuter * cosT, y0, rOuter * sinT, 6.0, highlight))
    ringOuterTop.push(addVertex(rOuter * cosT, y1, rOuter * sinT, 6.0, highlight))
    ringInnerBottom.push(addVertex(rInner * cosT, y0, rInner * sinT, 6.0, highlight))
    ringInnerTop.push(addVertex(rInner * cosT, y1, rInner * sinT, 6.0, highlight))
  }

  for (let i = 0; i < ringSegments; i++) {
    const iNext = (i + 1) % ringSegments
    indices.push(ringOuterBottom[iNext], ringOuterTop[iNext], ringOuterBottom[i])
    indices.push(ringOuterTop[iNext], ringOuterTop[i], ringOuterBottom[i])
    indices.push(ringInnerBottom[i], ringInnerTop[iNext], ringInnerBottom[iNext])
    indices.push(ringInnerBottom[i], ringInnerTop[i], ringInnerTop[iNext])
    indices.push(ringInnerTop[i], ringOuterTop[iNext], ringOuterTop[i])
    indices.push(ringInnerTop[i], ringInnerTop[iNext], ringOuterTop[iNext])
    indices.push(ringInnerBottom[i], ringOuterBottom[i], ringOuterBottom[iNext])
    indices.push(ringInnerBottom[i], ringOuterBottom[iNext], ringInnerBottom[iNext])
  }

  const spokeCount = Math.round(design.spokeCount)
  const halfWidth = design.spokeWidth * 0.5
  const startRadius = rOuter - 1.5
  const endRadius = Math.max(
    startRadius + 2,
    shadeRadiusAtMount - design.wallThickness * 0.35,
  )

  for (let k = 0; k < spokeCount; k++) {
    const angle = (k / spokeCount) * Math.PI * 2
    const cosA = Math.cos(angle)
    const sinA = Math.sin(angle)
    const tx = -sinA
    const tz = cosA

    const p00 = { x: startRadius * cosA - halfWidth * tx, z: startRadius * sinA - halfWidth * tz }
    const p10 = { x: endRadius * cosA - halfWidth * tx, z: endRadius * sinA - halfWidth * tz }
    const p11 = { x: endRadius * cosA + halfWidth * tx, z: endRadius * sinA + halfWidth * tz }
    const p01 = { x: startRadius * cosA + halfWidth * tx, z: startRadius * sinA + halfWidth * tz }

    const b00 = addVertex(p00.x, y0, p00.z, 6.0, highlight)
    const b10 = addVertex(p10.x, y0, p10.z, 6.0, highlight)
    const b11 = addVertex(p11.x, y0, p11.z, 6.0, highlight)
    const b01 = addVertex(p01.x, y0, p01.z, 6.0, highlight)

    const t00 = addVertex(p00.x, y1, p00.z, 6.0, highlight)
    const t10 = addVertex(p10.x, y1, p10.z, 6.0, highlight)
    const t11 = addVertex(p11.x, y1, p11.z, 6.0, highlight)
    const t01 = addVertex(p01.x, y1, p01.z, 6.0, highlight)

    indices.push(t00, t11, t10)
    indices.push(t00, t01, t11)
    indices.push(b00, b10, b11)
    indices.push(b00, b11, b01)
    indices.push(b00, t10, b10)
    indices.push(b00, t00, t10)
    indices.push(b11, t01, b01)
    indices.push(b11, t11, t01)
    indices.push(b01, t00, b00)
    indices.push(b01, t01, t00)
    indices.push(b10, t11, b11)
    indices.push(b10, t10, t11)
  }
}

export interface MeshStatistics {
  readonly triangles: number
  readonly vertices: number
  readonly outerRadius: number
  readonly height: number
  readonly volumeCm3: number
  readonly filamentGrams: number
  readonly filamentMeters: number
}

export const meshStatistics = (
  design: DesignParams,
  triangleCount: number,
  vertexCount: number,
): MeshStatistics => {
  const outerRadius =
    Math.max(design.bottomRadius, design.topRadius) + design.patternDepth
  const averageRadius = (design.bottomRadius + design.topRadius) * 0.5
  const averageWall = design.wallThickness + design.patternDepth * 0.45
  const volumeCm3 =
    (2 * Math.PI * averageRadius * design.height * averageWall) / 1000
  const filamentGrams = Math.round(volumeCm3 * 1.24)
  const filamentMeters = Number((filamentGrams / 2.98).toFixed(1))
  return {
    triangles: triangleCount,
    vertices: vertexCount,
    outerRadius,
    height: design.height,
    volumeCm3,
    filamentGrams,
    filamentMeters,
  }
}
