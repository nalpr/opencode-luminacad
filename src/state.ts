import { Schema } from 'effect'

export const ProfileType = Schema.Literals([
  'bulbous',
  'cylinder',
  'hourglass',
  'bell',
  'organic',
  'pagoda',
])
export type ProfileType = typeof ProfileType.Type

export const PatternType = Schema.Literals([
  'flutes',
  'diamond',
  'waves',
  'cellular',
  'lattice',
  'moire',
  'origami',
])
export type PatternType = typeof PatternType.Type

export const FitterType = Schema.Literals([
  'bottom_ring',
  'top_spider',
  'solid_base',
  'none',
])
export type FitterType = typeof FitterType.Type

export const InnerWallMode = Schema.Literals(['smooth', 'follow'])
export type InnerWallMode = typeof InnerWallMode.Type

export const MainTab = Schema.Literals([
  'params',
  'nodes',
  'section',
  'code',
  'tea',
  'stylex',
])
export type MainTab = typeof MainTab.Type

export const ThemeName = Schema.Literals([
  'Solar Amber',
  'CAD Cyan',
  'Laser Rose',
  'Phosphor Green',
])
export type ThemeName = typeof ThemeName.Type

export const DesignParams = Schema.Struct({
  profileType: ProfileType,
  height: Schema.Number,
  bottomRadius: Schema.Number,
  topRadius: Schema.Number,
  wallThickness: Schema.Number,
  curvature: Schema.Number,
  waistPos: Schema.Number,

  fitterType: FitterType,
  socketDiameter: Schema.Number,
  socketRingWidth: Schema.Number,
  spokeCount: Schema.Number,
  spokeThickness: Schema.Number,
  spokeWidth: Schema.Number,

  patternType: PatternType,
  radialFreq: Schema.Number,
  verticalFreq: Schema.Number,
  patternDepth: Schema.Number,
  twistAngle: Schema.Number,
  sharpness: Schema.Number,
  rimBorder: Schema.Number,
  innerWallMode: InnerWallMode,
})
export type DesignParams = typeof DesignParams.Type

export const HistoryEntry = Schema.Struct({
  revision: Schema.Number,
  tag: Schema.String,
  summary: Schema.String,
  design: DesignParams,
})
export type HistoryEntry = typeof HistoryEntry.Type

export const Model = Schema.Struct({
  revision: Schema.Number,
  activeStep: Schema.Number,
  isPlayingSteps: Schema.Boolean,
  presetId: Schema.String,
  presetName: Schema.String,

  profileType: ProfileType,
  height: Schema.Number,
  bottomRadius: Schema.Number,
  topRadius: Schema.Number,
  wallThickness: Schema.Number,
  curvature: Schema.Number,
  waistPos: Schema.Number,

  fitterType: FitterType,
  socketDiameter: Schema.Number,
  socketRingWidth: Schema.Number,
  spokeCount: Schema.Number,
  spokeThickness: Schema.Number,
  spokeWidth: Schema.Number,

  patternType: PatternType,
  radialFreq: Schema.Number,
  verticalFreq: Schema.Number,
  patternDepth: Schema.Number,
  twistAngle: Schema.Number,
  sharpness: Schema.Number,
  rimBorder: Schema.Number,
  innerWallMode: InnerWallMode,

  bulbOn: Schema.Boolean,
  bulbIntensity: Schema.Number,
  bulbKelvin: Schema.Number,
  filamentColor: Schema.String,
  wireframe: Schema.Boolean,
  cutaway: Schema.Boolean,
  showDatumHelpers: Schema.Boolean,
  radialSegs: Schema.Number,
  heightSegs: Schema.Number,

  mainTab: MainTab,
  themeName: ThemeName,
  accentHex: Schema.String,
  filamentHex: Schema.String,
  showToast: Schema.Boolean,
  toastMessage: Schema.String,
  selectedNodeId: Schema.String,

  history: Schema.Array(HistoryEntry),
})
export type Model = typeof Model.Type

export const initialModel: Model = {
  revision: 1,
  activeStep: 8,
  isPlayingSteps: false,
  presetId: 'helical_flutes',
  presetName: 'Helical Flutes',

  profileType: 'bulbous',
  height: 200,
  bottomRadius: 70,
  topRadius: 55,
  wallThickness: 1.8,
  curvature: 0.35,
  waistPos: 0.45,

  fitterType: 'bottom_ring',
  socketDiameter: 40.5,
  socketRingWidth: 7.0,
  spokeCount: 4,
  spokeThickness: 5.5,
  spokeWidth: 6.5,

  patternType: 'flutes',
  radialFreq: 28,
  verticalFreq: 10,
  patternDepth: 4.5,
  twistAngle: 120,
  sharpness: 1.4,
  rimBorder: 8,
  innerWallMode: 'smooth',

  bulbOn: true,
  bulbIntensity: 1.6,
  bulbKelvin: 2700,
  filamentColor: '#fff8eb',
  wireframe: false,
  cutaway: false,
  showDatumHelpers: true,
  radialSegs: 168,
  heightSegs: 112,

  mainTab: 'params',
  themeName: 'Solar Amber',
  accentHex: '#f59e0b',
  filamentHex: '#fff8eb',
  showToast: false,
  toastMessage: '',
  selectedNodeId: 'export',

  history: [],
}

export const designOf = (model: Model): DesignParams => ({
  profileType: model.profileType,
  height: model.height,
  bottomRadius: model.bottomRadius,
  topRadius: model.topRadius,
  wallThickness: model.wallThickness,
  curvature: model.curvature,
  waistPos: model.waistPos,
  fitterType: model.fitterType,
  socketDiameter: model.socketDiameter,
  socketRingWidth: model.socketRingWidth,
  spokeCount: model.spokeCount,
  spokeThickness: model.spokeThickness,
  spokeWidth: model.spokeWidth,
  patternType: model.patternType,
  radialFreq: model.radialFreq,
  verticalFreq: model.verticalFreq,
  patternDepth: model.patternDepth,
  twistAngle: model.twistAngle,
  sharpness: model.sharpness,
  rimBorder: model.rimBorder,
  innerWallMode: model.innerWallMode,
})
