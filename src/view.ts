import { Effect, Schedule, Schema, Stream } from 'effect'
import { Subscription } from 'foldkit'
import { createKeyedLazy, createLazy } from 'foldkit/html'
import type { Document, Html, HtmlBuilder } from 'foldkit/html'

import { Message as MessageUnion, type Message } from './foldkit/messages'
import { stepLabel } from './foldkit/engine'
import type { Model } from './state'
import { designOf } from './state'
import { auditPrintability } from './cad/constraints'
import { generateFluidCadScript } from './cad/fluidcad'
import { PRESETS } from './components/PresetLibrary'
import { MountViewport } from './components/Viewport3D'
import { nodeBuilderView } from './components/NodeBuilder'
import { sectionViewerView } from './components/SectionViewer'
import { className } from './style/className'
import { styles } from './style/styles'

const STEPS = [
  { step: 1, title: 'param() & datum init', op: 'part() + param()' },
  { step: 2, title: 'sketch(xz) profile', op: 'sketch("xz").spline()' },
  { step: 3, title: 'revolve(profile, z)', op: 'revolve(profile, "z", 360)' },
  { step: 4, title: 'shell(wallThickness)', op: 'shell(body, wallT, [top, bot])' },
  { step: 5, title: 'helix() + sweep()', op: 'sweep(ribSection, helixPath)' },
  { step: 6, title: 'repeat(feature, Nr)', op: 'repeat(feature, { count: Nr })' },
  { step: 7, title: 'socket fitter + spokes', op: 'union(hubRing, repeat(spoke))' },
  { step: 8, title: 'manifold STL export', op: 'exportStl({ binary: true })' },
] as const

const TAB_LABELS = {
  params: 'CAD Params',
  nodes: 'Node Graph',
  section: 'Section',
  code: 'FluidCAD',
  tea: 'Foldkit TEA',
  stylex: 'StyleX',
} as const

type Tab = keyof typeof TAB_LABELS

export const subscriptions = Subscription.make<Model, Message>()((entry) => ({
  stepPlayback: entry(
    { isPlayingSteps: Schema.Boolean },
    {
      modelToDependencies: (model) => ({ isPlayingSteps: model.isPlayingSteps }),
      dependenciesToStream: ({ isPlayingSteps }) =>
        isPlayingSteps
          ? Stream.make(MessageUnion.SteppedNext()).pipe(
              Stream.repeat(Schedule.spaced('1.9 seconds')),
            )
          : Stream.empty,
    },
  ),
}))

// MEMOIZED SUBTREES
//
// The inspector panels and the revision log are large, and rebuilding them on
// every patch dominates the frame budget. A lazy slot caches the VNode and
// reuses it when the function reference and the arguments are unchanged, so
// only the panels whose data actually moved are rebuilt.

const renderCodeLine = createKeyedLazy()
const renderHistoryRow = createKeyedLazy()
const renderStepPill = createKeyedLazy()
const renderPresetCard = createKeyedLazy()
const renderTelemetry = createLazy()

const codeLineView = (
  text: string,
  isActive: boolean,
  h: HtmlBuilder<Message>,
): Html =>
  h.div(
    [
      h.Class(
        className(
          styles.codeLine,
          isActive && styles.codeLineActive,
        ),
      ),
    ],
    [
      h.span([h.Class(className(styles.codeGutter))], [
        text.length === 0 ? ' ' : text,
      ]),
    ],
  )

const historyRowView = (
  revision: number,
  tag: string,
  summary: string,
  isCurrent: boolean,
  h: HtmlBuilder<Message>,
): Html =>
  h.button(
    [
      h.Class(
        className(
          styles.historyRow,
          isCurrent && styles.historyRowCurrent,
        ),
      ),
      h.OnClick(MessageUnion.RestoredRevision({ index: revision })),
    ],
    [
      h.div([h.Class(className(styles.truncated))], [
        h.span([h.Class(className(styles.historyRevision))], [`#${revision}`]),
        h.span([h.Class(className(styles.historyTag))], [tag]),
        h.span([h.Class(className(styles.historySummary))], [summary]),
      ]),
    ],
  )

