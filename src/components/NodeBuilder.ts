import type { Html, HtmlBuilder } from 'foldkit/html'

import type { Message } from '../foldkit/messages'
import { Message as MessageUnion } from '../foldkit/messages'
import type { ConstraintReport } from '../cad/constraints'
import type { DesignParams } from '../state'
import { className } from '../style/className'
import { styles } from '../style/styles'

export interface GraphNode {
  readonly id: string
  readonly title: string
  readonly op: string
  readonly detail: string
  readonly x: number
  readonly y: number
  readonly step: number
}

export const GRAPH_NODES: ReadonlyArray<GraphNode> = [
  {
    id: 'param',
    title: 'Parameters',
    op: 'param()',
    detail: 'H, Rb, Rt, wallT',
    x: 24,
    y: 24,
    step: 1,
  },
  {
    id: 'sketch',
    title: 'Profile',
    op: 'sketch("xz")',
    detail: 'closed spline on the XZ datum',
    x: 24,
    y: 116,
    step: 2,
  },
  {
    id: 'revolve',
    title: 'Revolution',
    op: 'revolve(profile, "z")',
    detail: '360° axisymmetric blank',
    x: 24,
    y: 208,
    step: 3,
  },
  {
    id: 'shell',
    title: 'Shell',
    op: 'shell(wallT)',
    detail: 'hollow interior, open ends',
    x: 24,
    y: 300,
    step: 4,
  },
  {
    id: 'pattern',
    title: 'Pattern',
    op: 'helix() + sweep()',
    detail: 'single relief feature',
    x: 24,
    y: 392,
    step: 5,
  },
  {
    id: 'repeat',
    title: 'Array',
    op: 'repeat(feature, Nr)',
    detail: 'circular pattern array',
    x: 24,
    y: 484,
    step: 6,
  },
  {
    id: 'fitter',
    title: 'Socket',
    op: 'cylinder() + hole()',
    detail: 'E27 boss, radial spokes',
    x: 24,
    y: 576,
    step: 7,
  },
  {
    id: 'export',
    title: 'Export',
    op: 'exportStl()',
    detail: 'watertight binary STL',
    x: 24,
    y: 668,
    step: 8,
  },
]

export const GRAPH_LINKS: ReadonlyArray<readonly [string, string]> = [
  ['param', 'sketch'],
  ['sketch', 'revolve'],
  ['revolve', 'shell'],
  ['shell', 'pattern'],
  ['pattern', 'repeat'],
  ['repeat', 'fitter'],
  ['fitter', 'export'],
]

const NODE_WIDTH = 224
const NODE_HEIGHT = 72

const nodeById = (id: string): GraphNode => {
  const node = GRAPH_NODES.find((candidate) => candidate.id === id)
  if (!node) throw new Error(`Unknown graph node: ${id}`)
  return node
}

const constraintCards = (
  report: ConstraintReport,
  h: HtmlBuilder<Message>,
): Html =>
  report.findings.length === 0
    ? h.div([h.Class(className(styles.section))], [
        h.div([h.Class(className(styles.sectionTitle, styles.sectionTitleEmerald))], [
          '✓ Printable',
        ]),
        h.div([h.Class(className(styles.faint, styles.small))], [
          `Minimum wall ${report.minimumWall}mm · max overhang ${report.maximumOverhangAngle}°`,
        ]),
      ])
    : h.div(
        [h.Class(className(styles.section))],
        report.findings.map((finding) =>
          h.div(
            [
              h.Class(
                className(
                  finding.severity === 'error'
                    ? styles.findingError
                    : styles.findingWarning,
                ),
              ),
            ],
            [
              h.div(
                [
                  h.Class(
                    className(
                      finding.severity === 'error'
                        ? styles.findingCodeError
                        : styles.findingCodeWarning,
                    ),
                  ),
                ],
                [finding.code],
              ),
              h.div([h.Class(className(styles.findingMessage))], [finding.message]),
            ],
          ),
        ),
      )

