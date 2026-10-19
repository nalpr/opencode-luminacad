import { Effect, Schema } from 'effect'
import { Command, Update } from 'foldkit'
import { modifyFields } from 'foldkit/struct'

import { Message as MessageUnion, type Message } from './messages'
import {
  isEnumParamKey,
  isNumericParamKey,
  type EnumParamKey,
  type NumericParamKey,
} from './messages'
import {
  Model,
  designOf,
  initialModel,
  type DesignParams,
  type HistoryEntry,
} from '../state'
import { PRESETS } from '../components/PresetLibrary'
import { exportBinaryStl, exportStepScript } from '../cad/exporters'
import { getViewportHandle } from '../components/Viewport3D'

export const HISTORY_LIMIT = 40

const STEP_LABELS = [
  'param() & datum init',
  'sketch(xz) profile',
  'revolve(profile, z, 360)',
  'shell(wallThickness)',
  'helix() + sweep()',
  'repeat(feature, Nr)',
  'socket fitter + spokes',
  'manifold STL export',
] as const

export const stepLabel = (step: number): string =>
  STEP_LABELS[Math.min(Math.max(step, 1), 8) - 1] ?? 'unknown'

export const summarize = (message: Message): string => {
  switch (message._tag) {
    case 'SelectedStep':
      return `Step ${message.step}: ${stepLabel(message.step)}`
    case 'SteppedPrev':
      return 'Rewound one construction step'
    case 'SteppedNext':
      return 'Advanced one construction step'
    case 'ToggledStepPlayback':
      return 'Toggled the 8-stage auto walkthrough'
    case 'UpdatedParam':
      return `${message.key} = ${String(message.value)}`
    case 'AppliedPreset':
      return `Loaded template "${message.presetId}"`
    case 'RandomizedDesign':
      return 'Generated a randomized design'
    case 'ToggledBulb':
      return 'Toggled the internal bulb'
    case 'ToggledDatumHelpers':
      return 'Toggled the CAD sketch helpers'
    case 'ToggledWireframe':
      return 'Toggled the wireframe overlay'
    case 'ToggledCutaway':
      return 'Toggled the section cutaway'
    case 'ResetCamera':
      return 'Reset the camera'
    case 'SwitchedTab':
      return `Switched to the ${message.tab} panel`
    case 'SelectedNode':
      return `Selected node ${message.nodeId}`
    case 'AppliedTheme':
      return `Applied the ${message.name} theme`
    case 'RequestedStlExport':
      return 'Requested a manifold binary STL'
    case 'CompletedStlExport':
      return `Wrote ${message.fileName} (${message.triangles} triangles)`
    case 'FailedStlExport':
      return `STL export failed: ${message.reason}`
    case 'RequestedStepExport':
      return 'Requested a STEP script'
    case 'RestoredRevision':
      return `Time-travelled to revision ${message.index}`
    case 'CompletedSyncViewport':
      return 'Synced the Three.js viewport'
    case 'DismissedToast':
      return 'Dismissed the toast'
    case 'SucceededMountViewport':
      return 'Mounted the Three.js viewport'
    case 'FailedMountViewport':
      return `Viewport mount failed: ${message.reason}`
  }
}

/**
 * Messages that are internal acknowledgments rather than user intent. They
 * drive the Model but never earn a revision or a history entry, so the Foldkit
 * TEA panel reads as a log of what the user did rather than a log of every
 * internal round trip.
 */
const INTERNAL_MESSAGES: ReadonlySet<string> = new Set([
  'CompletedSyncViewport',
  'SucceededMountViewport',
])

const historyEntry = (
  revision: number,
  message: Message,
  design: DesignParams,
): HistoryEntry => ({
  revision,
  tag: message._tag,
  summary: summarize(message),
  design,
})

const appendHistory = (
  model: Model,
  message: Message,
  design: DesignParams,
): ReadonlyArray<HistoryEntry> =>
  [
    historyEntry(model.revision + 1, message, design),
    ...model.history,
  ].slice(0, HISTORY_LIMIT)