const stepPillView = (
  step: number,
  title: string,
  isCurrent: boolean,
  isDone: boolean,
  h: HtmlBuilder<Message>,
): Html =>
  h.button(
    [
      h.Class(
        className(
          styles.stepPill,
          isCurrent && styles.stepPillCurrent,
          isDone && styles.stepPillDone,
        ),
      ),
      h.OnClick(MessageUnion.SelectedStep({ step })),
    ],
    [
      h.span(
        [
          h.Class(
            className(
              styles.stepDotCurrent,
              !isCurrent && styles.stepDotTodo,
              isDone && styles.stepDotDone,
            ),
          ),
        ],
        [],
      ),
      h.span([h.Class(className(styles.stepLabel))], [`${step}. ${title}`]),
    ],
  )

const presetCardView = (
  presetId: string,
  name: string,
  tag: string,
  isActive: boolean,
  h: HtmlBuilder<Message>,
): Html =>
  h.button(
    [
      h.Class(
        className(
          styles.presetCard,
          isActive && styles.presetCardActive,
        ),
      ),
      h.OnClick(MessageUnion.AppliedPreset({ presetId })),
    ],
    [
      h.div([h.Class(className(styles.presetName))], [name]),
      h.div([h.Class(className(styles.presetTag))], [tag]),
    ],
  )

const telemetryView = (
  bounds: string,
  relief: string,
  wall: string,
  buildVolume: string,
  h: HtmlBuilder<Message>,
): Html =>
  h.div(
    [h.Class(className(styles.telemetryRow))],
    [
      h.div(
        [h.Class(className(styles.telemetryItem))],
        [
          h.span([h.Class(className(styles.telemetryLabel))], ['B-Rep Bounds']),
          h.span([h.Class(className(styles.telemetryValuePrimary))], [bounds]),
        ],
      ),
      h.div(
        [h.Class(className(styles.telemetryItem))],
        [
          h.span([h.Class(className(styles.telemetryLabel))], ['Relief']),
          h.span([h.Class(className(styles.telemetryValueAccent))], [relief]),
        ],
      ),
      h.div(
        [h.Class(className(styles.telemetryItem))],
        [
          h.span([h.Class(className(styles.telemetryLabel))], ['Wall']),
          h.span([h.Class(className(styles.telemetryValueEmerald))], [wall]),
        ],
      ),
      h.div(
        [h.Class(className(styles.telemetryItem))],
        [
          h.span([h.Class(className(styles.telemetryLabel))], ['Build Vol']),
          h.span([h.Class(className(styles.telemetryValueViolet))], [buildVolume]),
        ],
      ),
    ],
  )

// VIEW HELPERS

const sliderRow = (
  label: string,
  key: string,
  min: number,
  max: number,
  step: number,
  value: number,
  display: string,
  h: HtmlBuilder<Message>,
): Html =>
  h.div([h.Class(className(styles.field))], [
    h.div([h.Class(className(styles.fieldHead))], [
      h.span([h.Class(className(styles.fieldLabel))], [label]),
      h.span([h.Class(className(styles.fieldValue))], [display]),
    ]),
    h.input([
      h.Type('range'),
      h.Min(String(min)),
      h.Max(String(max)),
      h.Step(String(step)),
      h.Value(String(value)),
      h.OnInput((input: string) =>
        MessageUnion.UpdatedParam({ key, value: Number(input) }),
      ),
    ]),
  ])

const selectRow = (
  label: string,
  key: string,
  options: ReadonlyArray<readonly [string, string]>,
  selected: string,
  h: HtmlBuilder<Message>,
): Html =>
  h.div([h.Class(className(styles.selectRow))], [
    h.span([h.Class(className(styles.selectLabel))], [label]),
    h.select(
      [
        h.Class(className(styles.select)),
        h.OnChange((value: string) => MessageUnion.UpdatedParam({ key, value })),
      ],
      options.map(([value, text]) =>
        h.option([h.Value(value), h.Selected(value === selected)], [text]),
      ),
    ),
  ])

