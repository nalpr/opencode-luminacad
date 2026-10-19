import type { DesignParams } from '../state'

export interface FluidCadLine {
  readonly text: string
  readonly step: number
}

export const generateFluidCadScript = (design: DesignParams): ReadonlyArray<FluidCadLine> => {
  const waistRadius = Math.round(
    (design.bottomRadius + design.topRadius) * 0.5 * (1 + design.curvature * 0.4),
  )

  const lines: Array<FluidCadLine> = [
    { step: 0, text: '// LuminaCAD declarative parametric script (lampshade.part.js)' },
    {
      step: 0,
      text: "import { part, param, sketch, revolve, shell, helix, sweep, wrap, repeat, cylinder, hole, union, select, exportStl } from 'fluidcad/core';",
    },
    { step: 0, text: '' },
    { step: 0, text: "export default part('printable_lampshade', ({ xy, xz }) => {" },
    { step: 1, text: '  // [STEP 1] Parametric schema & nozzle constraints' },
    {
      step: 1,
      text: `  const H     = param(${design.height}, { min: 70, max: 280, unit: 'mm', label: 'Shade Height' });`,
    },
    {
      step: 1,
      text: `  const Rb    = param(${design.bottomRadius}, { min: 25, max: 120, unit: 'mm', label: 'Bottom Radius' });`,
    },
    {
      step: 1,
      text: `  const Rt    = param(${design.topRadius}, { min: 20, max: 120, unit: 'mm', label: 'Top Radius' });`,
    },
    {
      step: 1,
      text: `  const wallT = param(${design.wallThickness.toFixed(1)}, { min: 0.8, max: 5.0, step: 0.4, label: 'Shell Wall' });`,
    },
    { step: 0, text: '' },
    { step: 2, text: `  // [STEP 2] 2D profile sketch on the XZ datum plane (${design.profileType})` },
    { step: 2, text: '  const profile2D = sketch(xz, (s) => {' },
    { step: 2, text: '    const p0 = s.point(0, 0), p1 = s.point(Rb, 0);' },
    {
      step: 2,
      text: `    const pWaist = s.point(${waistRadius}, H * ${design.waistPos});`,
    },
    { step: 2, text: '    const p2 = s.point(Rt, H), p3 = s.point(0, H);' },
    {
      step: 2,
      text: `    return s.closedSpline([p0, p1, pWaist, p2, p3], { bulge: ${design.curvature} });`,
    },
    { step: 2, text: '  });' },
    { step: 0, text: '' },
    { step: 3, text: '  // [STEP 3] 360° axisymmetric solid revolution' },
    { step: 3, text: "  const solidBlank = revolve(profile2D, { axis: 'z', angle: 360 });" },
    { step: 0, text: '' },
    { step: 4, text: `  // [STEP 4] Hollow interior shell (${design.innerWallMode} inner bore)` },
    {
      step: 4,
      text: "  const openFaces = select(solidBlank).faces({ normal: ['+z', '-z'] });",
    },
    {
      step: 4,
      text: '  const hollowBody = shell(solidBlank, { thickness: -wallT, open: openFaces });',
    },
    { step: 0, text: '' },
    { step: 5, text: `  // [STEP 5] Single surface pattern feature (${design.patternType})` },
    {
      step: 5,
      text: `  const guideHelix = helix({ height: H, twistDeg: ${design.twistAngle}, pitchFreq: ${design.verticalFreq} });`,
    },
    {
      step: 5,
      text: `  const singleRib  = sweep(sketch(xy).ribProfile({ depth: ${design.patternDepth.toFixed(1)}, sharpness: ${design.sharpness} }), guideHelix);`,
    },
    { step: 0, text: '' },
    { step: 6, text: `  // [STEP 6] 360° circular pattern array (${design.radialFreq} instances)` },
    {
      step: 6,
      text: `  const allOverPattern = repeat(singleRib, { mode: 'circular', axis: 'z', count: ${design.radialFreq} });`,
    },
    {
      step: 6,
      text: `  const patternedShade = union(hollowBody, allOverPattern, { rimMargin: ${design.rimBorder} });`,
    },
    { step: 0, text: '' },
    {
      step: 7,
      text: `  // [STEP 7] Integrated socket fitter (${design.fitterType}, Ø${design.socketDiameter}mm)`,
    },
    {
      step: 7,
      text: `  const socketHub = cylinder({ d: ${design.socketDiameter + design.socketRingWidth * 2}, h: ${design.spokeThickness} }).pipe(hole({ d: ${design.socketDiameter} }));`,
    },
    {
      step: 7,
      text: `  const spiderSpokes = repeat(sketch(xy).rect(${design.bottomRadius}, ${design.spokeWidth}).extrude(${design.spokeThickness}), { count: ${design.spokeCount} });`,
    },
    { step: 7, text: '  const completeSolid = union(patternedShade, socketHub, spiderSpokes);' },
    { step: 0, text: '' },
    { step: 8, text: '  // [STEP 8] Manifold check & binary STL export' },
    { step: 8, text: "  return exportStl(completeSolid, { binary: true, units: 'mm' });" },
    { step: 0, text: '});' },
  ]

  return lines
}