export const buildRandomDesign = (): DesignParams => {
  const profiles = [
    'cylinder',
    'hourglass',
    'bulbous',
    'bell',
    'organic',
    'pagoda',
  ] as const
  const patterns = [
    'flutes',
    'diamond',
    'waves',
    'cellular',
    'lattice',
    'moire',
    'origami',
  ] as const
  const profileType = profiles[Math.floor(Math.random() * profiles.length)]
  const patternType = patterns[Math.floor(Math.random() * patterns.length)]
  const base = PRESETS[0]
  return {
    ...base.params,
    profileType,
    patternType,
    height: Math.round(140 + Math.random() * 110),
    bottomRadius: Math.round(50 + Math.random() * 38),
    topRadius: Math.round(42 + Math.random() * 42),
    curvature: Number((-0.3 + Math.random() * 0.9).toFixed(2)),
    radialFreq: Math.round(12 + Math.random() * 34),
    verticalFreq: Math.round(6 + Math.random() * 18),
    patternDepth: Number((2.5 + Math.random() * 5).toFixed(1)),
    twistAngle: Math.round(((-180 + Math.random() * 360) / 15) * 15),
  }
}

export const ExportBinaryStl = Command.define('ExportBinaryStl', {
  args: {
    design: Schema.Unknown,
    presetName: Schema.String,
    radialSegments: Schema.Number,
    heightSegments: Schema.Number,
  },
  messages: [MessageUnion.CompletedStlExport, MessageUnion.FailedStlExport],
  execute: ({ design, presetName, radialSegments, heightSegments }) =>
    Effect.try({
      try: () =>
        exportBinaryStl({
          design: design as DesignParams,
          presetName,
          radialSegments,
          heightSegments,
        }),
      catch: (error) =>
        MessageUnion.FailedStlExport({
          reason: error instanceof Error ? error.message : String(error),
        }),
    }).pipe(
      Effect.map((result) =>
        MessageUnion.CompletedStlExport({
          fileName: result.fileName,
          triangles: result.triangles,
        }),
      ),
      Effect.catch((failure) => Effect.succeed(failure)),
    ),
})

export const ExportStepScript = Command.define('ExportStepScript', {
  args: {
    design: Schema.Unknown,
    presetName: Schema.String,
    radialSegments: Schema.Number,
    heightSegments: Schema.Number,
  },
  messages: [MessageUnion.CompletedStlExport, MessageUnion.FailedStlExport],
  execute: ({ design, presetName, radialSegments, heightSegments }) =>
    Effect.try({
      try: () =>
        exportStepScript({
          design: design as DesignParams,
          presetName,
          radialSegments,
          heightSegments,
        }),
      catch: (error) =>
        MessageUnion.FailedStlExport({
          reason: error instanceof Error ? error.message : String(error),
        }),
    }).pipe(
      Effect.map((result) =>
        MessageUnion.CompletedStlExport({
          fileName: result.fileName,
          triangles: result.triangles,
        }),
      ),
      Effect.catch((failure) => Effect.succeed(failure)),
    ),
})

export const SyncViewport = Command.define('SyncViewport', {
  args: {
    design: Schema.Unknown,
    activeStep: Schema.Number,
    radialSegments: Schema.Number,
    heightSegments: Schema.Number,
    bulbOn: Schema.Boolean,
    bulbIntensity: Schema.Number,
    filamentColor: Schema.String,
    wireframe: Schema.Boolean,
    cutaway: Schema.Boolean,
    showDatumHelpers: Schema.Boolean,
    resetCamera: Schema.Boolean,
  },
  messages: [MessageUnion.CompletedSyncViewport],
  execute: ({
    design,
    activeStep,
    radialSegments,
    heightSegments,
    bulbOn,
    bulbIntensity,
    filamentColor,
    wireframe,
    cutaway,
    showDatumHelpers,
    resetCamera,
  }) =>
    Effect.sync(() => {
      const container = document.getElementById('viewport-container')
      if (container) {
        const handle = getViewportHandle(container)
        handle?.update({
          design: design as DesignParams,
          activeStep,
          radialSegments,
          heightSegments,
          bulbOn,
          bulbIntensity,
          filamentColor,
          wireframe,
          cutaway,
          showDatumHelpers,
        })
        if (resetCamera) handle?.resetCamera()
      }
      return MessageUnion.CompletedSyncViewport()
    }),
})

export const init = (): Update.Return<Model, Message> => ({
  model: initialModel,
})

const setNumericParam = (model: Model, key: NumericParamKey, value: number): Model =>
  modifyFields(model, {
    [key]: () => value,
  } as { [K in NumericParamKey]: () => number })

const setEnumParam = (model: Model, key: EnumParamKey, value: string): Model =>
  modifyFields(model, {
    [key]: () => value,
  } as unknown as { [K in EnumParamKey]: () => never })