const PROFILE_OPTIONS = [
  ['bulbous', 'spline: Bulbous Vase'],
  ['cylinder', 'line: Tapered Cone'],
  ['hourglass', 'bezier: Hourglass Waist'],
  ['bell', 'spline: Flared Bell'],
  ['organic', 'spline: Organic Wave'],
  ['pagoda', 'polyline: Stepped Pagoda'],
] as const

const PATTERN_OPTIONS = [
  ['flutes', 'sweep: Spiral Flutes'],
  ['diamond', 'wrap: Diamond Knurl'],
  ['waves', 'loft: Zen Wave Ripples'],
  ['cellular', 'emboss: Voronoi Dimples'],
  ['lattice', 'boolean: Twist Lattice'],
  ['moire', 'field: Moiré Interference'],
  ['origami', 'split: Origami Facets'],
] as const

const FITTER_OPTIONS = [
  ['bottom_ring', 'Bottom E27/E26 Ring'],
  ['top_spider', 'Top Pendant Spider'],
  ['solid_base', 'Solid LED Base'],
  ['none', 'Open Vase Mode'],
] as const

// PANELS

const paramsPanelView = (model: Model, h: HtmlBuilder<Message>): Html => {
  const design = designOf(model)
  return h.div(
    [h.Class(className(styles.panel))],
    [
      h.div(
        [h.Class(className(styles.headerRow))],
        [
          h.span(
            [h.Class(className(styles.faint, styles.mono, styles.small))],
            ['FluidCAD part templates'],
          ),
          h.button(
            [
              h.Class(className(styles.button, styles.buttonAccent)),
              h.OnClick(MessageUnion.RandomizedDesign()),
            ],
            ['⚡ Randomize'],
          ),
        ],
      ),
      h.div(
        [h.Class(className(styles.cardGrid))],
        PRESETS.map((preset) =>
          renderPresetCard(preset.id, presetCardView, [
            preset.id,
            preset.name,
            preset.tag,
            preset.id === model.presetId,
            h,
          ]),
        ),
      ),
      h.div(
        [h.Class(className(styles.section))],
        [
          h.div([h.Class(className(styles.sectionTitle, styles.sectionTitleCyan))], [
            h.span([h.Class(className(styles.sectionDot))], []),
            'Step 1–4: profile & shell',
          ]),
          selectRow('Profile type', 'profileType', PROFILE_OPTIONS, design.profileType, h),
          sliderRow('Height H', 'height', 70, 280, 1, design.height, `${design.height} mm`, h),
          sliderRow(
            'Shell wallT',
            'wallThickness',
            0.8,
            5,
            0.1,
            design.wallThickness,
            `${design.wallThickness.toFixed(1)} mm`,
            h,
          ),
          sliderRow(
            'Bottom radius Rb',
            'bottomRadius',
            25,
            120,
            1,
            design.bottomRadius,
            `${design.bottomRadius} mm`,
            h,
          ),
          sliderRow(
            'Top radius Rt',
            'topRadius',
            20,
            120,
            1,
            design.topRadius,
            `${design.topRadius} mm`,
            h,
          ),
          sliderRow(
            'Spline bulge C',
            'curvature',
            -0.7,
            0.95,
            0.02,
            design.curvature,
            design.curvature.toFixed(2),
            h,
          ),
          sliderRow(
            'Inflection waistZ',
            'waistPos',
            0.2,
            0.8,
            0.01,
            design.waistPos,
            `${Math.round(design.waistPos * 100)}%`,
            h,
          ),
        ],
      ),
      h.div(
        [h.Class(className(styles.section))],
        [
          h.div([h.Class(className(styles.sectionTitle, styles.sectionTitleAmber))], [
            h.span([h.Class(className(styles.sectionDot))], []),
            'Step 5–6: pattern & array',
          ]),
          selectRow('Pattern type', 'patternType', PATTERN_OPTIONS, design.patternType, h),
          sliderRow(
            'Radial array count',
            'radialFreq',
            4,
            72,
            1,
            design.radialFreq,
            `${design.radialFreq}`,
            h,
          ),
          sliderRow(
            'Vertical freq Nv',
            'verticalFreq',
            1,
            40,
            0.5,
            design.verticalFreq,
            `${design.verticalFreq}`,
            h,
          ),
          sliderRow(
            'Relief depth amp',
            'patternDepth',
            0,
            11,
            0.2,
            design.patternDepth,
            `${design.patternDepth.toFixed(1)} mm`,
            h,
          ),
          sliderRow(
            'Helix twist deg',
            'twistAngle',
            -360,
            360,
            5,
            design.twistAngle,
            `${design.twistAngle}°`,
            h,
          ),
          sliderRow(
            'Crease sharpness',
            'sharpness',
            0.4,
            3.2,
            0.1,
            design.sharpness,
            design.sharpness.toFixed(1),
            h,
          ),
          sliderRow(
            'Rim fillet margin',
            'rimBorder',
            0,
            30,
            1,
            design.rimBorder,
            `${design.rimBorder} mm`,
            h,
          ),
          h.div(
            [h.Class(className(styles.cardGrid))],
            [
              h.button(
                [
                  h.Class(
                    className(
                      styles.presetCard,
                      design.innerWallMode === 'smooth' && styles.presetCardActive,
                    ),
                  ),
                  h.OnClick(
                    MessageUnion.UpdatedParam({ key: 'innerWallMode', value: 'smooth' }),
                  ),
                ],
                [
                  h.div([h.Class(className(styles.presetName))], ['Smooth inner bore']),
                  h.div([h.Class(className(styles.faint, styles.small))], [
                    'Lithophane thickness glow',
                  ]),
                ],
              ),
              h.button(
                [
                  h.Class(
                    className(
                      styles.presetCard,
                      design.innerWallMode === 'follow' && styles.presetCardActive,
                    ),
                  ),
                  h.OnClick(
                    MessageUnion.UpdatedParam({ key: 'innerWallMode', value: 'follow' }),
                  ),
                ],
                [
                  h.div([h.Class(className(styles.presetName))], ['Uniform offset shell']),
                  h.div([h.Class(className(styles.faint, styles.small))], [
                    'Inner wall follows ribs',
                  ]),
                ],
              ),
            ],
          ),
        ],
      ),
      h.div(
        [h.Class(className(styles.section))],
        [
          h.div([h.Class(className(styles.sectionTitle, styles.sectionTitleEmerald))], [
            h.span([h.Class(className(styles.sectionDot))], []),
            'Step 7: socket fitter & spokes',
          ]),
          selectRow('Fitter type', 'fitterType', FITTER_OPTIONS, design.fitterType, h),
          sliderRow(
            'Socket hole Ø',
            'socketDiameter',
            20,
            80,
            0.5,
            design.socketDiameter,
            `${design.socketDiameter.toFixed(1)} mm`,
            h,
          ),
          sliderRow(
            'Spokes count',
            'spokeCount',
            3,
            8,
            1,
            design.spokeCount,
            `${design.spokeCount}`,
            h,
          ),
        ],
      ),
    ],
  )
}

