import { Schema } from 'effect'
import { Agent } from 'foldkit-agent'

import { Message as MessageUnion, type Message } from '../foldkit/messages'
import type { Model } from '../state'

const LuminaAgent = Agent.forModel<Model>()

export const designResource = LuminaAgent.resource('design', {
  description:
    'The current LuminaCAD lamp shade design: profile, surface pattern, and socket fitter parameters.',
  schema: Schema.Struct({
    profileType: Schema.String,
    height: Schema.Number,
    bottomRadius: Schema.Number,
    topRadius: Schema.Number,
    wallThickness: Schema.Number,
    curvature: Schema.Number,
    waistPos: Schema.Number,
    patternType: Schema.String,
    radialFreq: Schema.Number,
    verticalFreq: Schema.Number,
    patternDepth: Schema.Number,
    twistAngle: Schema.Number,
    sharpness: Schema.Number,
    rimBorder: Schema.Number,
    innerWallMode: Schema.String,
    fitterType: Schema.String,
    socketDiameter: Schema.Number,
    spokeCount: Schema.Number,
    activeStep: Schema.Number,
    presetName: Schema.String,
  }),
  read: (model) => ({
    profileType: model.profileType,
    height: model.height,
    bottomRadius: model.bottomRadius,
    topRadius: model.topRadius,
    wallThickness: model.wallThickness,
    curvature: model.curvature,
    waistPos: model.waistPos,
    patternType: model.patternType,
    radialFreq: model.radialFreq,
    verticalFreq: model.verticalFreq,
    patternDepth: model.patternDepth,
    twistAngle: model.twistAngle,
    sharpness: model.sharpness,
    rimBorder: model.rimBorder,
    innerWallMode: model.innerWallMode,
    fitterType: model.fitterType,
    socketDiameter: model.socketDiameter,
    spokeCount: model.spokeCount,
    activeStep: model.activeStep,
    presetName: model.presetName,
  }),
})

export const contract = LuminaAgent.make({
  resources: [designResource],
  messages: LuminaAgent.expose(MessageUnion, {
    SelectedStep: {
      name: 'select_step',
      description:
        'Move the construction pipeline to a step between 1 (param) and 8 (manifold STL export).',
    },
    SteppedNext: {
      name: 'step_next',
      description: 'Advance the construction pipeline by one step.',
    },
    SteppedPrev: {
      name: 'step_previous',
      description: 'Rewind the construction pipeline by one step.',
    },
    UpdatedParam: {
      name: 'update_param',
      description:
        'Set one parametric design value, such as height, wall thickness, radial frequency, or twist angle.',
    },
    AppliedPreset: {
      name: 'apply_preset',
      description:
        'Load a curated design template by its id, such as nordic_fluted or cyberpunk_hex.',
    },
    RandomizedDesign: {
      name: 'randomize_design',
      description:
        'Generate a randomized but valid lamp shade design across profile, pattern, and proportions.',
    },
    ToggledBulb: {
      name: 'toggle_bulb',
      description: 'Toggle the internal bulb lighting in the 3D viewport.',
    },
    ToggledCutaway: {
      name: 'toggle_cutaway',
      description: 'Toggle the cross-section cutaway in the 3D viewport.',
    },
    ToggledWireframe: {
      name: 'toggle_wireframe',
      description: 'Toggle the wireframe overlay in the 3D viewport.',
    },
    ToggledDatumHelpers: {
      name: 'toggle_cad_helpers',
      description:
        'Toggle the CAD sketch and datum overlays (profile curve, revolution axis, helix guide).',
    },
    RequestedStlExport: {
      name: 'export_stl',
      description:
        'Export the current design as a watertight binary STL in millimeters.',
    },
    RequestedStepExport: {
      name: 'export_step',
      description: 'Export the current design as a STEP script.',
    },
    SwitchedTab: {
      name: 'switch_tab',
      description:
        'Switch the inspector panel between params, nodes, section, code, tea, and stylex.',
    },
    AppliedTheme: {
      name: 'apply_theme',
      description: 'Apply one of the atomic CSS themes to the studio.',
    },
  }),
})

export type LuminaContract = typeof contract
export type { Message }
