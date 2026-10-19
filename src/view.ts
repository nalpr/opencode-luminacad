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

const pillClass = (active: boolean, done: boolean): string => {
  if (active) return 'px-2 py-1.5 rounded-lg border border-amber-500 bg-amber-500/15 text-left flex items-center gap-1.5'
  if (done) return 'px-2 py-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 text-left flex items-center gap-1.5'
  return 'px-2 py-1.5 rounded-lg border border-slate-800 bg-slate-900/80 text-left flex items-center gap-1.5'
}

const toggleClass = (on: boolean): string =>
  on
    ? 'px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/40'
    : 'px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 text-slate-300 hover:bg-slate-800/80 border border-transparent'

const tabClass = (active: boolean): string =>
  active
    ? 'py-2 px-1 rounded-lg text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30'
    : 'py-2 px-1 rounded-lg text-[11px] font-semibold text-slate-400 hover:text-slate-200 border border-transparent'

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
        isActive
          ? 'code-line px-2 py-0.5 rounded-r bg-amber-500/15 border-l-2 border-amber-500 text-amber-100'
          : 'code-line px-2 py-0.5 rounded-r text-slate-300',
      ),
    ],
    [h.span([h.Class('text-slate-600 select-none mr-3')], [text.length === 0 ? ' ' : text])],
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
        isCurrent
          ? 'w-full p-2 rounded-lg border border-violet-500 bg-violet-500/15 text-left font-mono text-[10px] flex items-center justify-between'
          : 'w-full p-2 rounded-lg border border-slate-800 bg-slate-950/80 text-left font-mono text-[10px] flex items-center justify-between hover:border-slate-700',
      ),
      h.OnClick(MessageUnion.RestoredRevision({ index: revision })),
    ],
    [
      h.div([h.Class('truncate pr-2')], [
        h.span([h.Class('text-violet-400 font-bold')], [`#${revision}`]),
        h.span([h.Class('text-amber-300 ml-1')], [tag]),
        h.span([h.Class('text-slate-400 block truncate')], [summary]),
      ]),
    ],
  )