const codePanelView = (model: Model, h: HtmlBuilder<Message>): Html => {
  const design = designOf(model)
  return h.div(
    [h.Class(className(styles.panel))],
    [
      h.div(
        [h.Class(className(styles.section))],
        [
          h.div([h.Class(className(styles.sectionTitle, styles.sectionTitleCyan))], [
            h.span([h.Class(className(styles.sectionDot))], []),
            'lampshade.part.js',
          ]),
          h.div([h.Class(className(styles.faint, styles.small))], [
            'Declarative fluidcad/core script, synced with the active step',
          ]),
        ],
      ),
      h.div(
        [h.Class(className(styles.codePanel))],
        generateFluidCadScript(design).map((line, index) =>
          renderCodeLine(index, codeLineView, [
            line.text,
            line.step === model.activeStep,
            h,
          ]),
        ),
      ),
    ],
  )
}

const teaPanelView = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class(className(styles.panel))],
    [
      h.div(
        [h.Class(className(styles.section))],
        [
          h.div([h.Class(className(styles.sectionTitle, styles.sectionTitleViolet))], [
            h.span([h.Class(className(styles.sectionDot))], []),
            'Foldkit Elm architecture + Effect-TS',
          ]),
          h.div([h.Class(className(styles.faint, styles.small))], [
            'Every slider dispatches a typed Message through update(model, msg). Click a revision to time-travel.',
          ]),
        ],
      ),
      h.div(
        [h.Class(className(styles.historyList))],
        model.history.length === 0
          ? [h.div([h.Class(className(styles.faint, styles.small))], ['No revisions yet.'])]
          : model.history.map((entry) =>
              renderHistoryRow(entry.revision, historyRowView, [
                entry.revision,
                entry.tag,
                entry.summary,
                entry.revision === model.revision,
                h,
              ]),
            ),
      ),
    ],
  )

