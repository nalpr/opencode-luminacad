import { Schema } from 'effect'
import { defineMessageUnion } from 'foldkit/message'

import { FitterType, InnerWallMode, MainTab, PatternType, ProfileType, ThemeName } from '../state'

export const Message = defineMessageUnion({
  SelectedStep: { step: Schema.Number },
  SteppedPrev: {},
  SteppedNext: {},
  ToggledStepPlayback: {},

  UpdatedParam: {
    key: Schema.String,
    value: Schema.Union([Schema.Number, Schema.String, Schema.Boolean]),
  },
  AppliedPreset: { presetId: Schema.String },
  RandomizedDesign: {},

  ToggledBulb: {},
  ToggledDatumHelpers: {},
  ToggledWireframe: {},
  ToggledCutaway: {},
  ResetCamera: {},

  SwitchedTab: { tab: MainTab },
  SelectedNode: { nodeId: Schema.String },
  AppliedTheme: {
    name: ThemeName,
    accentHex: Schema.String,
    filamentHex: Schema.String,
  },

  RequestedStlExport: {},
  CompletedStlExport: { fileName: Schema.String, triangles: Schema.Number },
  FailedStlExport: { reason: Schema.String },

  RequestedStepExport: {},

  RestoredRevision: { index: Schema.Number },
  DismissedToast: {},

  SucceededMountViewport: {},
  FailedMountViewport: { reason: Schema.String },
  CompletedSyncViewport: {},
})
export type Message = typeof Message.Type

export const PARAM_KEYS = [
  'height',
  'bottomRadius',
  'topRadius',
  'wallThickness',
  'curvature',
  'waistPos',
  'socketDiameter',
  'socketRingWidth',
  'spokeCount',
  'spokeThickness',
  'spokeWidth',
  'radialFreq',
  'verticalFreq',
  'patternDepth',
  'twistAngle',
  'sharpness',
  'rimBorder',
  'bulbIntensity',
  'bulbKelvin',
  'radialSegs',
  'heightSegs',
] as const

export const ENUM_PARAM_KEYS = [
  'profileType',
  'patternType',
  'fitterType',
  'innerWallMode',
] as const

export type NumericParamKey = (typeof PARAM_KEYS)[number]
export type EnumParamKey = (typeof ENUM_PARAM_KEYS)[number]

export const isNumericParamKey = (key: string): key is NumericParamKey =>
  (PARAM_KEYS as ReadonlyArray<string>).includes(key)

export const isEnumParamKey = (key: string): key is EnumParamKey =>
  (ENUM_PARAM_KEYS as ReadonlyArray<string>).includes(key)

export const PROFILE_TYPES: ReadonlyArray<ProfileType> = [
  'bulbous',
  'cylinder',
  'hourglass',
  'bell',
  'organic',
  'pagoda',
]

export const PATTERN_TYPES: ReadonlyArray<PatternType> = [
  'flutes',
  'diamond',
  'waves',
  'cellular',
  'lattice',
  'moire',
  'origami',
]

export const FITTER_TYPES: ReadonlyArray<FitterType> = [
  'bottom_ring',
  'top_spider',
  'solid_base',
  'none',
]

export const INNER_WALL_MODES: ReadonlyArray<InnerWallMode> = ['smooth', 'follow']