export const nodeBuilderView = (
  design: DesignParams,
  report: ConstraintReport,
  selectedNodeId: string,
  activeStep: number,
  h: HtmlBuilder<Message>,
) =>
  h.div(
    [h.Class(className(styles.panel))],
    [
      h.div(
        [h.Class(className(styles.section))],
        [
          h.div([h.Class(className(styles.sectionTitle, styles.sectionTitleCyan))], [
            h.span([h.Class(className(styles.sectionDot))], []),
            'FluidCAD node graph',
          ]),
          h.div([h.Class(className(styles.faint, styles.small))], [
            'Click a node to jump to the matching construction step.',
          ]),
          h.svg(
            [
              h.Width('272'),
              h.Height('768'),
              h.ViewBox('0 0 272 768'),
            ],
            GRAPH_LINKS.flatMap(([fromId, toId]) => {
              const from = nodeById(fromId)
              const to = nodeById(toId)
              const x1 = from.x + NODE_WIDTH / 2
              const y1 = from.y + NODE_HEIGHT
              const x2 = to.x + NODE_WIDTH / 2
              const y2 = to.y
              const midY = (y1 + y2) / 2
              return [
                h.path(
                  [
                    h.D(
                      `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`,
                    ),
                    h.Fill('none'),
                    h.Stroke('#1e293b'),
                    h.StrokeWidth('2'),
                  ],
                  [],
                ),
              ]
            }).concat(
              GRAPH_NODES.flatMap((node) => {
                const isActive = node.id === selectedNodeId
                const isCurrent = node.step === activeStep
                const stroke = isCurrent ? '#f59e0b' : isActive ? '#22d3ee' : '#283548'
                return [
                  h.rect(
                    [
                      h.X(String(node.x)),
                      h.Y(String(node.y)),
                      h.Width(String(NODE_WIDTH)),
                      h.Height(String(NODE_HEIGHT)),
                      h.Rx('10'),
                      h.Fill(isActive ? '#0f1a2b' : '#0b1220'),
                      h.Stroke(stroke),
                      h.StrokeWidth(isCurrent ? '2' : '1'),
                    ],
                    [],
                  ),
                  h.text(
                    [
                      h.X(String(node.x + 14)),
                      h.Y(String(node.y + 24)),
                      h.Fill(isCurrent ? '#f8fafc' : '#cbd5e1'),
                      h.FontSize('12'),
                      h.FontWeight('600'),
                    ],
                    [node.title],
                  ),
                  h.text(
                    [
                      h.X(String(node.x + 14)),
                      h.Y(String(node.y + 42)),
                      h.Fill('#22d3ee'),
                      h.FontSize('10'),
                      h.FontFamily('monospace'),
                    ],
                    [node.op],
                  ),
                  h.text(
                    [
                      h.X(String(node.x + 14)),
                      h.Y(String(node.y + 58)),
                      h.Fill('#64748b'),
                      h.FontSize('9'),
                    ],
                    [node.detail],
                  ),
                  h.rect(
                    [
                      h.X(String(node.x + NODE_WIDTH - 30)),
                      h.Y(String(node.y + 8)),
                      h.Width('22'),
                      h.Height('16'),
                      h.Rx('4'),
                      h.Fill(isCurrent ? '#f59e0b' : '#1e293b'),
                    ],
                    [],
                  ),
                  h.text(
                    [
                      h.X(String(node.x + NODE_WIDTH - 25)),
                      h.Y(String(node.y + 20)),
                      h.Fill(isCurrent ? '#0a0f16' : '#94a3b8'),
                      h.FontSize('9'),
                      h.FontWeight('700'),
                    ],
                    [String(node.step)],
                  ),
                ]
              }),
            ),
          ),
          h.div(
            [h.Class(className(styles.cardGrid))],
            GRAPH_NODES.map((node) =>
              h.button(
                [
                  h.Class(
                    className(
                      styles.button,
                      node.id === selectedNodeId && styles.buttonAccent,
                    ),
                  ),
                  h.OnClick(MessageUnion.SelectedNode({ nodeId: node.id })),
                ],
                [node.op],
              ),
            ),
          ),
        ],
      ),
      constraintCards(report, h),
    ],
  )