const stylexPanelView = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.div(
    [h.Class(className(styles.panel))],
    [
      h.div(
        [h.Class(className(styles.section))],
        [
          h.div([h.Class(className(styles.sectionTitle, styles.sectionTitlePink))], [
            h.span([h.Class(className(styles.sectionDot))], []),
            '@stylexjs/stylex atomic engine',
          ]),
          h.div([h.Class(className(styles.faint, styles.small))], [
            'Design tokens compile to collision-free atomic class hashes. Switch the active theme below.',
          ]),
          h.div(
            [h.Class(className(styles.cardGrid))],
            [
              h.button(
                [
                  h.Class(className(styles.presetCard, styles.presetCardActive)),
                  h.OnClick(
                    MessageUnion.AppliedTheme({
                      name: 'Solar Amber',
                      accentHex: '#f59e0b',
                      filamentHex: '#fff8eb',
                    }),
                  ),
                ],
                [h.div([h.Class(className(styles.presetName))], ['Solar Amber'])],
              ),
              h.button(
                [
                  h.Class(className(styles.presetCard)),
                  h.OnClick(
                    MessageUnion.AppliedTheme({
                      name: 'CAD Cyan',
                      accentHex: '#06b6d4',
                      filamentHex: '#e0f2fe',
                    }),
                  ),
                ],
                [h.div([h.Class(className(styles.presetName))], ['CAD Cyan'])],
              ),
              h.button(
                [
                  h.Class(className(styles.presetCard)),
                  h.OnClick(
                    MessageUnion.AppliedTheme({
                      name: 'Laser Rose',
                      accentHex: '#f43f5e',
                      filamentHex: '#ffe4e6',
                    }),
                  ),
                ],
                [h.div([h.Class(className(styles.presetName))], ['Laser Rose'])],
              ),
              h.button(
                [
                  h.Class(className(styles.presetCard)),
                  h.OnClick(
                    MessageUnion.AppliedTheme({
                      name: 'Phosphor Green',
                      accentHex: '#10b981',
                      filamentHex: '#d1fae5',
                    }),
                  ),
                ],
                [h.div([h.Class(className(styles.presetName))], ['Phosphor Green'])],
              ),
            ],
          ),
        ],
      ),
      h.div(
        [h.Class(className(styles.codePanel))],
        [
          h.div([h.Class(className(styles.faint))], ['// compiled atomic output']),
          h.div([h.Class(className(styles.badge, styles.badgePink))], [
            `.x-accent { color: ${model.accentHex}; }`,
          ]),
          h.div([h.Class(className(styles.badge, styles.badgeCyan))], [
            `.x-surface { background: ${model.filamentHex}; }`,
          ]),
          h.div([h.Class(className(styles.faint))], [
            `// active theme: ${model.themeName}`,
          ]),
        ],
      ),
    ],
  )

// VIEW