const reduce = (
  model: Model,
  message: Message,
): Update.Return<Model, Message> =>
  MessageUnion.match<Update.Return<Model, Message>>(message, {
    SelectedStep: ({ step }) => ({
      model: modifyFields(model, {
        activeStep: () => Math.max(1, Math.min(8, step)),
      }),
    }),

    SteppedPrev: () => ({
      model: modifyFields(model, {
        activeStep: () => (model.activeStep > 1 ? model.activeStep - 1 : 8),
      }),
    }),

    SteppedNext: () => ({
      model: modifyFields(model, {
        activeStep: () => (model.activeStep < 8 ? model.activeStep + 1 : 1),
      }),
    }),

    ToggledStepPlayback: () => ({
      model: modifyFields(model, {
        isPlayingSteps: () => !model.isPlayingSteps,
        activeStep: () => (model.isPlayingSteps ? 1 : model.activeStep),
      }),
    }),

    UpdatedParam: ({ key, value }) => {
      if (isNumericParamKey(key)) {
        return { model: setNumericParam(model, key, Number(value)) }
      }
      if (isEnumParamKey(key)) {
        return { model: setEnumParam(model, key, String(value)) }
      }
      return { model }
    },

    AppliedPreset: ({ presetId }) => {
      const preset = PRESETS.find((candidate) => candidate.id === presetId)
      if (!preset) return { model }
      return {
        model: modifyFields(model, {
          presetId: () => preset.id,
          presetName: () => preset.name,
          profileType: () => preset.params.profileType,
          height: () => preset.params.height,
          bottomRadius: () => preset.params.bottomRadius,
          topRadius: () => preset.params.topRadius,
          wallThickness: () => preset.params.wallThickness,
          curvature: () => preset.params.curvature,
          waistPos: () => preset.params.waistPos,
          fitterType: () => preset.params.fitterType,
          socketDiameter: () => preset.params.socketDiameter,
          spokeCount: () => preset.params.spokeCount,
          patternType: () => preset.params.patternType,
          radialFreq: () => preset.params.radialFreq,
          verticalFreq: () => preset.params.verticalFreq,
          patternDepth: () => preset.params.patternDepth,
          twistAngle: () => preset.params.twistAngle,
          sharpness: () => preset.params.sharpness,
          rimBorder: () => preset.params.rimBorder,
          innerWallMode: () => preset.params.innerWallMode,
        }),
      }
    },

    RandomizedDesign: () => {
      const design = buildRandomDesign()
      return {
        model: modifyFields(model, {
          presetId: () => 'generative',
          presetName: () => 'Generative Seed',
          profileType: () => design.profileType,
          height: () => design.height,
          bottomRadius: () => design.bottomRadius,
          topRadius: () => design.topRadius,
          wallThickness: () => design.wallThickness,
          curvature: () => design.curvature,
          waistPos: () => design.waistPos,
          fitterType: () => design.fitterType,
          socketDiameter: () => design.socketDiameter,
          spokeCount: () => design.spokeCount,
          patternType: () => design.patternType,
          radialFreq: () => design.radialFreq,
          verticalFreq: () => design.verticalFreq,
          patternDepth: () => design.patternDepth,
          twistAngle: () => design.twistAngle,
          sharpness: () => design.sharpness,
          rimBorder: () => design.rimBorder,
          innerWallMode: () => design.innerWallMode,
        }),
      }
    },

    ToggledBulb: () => ({
      model: modifyFields(model, { bulbOn: () => !model.bulbOn }),
    }),

    ToggledDatumHelpers: () => ({
      model: modifyFields(model, {
        showDatumHelpers: () => !model.showDatumHelpers,
      }),
    }),

    ToggledWireframe: () => ({
      model: modifyFields(model, { wireframe: () => !model.wireframe }),
    }),

    ToggledCutaway: () => ({
      model: modifyFields(model, { cutaway: () => !model.cutaway }),
    }),

    ResetCamera: () => ({ model }),

    SwitchedTab: ({ tab }) => ({
      model: modifyFields(model, { mainTab: () => tab }),
    }),

    SelectedNode: ({ nodeId }) => ({
      model: modifyFields(model, { selectedNodeId: () => nodeId }),
    }),

    AppliedTheme: ({ name, accentHex, filamentHex }) => ({
      model: modifyFields(model, {
        themeName: () => name,
        accentHex: () => accentHex,
        filamentHex: () => filamentHex,
        filamentColor: () => filamentHex,
      }),
    }),

    RequestedStlExport: () => ({
      model,
      commands: [
        ExportBinaryStl({
          design: designOf(model),
          presetName: model.presetName,
          radialSegments: model.radialSegs,
          heightSegments: model.heightSegs,
        }),
      ],
    }),

    CompletedStlExport: ({ fileName, triangles }) => ({
      model: modifyFields(model, {
        showToast: () => true,
        toastMessage: () =>
          triangles > 0
            ? `Exported ${fileName} (${triangles.toLocaleString()} triangles)`
            : `Wrote ${fileName}`,
      }),
    }),

    FailedStlExport: ({ reason }) => ({
      model: modifyFields(model, {
        showToast: () => true,
        toastMessage: () => `Export failed: ${reason}`,
      }),
    }),

    RequestedStepExport: () => ({
      model,
      commands: [
        ExportStepScript({
          design: designOf(model),
          presetName: model.presetName,
          radialSegments: model.radialSegs,
          heightSegments: model.heightSegs,
        }),
      ],
    }),

    RestoredRevision: ({ index }) => {
      const entry = model.history.find((candidate) => candidate.revision === index)
      if (!entry) return { model }
      return {
        model: modifyFields(model, {
          profileType: () => entry.design.profileType,
          height: () => entry.design.height,
          bottomRadius: () => entry.design.bottomRadius,
          topRadius: () => entry.design.topRadius,
          wallThickness: () => entry.design.wallThickness,
          curvature: () => entry.design.curvature,
          waistPos: () => entry.design.waistPos,
          fitterType: () => entry.design.fitterType,
          socketDiameter: () => entry.design.socketDiameter,
          socketRingWidth: () => entry.design.socketRingWidth,
          spokeCount: () => entry.design.spokeCount,
          spokeThickness: () => entry.design.spokeThickness,
          spokeWidth: () => entry.design.spokeWidth,
          patternType: () => entry.design.patternType,
          radialFreq: () => entry.design.radialFreq,
          verticalFreq: () => entry.design.verticalFreq,
          patternDepth: () => entry.design.patternDepth,
          twistAngle: () => entry.design.twistAngle,
          sharpness: () => entry.design.sharpness,
          rimBorder: () => entry.design.rimBorder,
          innerWallMode: () => entry.design.innerWallMode,
        }),
      }
    },

    DismissedToast: () => ({
      model: modifyFields(model, {
        showToast: () => false,
        toastMessage: () => '',
      }),
    }),

    SucceededMountViewport: () => ({ model }),

    CompletedSyncViewport: () => ({ model }),

    FailedMountViewport: ({ reason }) => ({
      model: modifyFields(model, {
        showToast: () => true,
        toastMessage: () => `Viewport failed: ${reason}`,
      }),
    }),
  })