const stepPillView = (
  step: number,
  title: string,
  isCurrent: boolean,
  isDone: boolean,
  h: HtmlBuilder<Message>,
): Html => {
  const dot = isCurrent ? 'bg-amber-400' : isDone ? 'bg-emerald-400' : 'bg-slate-600'
  return h.button(
    [h.Class(pillClass(isCurrent, isDone)), h.OnClick(MessageUnion.SelectedStep({ step }))],
    [
      h.span([h.Class(`w-2 h-2 rounded-full ${dot} shrink-0 inline-block`)]),
      h.span([h.Class('text-[10px] font-mono font-bold text-slate-200 truncate')], [
        `${step}. ${title}`,
      ]),
    ],
  )
}

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
        isActive
          ? 'p-2 rounded-xl border border-amber-500 bg-amber-500/15 text-left'
          : 'p-2 rounded-xl border border-slate-800 bg-slate-900/90 hover:border-slate-700 text-left',
      ),
      h.OnClick(MessageUnion.AppliedPreset({ presetId })),
    ],
    [
      h.div([h.Class('text-[11px] font-bold text-white truncate')], [name]),
      h.div([h.Class('text-[9px] font-mono text-cyan-400 truncate')], [tag]),
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
    [h.Class('flex items-center gap-3.5 text-xs flex-wrap')],
    [
      h.div([], [
        h.span([h.Class('text-[9px] uppercase tracking-wider text-slate-400 block')], ['B-Rep Bounds']),
        h.span([h.Class('font-mono font-semibold text-white')], [bounds]),
      ]),
      h.div([], [
        h.span([h.Class('text-[9px] uppercase tracking-wider text-slate-400 block')], ['Relief']),
        h.span([h.Class('font-mono font-semibold text-amber-300')], [relief]),
      ]),
      h.div([], [
        h.span([h.Class('text-[9px] uppercase tracking-wider text-slate-400 block')], ['Wall']),
        h.span([h.Class('font-mono font-semibold text-emerald-300')], [wall]),
      ]),
      h.div([], [
        h.span([h.Class('text-[9px] uppercase tracking-wider text-slate-400 block')], ['Build Vol']),
        h.span([h.Class('font-mono font-semibold text-violet-300')], [buildVolume]),
      ]),
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
  h.div([h.Class('mb-2')], [
    h.div([h.Class('flex justify-between text-[11px] mb-1')], [
      h.span([h.Class('text-slate-400')], [label]),
      h.span([h.Class('font-mono text-amber-300')], [display]),
    ]),
    h.input([
      h.Type('range'),
      h.Min(String(min)),
      h.Max(String(max)),
      h.Step(String(step)),
      h.Value(String(value)),
      h.Class('w-full'),
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
  h.div([h.Class('flex items-center justify-between gap-2')], [
    h.span([h.Class('text-[11px] text-slate-400')], [label]),
    h.select(
      [
        h.Class('bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-[11px] text-white font-mono'),
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
  return h.div([h.Class('space-y-4')], [
    h.div(
      [h.Class('flex items-center justify-between mb-2')],
      [
        h.span([h.Class('text-[11px] font-bold uppercase tracking-wider text-slate-400')], [
          'FluidCAD part templates',
        ]),
        h.button(
          [
            h.Class('text-[11px] text-amber-400 hover:text-amber-300 font-mono'),
            h.OnClick(MessageUnion.RandomizedDesign()),
          ],
          ['⚡ Randomize'],
        ),
      ],
    ),
    h.div(
      [h.Class('grid grid-cols-2 gap-1.5')],
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
      [h.Class('p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3')],
      [
        h.div([h.Class('text-xs font-bold text-cyan-300 flex items-center gap-1.5')], [
          h.span([h.Class('w-2 h-2 rounded-full bg-cyan-400 inline-block')]),
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
      [h.Class('p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3')],
      [
        h.div([h.Class('text-xs font-bold text-amber-300 flex items-center gap-1.5')], [
          h.span([h.Class('w-2 h-2 rounded-full bg-amber-400 inline-block')]),
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
          [h.Class('grid grid-cols-2 gap-2 pt-1')],
          [
            h.button(
              [
                h.Class(
                  design.innerWallMode === 'smooth'
                    ? 'p-2 rounded-lg border border-amber-500 bg-amber-500/15 text-left w-full'
                    : 'p-2 rounded-lg border border-slate-800 bg-slate-950/60 text-left w-full',
                ),
                h.OnClick(
                  MessageUnion.UpdatedParam({ key: 'innerWallMode', value: 'smooth' }),
                ),
              ],
              [
                h.div([h.Class('text-[11px] font-semibold text-white')], ['Smooth inner bore']),
                h.div([h.Class('text-[9px] text-slate-400')], ['Lithophane thickness glow']),
              ],
            ),
            h.button(
              [
                h.Class(
                  design.innerWallMode === 'follow'
                    ? 'p-2 rounded-lg border border-amber-500 bg-amber-500/15 text-left w-full'
                    : 'p-2 rounded-lg border border-slate-800 bg-slate-950/60 text-left w-full',
                ),
                h.OnClick(
                  MessageUnion.UpdatedParam({ key: 'innerWallMode', value: 'follow' }),
                ),
              ],
              [
                h.div([h.Class('text-[11px] font-semibold text-white')], ['Uniform offset shell']),
                h.div([h.Class('text-[9px] text-slate-400')], ['Inner wall follows ribs']),
              ],
            ),
          ],
        ),
      ],
    ),
    h.div(
      [h.Class('p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3')],
      [
        h.div([h.Class('text-xs font-bold text-emerald-300 flex items-center gap-1.5')], [
          h.span([h.Class('w-2 h-2 rounded-full bg-emerald-400 inline-block')]),
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
  ])
}

const codePanelView = (model: Model, h: HtmlBuilder<Message>): Html => {
  const design = designOf(model)
  return h.div([h.Class('space-y-3')], [
    h.div(
      [h.Class('flex items-center justify-between bg-slate-900 px-3 py-2 rounded-xl border border-slate-800')],
      [
        h.div([], [
          h.div([h.Class('text-xs font-bold text-cyan-300 font-mono')], ['lampshade.part.js']),
          h.div([h.Class('text-[10px] text-slate-400')], [
            'Declarative fluidcad/core script, synced with the active step',
          ]),
        ]),
      ],
    ),
    h.div(
      [
        h.Class(
          'bg-slate-950 border border-slate-800/90 rounded-xl p-2.5 font-mono text-[11px] leading-relaxed overflow-x-auto space-y-0.5',
        ),
      ],
      generateFluidCadScript(design).map((line, index) =>
        renderCodeLine(index, codeLineView, [
          line.text,
          line.step === model.activeStep,
          h,
        ]),
      ),
    ),
  ])
}

const teaPanelView = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.div([h.Class('space-y-3')], [
    h.div(
      [h.Class('p-3 rounded-xl bg-slate-900/90 border border-violet-500/30 space-y-2')],
      [
        h.div([h.Class('text-xs font-bold text-violet-300 font-mono')], [
          'Foldkit Elm architecture + Effect-TS',
        ]),
        h.p([h.Class('text-[11px] text-slate-400 leading-relaxed')], [
          'Every slider dispatches a typed Message through update(model, msg). Click a revision to time-travel.',
        ]),
        h.div(
          [h.Class('grid grid-cols-2 gap-2 pt-1 text-[10px] font-mono')],
          [
            h.div([h.Class('p-2 rounded-lg bg-slate-950 border border-slate-800')], [
              h.span([h.Class('text-slate-400')], ['ThreeViewportResource']),
              h.span([h.Class('text-emerald-400 ml-1')], ['● Mount']),
            ]),
            h.div([h.Class('p-2 rounded-lg bg-slate-950 border border-slate-800')], [
              h.span([h.Class('text-slate-400')], ['FluidCadKernel']),
              h.span([h.Class('text-emerald-400 ml-1')], ['● Pure']),
            ]),
          ],
        ),
      ],
    ),
    h.div(
      [h.Class('space-y-1.5 max-h-72 overflow-y-auto pr-1')],
      model.history.length === 0
        ? [h.div([h.Class('text-[11px] text-slate-500')], ['No revisions yet.'])]
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
    h.div(
      [
        h.Class(
          'bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-[10px] text-slate-300 overflow-x-auto leading-relaxed',
        ),
      ],
      [
        h.pre([], [
          'Model: Schema.Struct({ activeStep, profileType, height, ... })\nupdate(model, msg): { model, commands? }',
        ]),
      ],
    ),
  ])

const stylexPanelView = (model: Model, h: HtmlBuilder<Message>): Html =>
  h.div([h.Class('space-y-3')], [
    h.div(
      [h.Class('p-3 rounded-xl bg-slate-900/90 border border-pink-500/30 space-y-2.5')],
      [
        h.div([h.Class('text-xs font-bold text-pink-300 font-mono')], [
          '@stylexjs/stylex atomic engine',
        ]),
        h.p([h.Class('text-[11px] text-slate-400 leading-relaxed')], [
          'Design tokens compile to collision-free atomic class hashes. Switch the active theme below.',
        ]),
        h.div(
          [h.Class('grid grid-cols-2 gap-2 pt-1')],
          [
            h.button(
              [
                h.Class('p-2 rounded-lg bg-slate-950 border border-amber-500/50 text-xs font-mono text-amber-300'),
                h.OnClick(
                  MessageUnion.AppliedTheme({
                    name: 'Solar Amber',
                    accentHex: '#f59e0b',
                    filamentHex: '#fff8eb',
                  }),
                ),
              ],
              ['Solar Amber'],
            ),
            h.button(
              [
                h.Class('p-2 rounded-lg bg-slate-950 border border-cyan-500/50 text-xs font-mono text-cyan-300'),
                h.OnClick(
                  MessageUnion.AppliedTheme({
                    name: 'CAD Cyan',
                    accentHex: '#06b6d4',
                    filamentHex: '#e0f2fe',
                  }),
                ),
              ],
              ['CAD Cyan'],
            ),
            h.button(
              [
                h.Class('p-2 rounded-lg bg-slate-950 border border-rose-500/50 text-xs font-mono text-rose-300'),
                h.OnClick(
                  MessageUnion.AppliedTheme({
                    name: 'Laser Rose',
                    accentHex: '#f43f5e',
                    filamentHex: '#ffe4e6',
                  }),
                ),
              ],
              ['Laser Rose'],
            ),
            h.button(
              [
                h.Class('p-2 rounded-lg bg-slate-950 border border-emerald-500/50 text-xs font-mono text-emerald-300'),
                h.OnClick(
                  MessageUnion.AppliedTheme({
                    name: 'Phosphor Green',
                    accentHex: '#10b981',
                    filamentHex: '#d1fae5',
                  }),
                ),
              ],
              ['Phosphor Green'],
            ),
          ],
        ),
      ],
    ),
    h.div(
      [
        h.Class(
          'bg-slate-950 border border-slate-800 rounded-xl p-3 font-mono text-[10px] text-slate-300 space-y-1',
        ),
      ],
      [
        h.div([h.Class('text-slate-500')], ['// compiled atomic output']),
        h.div([h.Class('text-pink-300')], [`.x-accent { color: ${model.accentHex}; }`]),
        h.div([h.Class('text-pink-300')], [`.x-surface { background: ${model.filamentHex}; }`]),
        h.div([h.Class('text-slate-500')], [`// active theme: ${model.themeName}`]),
      ],
    ),
  ])

// VIEW

export const view = (model: Model, h: HtmlBuilder<Message>): Document => {
  const design = designOf(model)
  const report = auditPrintability(design)
  const activeStep = STEPS[model.activeStep - 1] ?? STEPS[7]

  const header = h.header(
    [
      h.Class(
        'w-full bg-slate-925 border-b border-slate-800 px-3 py-2 flex flex-col gap-2 shrink-0 z-30',
      ),
    ],
    [
      h.div(
        [h.Class('flex flex-wrap items-center justify-between gap-2')],
        [
          h.div(
            [h.Class('flex items-center gap-2.5')],
            [
              h.div(
                [
                  h.Class(
                    'w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 via-orange-500 to-rose-600 flex items-center justify-center shadow-lg shadow-amber-500/20',
                  ),
                ],
                [
                  h.span([h.Class('text-slate-950 text-lg font-bold')], ['L']),
                ],
              ),
              h.div(
                [h.Class('flex items-center gap-1.5 flex-wrap')],
                [
                  h.span([h.Class('text-xs sm:text-sm font-bold tracking-tight text-white')], [
                    'LuminaCAD Studio Pro',
                  ]),
                  h.span(
                    [
                      h.Class(
                        'text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/30',
                      ),
                    ],
                    ['foldkit 0.168'],
                  ),
                  h.span(
                    [
                      h.Class(
                        'text-[10px] font-mono px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-300 border border-violet-500/30',
                      ),
                    ],
                    ['effect 4.0.0'],
                  ),
                  h.span(
                    [
                      h.Class(
                        'text-[10px] font-mono px-1.5 py-0.5 rounded bg-pink-500/15 text-pink-300 border border-pink-500/30',
                      ),
                    ],
                    ['three r184'],
                  ),
                ],
              ),
            ],
          ),
          h.div(
            [h.Class('flex items-center gap-1.5 bg-slate-900/90 border border-slate-800 px-2 py-1 rounded-xl')],
            [
              h.span(
                [h.Class('text-[10px] font-mono uppercase tracking-wider text-slate-400 mr-1 hidden sm:inline')],
                ['Pipeline Step:'],
              ),
              h.button(
                [
                  h.Class('px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200'),
                  h.OnClick(MessageUnion.SteppedPrev()),
                ],
                ['Prev'],
              ),
              h.button(
                [
                  h.Class(
                    model.isPlayingSteps
                      ? 'px-2.5 py-1 rounded-lg bg-amber-500/30 text-amber-200 border border-amber-500/60 text-xs font-semibold'
                      : 'px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-semibold',
                  ),
                  h.OnClick(MessageUnion.ToggledStepPlayback()),
                ],
                [model.isPlayingSteps ? 'Pause' : 'Auto-Walk'],
              ),
              h.button(
                [
                  h.Class('px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200'),
                  h.OnClick(MessageUnion.SteppedNext()),
                ],
                ['Next'],
              ),
              h.button(
                [
                  h.Class(
                    'px-2 py-1 rounded-lg text-[11px] font-mono text-emerald-300 hover:bg-emerald-500/15 border border-emerald-500/30',
                  ),
                  h.OnClick(MessageUnion.SelectedStep({ step: 8 })),
                ],
                ['Final 8/8'],
              ),
            ],
          ),
        ],
      ),
      h.div(
        [h.Class('grid grid-cols-4 sm:grid-cols-8 gap-1.5 pt-0.5')],
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
    [
      h.Id('viewport-container'),
      h.Class('relative flex-1 h-[48vh] lg:h-full w-full overflow-hidden bg-slate-950'),
    ],
    [
      h.canvas(
        [
          h.Id('viewport-canvas'),
          h.Class('block w-full h-full'),
          h.OnMount(MountViewport()),
        ],
        [],
      ),
      h.div(
        [h.Class('absolute top-3 left-3 max-w-md pointer-events-none z-10')],
        [
          h.div(
            [h.Class('glass-hud p-3 rounded-xl pointer-events-auto shadow-2xl border border-slate-800/90 space-y-2')],
            [
              h.div(
                [h.Class('flex items-center justify-between gap-2')],
                [
                  h.div(
                    [h.Class('flex items-center gap-2')],
                    [
                      h.span(
                        [h.Class('px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 font-mono font-bold text-xs')],
                        [`STEP ${model.activeStep}/8`],
                      ),
                      h.h2([h.Class('text-xs sm:text-sm font-bold text-white')], [activeStep.title]),
                    ],
                  ),
                  h.span(
                    [
                      h.Class(
                        'text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-500/30',
                      ),
                    ],
                    [activeStep.op],
                  ),
                ],
              ),
              h.div(
                [
                  h.Class(
                    'grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1 border-t border-slate-800/80 text-[10px] font-mono',
                  ),
                ],
                [
                  h.div([h.Class('bg-slate-900/90 px-2 py-1 rounded border border-slate-800')], [
                    h.span([h.Class('text-cyan-400 block')], ['Foldkit']),
                    h.span([h.Class('text-slate-200 truncate block')], [activeStep.op]),
                  ]),
                  h.div([h.Class('bg-slate-900/90 px-2 py-1 rounded border border-slate-800')], [
                    h.span([h.Class('text-amber-400 block')], ['Three.js']),
                    h.span([h.Class('text-slate-200 truncate block')], ['Lathed B-Rep']),
                  ]),
                  h.div([h.Class('bg-slate-900/90 px-2 py-1 rounded border border-slate-800')], [
                    h.span([h.Class('text-violet-400 block')], ['Foldkit Msg']),
                    h.span([h.Class('text-slate-200 truncate block')], [
                      `SelectedStep(${model.activeStep})`,
                    ]),
                  ]),
                  h.div([h.Class('bg-slate-900/90 px-2 py-1 rounded border border-slate-800')], [
                    h.span([h.Class('text-pink-400 block')], ['StyleX']),
                    h.span([h.Class('text-slate-200 truncate block')], [model.themeName]),
                  ]),
                ],
              ),
            ],
          ),
        ],
      ),
      h.div(
        [
          h.Class(
            'absolute top-3 right-3 flex flex-col sm:flex-row items-end sm:items-center gap-1.5 pointer-events-none z-10',
          ),
        ],
        [
          h.div(
            [h.Class('glass-hud p-1.5 rounded-xl flex items-center gap-1 pointer-events-auto shadow-xl')],
            [
              h.button(
                [h.Class(toggleClass(model.bulbOn)), h.OnClick(MessageUnion.ToggledBulb())],
                [model.bulbOn ? 'Bulb: ON' : 'Bulb: OFF'],
              ),
              h.button(
                [
                  h.Class(toggleClass(model.showDatumHelpers)),
                  h.OnClick(MessageUnion.ToggledDatumHelpers()),
                ],
                ['CAD Sketch'],
              ),
              h.button(
                [h.Class(toggleClass(model.wireframe)), h.OnClick(MessageUnion.ToggledWireframe())],
                ['Wire'],
              ),
              h.button(
                [h.Class(toggleClass(model.cutaway)), h.OnClick(MessageUnion.ToggledCutaway())],
                ['Section'],
              ),
              h.button(
                [
                  h.Class(
                    'px-2.5 py-1.5 rounded-lg text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-colors',
                  ),
                  h.OnClick(MessageUnion.ResetCamera()),
                ],
                ['Reset Cam'],
              ),
            ],
          ),
        ],
      ),
      h.div(
        [
          h.Class(
            'absolute bottom-3 left-3 right-3 sm:right-auto pointer-events-none z-10 flex flex-wrap items-end justify-between gap-2',
          ),
        ],
        [
          h.div(
            [h.Class('glass-hud px-3.5 py-2 rounded-xl pointer-events-auto shadow-xl border border-slate-800/80')],
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
            [h.Class('absolute top-24 left-1/2 -translate-x-1/2 z-50 pointer-events-none')],
            [
              h.button(
                [
                  h.Class(
                    'bg-slate-900/95 border border-amber-500/50 text-amber-200 px-4 py-2 rounded-xl shadow-2xl text-xs font-mono flex items-center gap-2 backdrop-blur-md',
                  ),
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
    [
      h.Class(
        'w-full lg:w-[520px] xl:w-[560px] h-[52vh] lg:h-full bg-slate-925 border-t lg:border-t-0 lg:border-l border-slate-800/90 flex flex-col z-20 shrink-0',
      ),
    ],
    [
      h.div(
        [h.Class('grid grid-cols-6 gap-1 p-2 bg-slate-950/90 border-b border-slate-800/90 shrink-0')],
        (Object.keys(TAB_LABELS) as ReadonlyArray<Tab>).map((tab) =>
          h.button(
            [h.Class(tabClass(model.mainTab === tab)), h.OnClick(MessageUnion.SwitchedTab({ tab }))],
            [TAB_LABELS[tab]],
          ),
        ),
      ),
      h.div([h.Class('flex-1 overflow-y-auto p-3.5 space-y-4')], [tabContent]),
      h.div(
        [h.Class('p-3 bg-slate-950 border-t border-slate-800/90 shrink-0 flex items-center gap-2')],
        [
          h.button(
            [
              h.Class(
                'flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold text-xs uppercase tracking-wider shadow-lg shadow-amber-500/20 flex items-center justify-center gap-2 transition-all active:scale-[0.99]',
              ),
              h.OnClick(MessageUnion.RequestedStlExport()),
            ],
            ['Export manifold .STL (mm)'],
          ),
          h.button(
            [
              h.Class(
                'px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs uppercase tracking-wider border border-slate-700',
              ),
              h.OnClick(MessageUnion.RequestedStepExport()),
            ],
            ['.STEP'],
          ),
        ],
      ),
    ],
  )

  const body = h.div(
    [h.Class('h-screen w-screen flex flex-col overflow-hidden bg-slate-950 text-slate-100')],
    [
      header,
      h.div(
        [h.Class('flex-1 flex flex-col lg:flex-row overflow-hidden')],
        [viewport, sidebar],
      ),
    ],
  )

  return {
    title: `LuminaCAD Studio Pro — ${stepLabel(model.activeStep)}`,
    body,
  }
}