export const view = (model: Model, h: HtmlBuilder<Message>): Document => {
  const design = designOf(model)
  const report = auditPrintability(design)
  const activeStep = STEPS[model.activeStep - 1] ?? STEPS[7]

  const header = h.header(
    [h.Class(className(styles.header))],
    [
      h.div(
        [h.Class(className(styles.headerRow))],
        [
          h.div(
            [h.Class(className(styles.brand))],
            [
              h.div([h.Class(className(styles.brandMark))], ['L']),
              h.div(
                [h.Class(className(styles.brandText))],
                [
                  h.span([h.Class(className(styles.brandTitle))], [
                    'LuminaCAD Studio Pro',
                  ]),
                  h.span(
                    [h.Class(className(styles.badge, styles.badgeCyan))],
                    ['foldkit 0.168'],
                  ),
                  h.span(
                    [h.Class(className(styles.badge, styles.badgeViolet))],
                    ['effect 4.0.0'],
                  ),
                  h.span(
                    [h.Class(className(styles.badge, styles.badgePink))],
                    ['three r184'],
                  ),
                ],
              ),
            ],
          ),
          h.div(
            [h.Class(className(styles.headerRow))],
            [
              h.button(
                [
                  h.Class(className(styles.button)),
                  h.OnClick(MessageUnion.SteppedPrev()),
                ],
                ['Prev'],
              ),
              h.button(
                [
                  h.Class(
                    className(
                      styles.button,
                      styles.buttonAccent,
                      model.isPlayingSteps && styles.buttonActive,
                    ),
                  ),
                  h.OnClick(MessageUnion.ToggledStepPlayback()),
                ],
                [model.isPlayingSteps ? 'Pause' : 'Auto-Walk'],
              ),
              h.button(
                [
                  h.Class(className(styles.button)),
                  h.OnClick(MessageUnion.SteppedNext()),
                ],
                ['Next'],
              ),
              h.button(
                [
                  h.Class(className(styles.button, styles.buttonEmerald)),
                  h.OnClick(MessageUnion.SelectedStep({ step: 8 })),
                ],
                ['Final 8/8'],
              ),
            ],
          ),
        ],
      ),
      h.div(
        [h.Class(className(styles.stepper))],
        STEPS.map((entry) =>
          renderStepPill(entry.step, stepPillView, [
            entry.step,
            entry.title,
            entry.step === model.activeStep,
            entry.step < model.activeStep,
            h,
          ]),
        ),
      ),
    ],
  )

  const viewport = h.div(
    [h.Id('viewport-container'), h.Class(className(styles.viewport))],
    [
      h.canvas(
        [
          h.Id('viewport-canvas'),
          h.Class(className(styles.viewportCanvas)),
          h.OnMount(MountViewport()),
        ],
        [],
      ),
      h.div(
        [h.Class(className(styles.hud))],
        [
          h.div(
            [h.Class(className(styles.hudCard))],
            [
              h.div(
                [h.Class(className(styles.hudHead))],
                [
                  h.div(
                    [h.Class(className(styles.hudTitleGroup))],
                    [
                      h.span([h.Class(className(styles.hudStep))], [
                        `STEP ${model.activeStep}/8`,
                      ]),
                      h.h2([h.Class(className(styles.hudTitle))], [activeStep.title]),
                    ],
                  ),
                  h.span([h.Class(className(styles.hudOp))], [activeStep.op]),
                ],
              ),
              h.div(
                [h.Class(className(styles.hudPillars))],
                [
                  h.div([h.Class(className(styles.hudPillar))], [
                    h.span([h.Class(className(styles.hudPillarLabel))], ['Foldkit']),
                    h.span([h.Class(className(styles.hudPillarValue))], [activeStep.op]),
                  ]),
                  h.div([h.Class(className(styles.hudPillar))], [
                    h.span([h.Class(className(styles.hudPillarLabel))], ['Three.js']),
                    h.span([h.Class(className(styles.hudPillarValue))], ['Lathed B-Rep']),
                  ]),
                  h.div([h.Class(className(styles.hudPillar))], [
                    h.span([h.Class(className(styles.hudPillarLabel))], ['Foldkit Msg']),
                    h.span([h.Class(className(styles.hudPillarValue))], [
                      `SelectedStep(${model.activeStep})`,
                    ]),
                  ]),
                  h.div([h.Class(className(styles.hudPillar))], [
                    h.span([h.Class(className(styles.hudPillarLabel))], ['StyleX']),
                    h.span([h.Class(className(styles.hudPillarValue))], [model.themeName]),
                  ]),
                ],
              ),
            ],
          ),
        ],
      ),
      h.div(
        [h.Class(className(styles.viewportToggles))],
        [
          h.div(
            [h.Class(className(styles.toggleBar))],
            [
              h.button(
                [
                  h.Class(
                    className(
                      styles.button,
                      model.bulbOn && styles.buttonAccent,
                    ),
                  ),
                  h.OnClick(MessageUnion.ToggledBulb()),
                ],
                [model.bulbOn ? 'Bulb: ON' : 'Bulb: OFF'],
              ),
              h.button(
                [
                  h.Class(
                    className(
                      styles.button,
                      model.showDatumHelpers && styles.buttonAccent,
                    ),
                  ),
                  h.OnClick(MessageUnion.ToggledDatumHelpers()),
                ],
                ['CAD Sketch'],
              ),
              h.button(
                [
                  h.Class(
                    className(
                      styles.button,
                      model.wireframe && styles.buttonAccent,
                    ),
                  ),
                  h.OnClick(MessageUnion.ToggledWireframe()),
                ],
                ['Wire'],
              ),
              h.button(
                [
                  h.Class(
                    className(
                      styles.button,
                      model.cutaway && styles.buttonAccent,
                    ),
                  ),
                  h.OnClick(MessageUnion.ToggledCutaway()),
                ],
                ['Section'],
              ),
              h.button(
                [
                  h.Class(className(styles.button, styles.buttonGhost)),
                  h.OnClick(MessageUnion.ResetCamera()),
                ],
                ['Reset Cam'],
              ),
            ],
          ),
        ],
      ),
      h.div(
        [h.Class(className(styles.viewportTelemetry))],
        [
          h.div(
            [h.Class(className(styles.telemetryCard))],
            [
              renderTelemetry(telemetryView, [
                `Ø${Math.round((design.bottomRadius + design.topRadius) * 2)} × ${design.height} mm`,
                `${design.patternType} ×${design.radialFreq}`,
                `${design.wallThickness.toFixed(1)} mm`,
                `${report.buildVolumeUsed} cm³`,
                h,
              ]),
            ],
          ),
        ],
      ),
      model.showToast
        ? h.div(
            [h.Class(className(styles.toast))],
            [
              h.button(
                [
                  h.Class(className(styles.toastButton)),
                  h.OnClick(MessageUnion.DismissedToast()),
                ],
                [model.toastMessage],
              ),
            ],
          )
        : h.empty,
    ],
  )

  const tabContent = ((): Html => {
    switch (model.mainTab) {
      case 'params':
        return paramsPanelView(model, h)
      case 'nodes':
        return nodeBuilderView(
          design,
          report,
          model.selectedNodeId,
          model.activeStep,
          h,
        )
      case 'section':
        return sectionViewerView(design, h)
      case 'code':
        return codePanelView(model, h)
      case 'tea':
        return teaPanelView(model, h)
      case 'stylex':
        return stylexPanelView(model, h)
    }
  })()

  const sidebar = h.aside(
    [h.Class(className(styles.sidebar))],
    [
      h.div(
        [h.Class(className(styles.tabBar))],
        (Object.keys(TAB_LABELS) as ReadonlyArray<Tab>).map((tab) =>
          h.button(
            [
              h.Class(
                className(
                  styles.tab,
                  model.mainTab === tab && styles.tabActive,
                ),
              ),
              h.OnClick(MessageUnion.SwitchedTab({ tab })),
            ],
            [TAB_LABELS[tab]],
          ),
        ),
      ),
      tabContent,
      h.div(
        [h.Class(className(styles.footer))],
        [
          h.button(
            [
              h.Class(className(styles.buttonPrimary)),
              h.OnClick(MessageUnion.RequestedStlExport()),
            ],
            ['Export manifold .STL (mm)'],
          ),
          h.button(
            [
              h.Class(className(styles.buttonSecondary)),
              h.OnClick(MessageUnion.RequestedStepExport()),
            ],
            ['.STEP'],
          ),
        ],
      ),
    ],
  )

  const body = h.div(
    [h.Class(className(styles.app))],
    [
      header,
      h.div(
        [h.Class(className(styles.workspace))],
        [viewport, sidebar],
      ),
    ],
  )

  return {
    title: `LuminaCAD Studio Pro — ${stepLabel(model.activeStep)}`,
    body,
  }
}