/**
 * The slice of the Model the Three.js viewport renders. When it changes, the
 * update dispatches the `SyncViewport` Command; when it does not, the live
 * scene is already correct and the Command is skipped.
 */
const viewportSignature = (model: Model): string =>
  JSON.stringify([
    designOf(model),
    model.activeStep,
    model.radialSegs,
    model.heightSegs,
    model.bulbOn,
    model.bulbIntensity,
    model.filamentColor,
    model.wireframe,
    model.cutaway,
    model.showDatumHelpers,
  ])

export const update = (model: Model, message: Message): Update.Return<Model, Message> => {
  const reduced = reduce(model, message)
  const isInternal = INTERNAL_MESSAGES.has(message._tag)
  const next = isInternal
    ? reduced.model
    : modifyFields(reduced.model, {
        revision: () => reduced.model.revision + 1,
        history: () =>
          appendHistory(model, message, designOf(reduced.model)),
      })

  const resetCamera = message._tag === 'ResetCamera'
  const viewportChanged = viewportSignature(model) !== viewportSignature(next)

  if (!viewportChanged && !resetCamera) {
    return reduced.commands === undefined
      ? { model: next }
      : { model: next, commands: reduced.commands }
  }

  return {
    model: next,
    commands: [
      ...(reduced.commands ?? []),
      SyncViewport({
        design: designOf(next),
        activeStep: next.activeStep,
        radialSegments: next.radialSegs,
        heightSegments: next.heightSegs,
        bulbOn: next.bulbOn,
        bulbIntensity: next.bulbIntensity,
        filamentColor: next.filamentColor,
        wireframe: next.wireframe,
        cutaway: next.cutaway,
        showDatumHelpers: next.showDatumHelpers,
        resetCamera,
      }),
    ],
  }
}
