import type { DesignParams } from '../state'
import { profileRadius, sampleProfile } from './kernel'

export type ConstraintSeverity = 'error' | 'warning'

export interface ConstraintFinding {
  readonly severity: ConstraintSeverity
  readonly code: string
  readonly message: string
}

export interface ConstraintReport {
  readonly findings: ReadonlyArray<ConstraintFinding>
  readonly errors: ReadonlyArray<ConstraintFinding>
  readonly warnings: ReadonlyArray<ConstraintFinding>
  readonly printable: boolean
  readonly minimumWall: number
  readonly maximumOverhangAngle: number
  readonly buildVolumeUsed: number
}

export const MIN_WALL_MM = 0.8
export const NOZZLE_MM = 0.4
export const MAX_OVERHANG_DEGREES = 45
export const BUILD_PLATE_MM = 256
export const MAX_PRINT_HEIGHT_MM = 250

const round = (value: number, digits = 1): number => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

export const auditPrintability = (design: DesignParams): ConstraintReport => {
  const findings: Array<ConstraintFinding> = []

  const profile = sampleProfile(design, 64)
  const minimumWall = profile.reduce((min, point) => {
    const wall = profileRadius(design, point.v) - profileRadius(design, point.v - 0.01)
    return Math.min(min, wall)
  }, Number.POSITIVE_INFINITY)

  if (design.wallThickness < MIN_WALL_MM) {
    findings.push({
      severity: 'error',
      code: 'wall-too-thin',
      message: `Wall thickness ${design.wallThickness.toFixed(2)}mm is below the ${MIN_WALL_MM}mm minimum for FDM printing.`,
    })
  }

  if (design.height > MAX_PRINT_HEIGHT_MM) {
    findings.push({
      severity: 'error',
      code: 'height-exceeds-volume',
      message: `Height ${design.height}mm exceeds the ${MAX_PRINT_HEIGHT_MM}mm build volume.`,
    })
  }

  const outerRadius =
    Math.max(design.bottomRadius, design.topRadius) + design.patternDepth
  if (outerRadius * 2 > BUILD_PLATE_MM) {
    findings.push({
      severity: 'error',
      code: 'footprint-exceeds-plate',
      message: `Footprint Ø${Math.round(outerRadius * 2)}mm exceeds the ${BUILD_PLATE_MM}mm build plate.`,
    })
  }

  if (design.wallThickness % NOZZLE_MM > 1e-6) {
    findings.push({
      severity: 'warning',
      code: 'wall-not-nozzle-multiple',
      message: `Wall thickness ${design.wallThickness.toFixed(2)}mm is not a multiple of the ${NOZZLE_MM}mm nozzle.`,
    })
  }

  // Overhang audit. A wall that flares outward as it rises (the radius
  // increases with height) leans over the space below it and needs support
  // once the lean passes 45° from vertical. A wall that tapers inward is
  // self-supporting at any angle, so it never counts.
  let maximumOverhang = 0
  for (let i = 1; i < profile.length; i++) {
    const previous = profile[i - 1]
    const current = profile[i]
    const dz = current.z - previous.z
    if (dz <= 1e-6) continue
    const dr = current.radius - previous.radius
    if (dr <= 0) continue
    const angle = (Math.atan2(dr, dz) * 180) / Math.PI
    if (angle > maximumOverhang) maximumOverhang = angle
  }

  if (maximumOverhang > MAX_OVERHANG_DEGREES) {
    findings.push({
      severity: 'warning',
      code: 'overhang-requires-support',
      message: `Maximum overhang ${round(maximumOverhang)}° exceeds ${MAX_OVERHANG_DEGREES}° and will need support material.`,
    })
  }

  if (design.fitterType !== 'none') {
    const mountRadius = profileRadius(design, 0.1)
    const socketOuter = design.socketDiameter / 2 + design.socketRingWidth
    if (socketOuter > mountRadius - 2) {
      findings.push({
        severity: 'error',
        code: 'socket-intersects-wall',
        message: `Socket ring Ø${round(socketOuter * 2)}mm intersects the shade wall at the mount height.`,
      })
    }
  }

  if (design.radialFreq < 4) {
    findings.push({
      severity: 'warning',
      code: 'low-radial-frequency',
      message: `Radial frequency ${design.radialFreq} is very low and produces weak ribs.`,
    })
  }

  if (design.patternDepth > design.wallThickness * 4) {
    findings.push({
      severity: 'warning',
      code: 'relief-exceeds-wall',
      message: `Relief depth ${design.patternDepth}mm is deep relative to the ${design.wallThickness}mm wall.`,
    })
  }

  if (design.spokeCount < 3 && design.fitterType !== 'none') {
    findings.push({
      severity: 'warning',
      code: 'too-few-spokes',
      message: `${design.spokeCount} spokes cannot stabilise the socket ring.`,
    })
  }

  const errors = findings.filter((f) => f.severity === 'error')
  const warnings = findings.filter((f) => f.severity === 'warning')
  const buildVolumeUsed =
    ((outerRadius * 2) * (outerRadius * 2) * design.height) / 1_000_000

  return {
    findings,
    errors,
    warnings,
    printable: errors.length === 0,
    minimumWall: Number.isFinite(minimumWall) ? round(minimumWall, 2) : design.wallThickness,
    maximumOverhangAngle: round(maximumOverhang),
    buildVolumeUsed: round(buildVolumeUsed, 2),
  }
}
