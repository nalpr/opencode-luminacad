import type { HtmlBuilder } from 'foldkit/html'

import type { Message } from '../foldkit/messages'
import type { DesignParams } from '../state'
import { profileRadius } from '../cad/kernel'

const VIEW_WIDTH = 520
const VIEW_HEIGHT = 460
const MARGIN = 56

interface Projected {
  readonly x: number
  readonly y: number
}

const project = (
  design: DesignParams,
  radius: number,
  z: number,
): Projected => {
  const scale = Math.min(
    (VIEW_WIDTH - MARGIN * 2) / (2 * Math.max(1, design.bottomRadius + design.topRadius)),
    (VIEW_HEIGHT - MARGIN * 2) / Math.max(1, design.height),
  )
  return {
    x: VIEW_WIDTH / 2 + radius * scale,
    y: VIEW_HEIGHT - MARGIN - z * scale,
  }
}

const pathFrom = (points: ReadonlyArray<Projected>): string =>
  points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ')

export const sectionViewerView = (
  design: DesignParams,
  h: HtmlBuilder<Message>,
) => {
  const steps = 64
  const outerPoints = Array.from({ length: steps + 1 }, (_, index) => {
    const v = index / steps
    return project(design, profileRadius(design, v), v * design.height)
  })
  const innerPoints = Array.from({ length: steps + 1 }, (_, index) => {
    const v = index / steps
    return project(
      design,
      Math.max(0, profileRadius(design, v) - design.wallThickness),
      v * design.height,
    )
  })
  const mirroredOuter = [...outerPoints].reverse().map((point) => ({
    x: VIEW_WIDTH - point.x,
    y: point.y,
  }))

  const baseCenter = project(design, 0, 0)
  const topCenter = project(design, 0, design.height)
  const widthPoint = project(design, design.bottomRadius, 0)
  const heightPoint = project(design, 0, design.height)

  const wallLabel = `${design.wallThickness.toFixed(1)}mm`

  return h.div(
    [h.Class('p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2')],
    [
      h.div([h.Class('text-xs font-bold text-cyan-300 font-mono')], [
        'XZ orthographic section',
      ]),
      h.svg(
        [
          h.Width(String(VIEW_WIDTH)),
          h.Height(String(VIEW_HEIGHT)),
          h.ViewBox(`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`),
          h.Class('w-full rounded-lg bg-slate-950 border border-slate-800'),
        ],
        [
          h.rect(
            [
              h.X('0'),
              h.Y('0'),
              h.Width(String(VIEW_WIDTH)),
              h.Height(String(VIEW_HEIGHT)),
              h.Fill('#05080c'),
            ],
            [],
          ),
          h.path(
            [
              h.D(`${pathFrom(outerPoints)} L ${baseCenter.x} ${baseCenter.y} Z`),
              h.Fill('rgba(34,211,238,0.10)'),
              h.Stroke('#22d3ee'),
              h.StrokeWidth('1.5'),
            ],
            [],
          ),
          h.path(
            [
              h.D(pathFrom(innerPoints)),
              h.Fill('none'),
              h.Stroke('#10b981'),
              h.StrokeWidth('1.5'),
            ],
            [],
          ),
          h.path(
            [
              h.D(pathFrom(mirroredOuter)),
              h.Fill('none'),
              h.Stroke('#22d3ee'),
              h.StrokeWidth('1'),
              h.Opacity('0.45'),
            ],
            [],
          ),
          h.path(
            [
              h.D(`M ${baseCenter.x} ${baseCenter.y} L ${topCenter.x} ${topCenter.y}`),
              h.Stroke('#f43f5e'),
              h.StrokeWidth('1'),
              h.StrokeDasharray('6 4'),
            ],
            [],
          ),
          h.line(
            [
              h.X1(String(baseCenter.x - 14)),
              h.Y1(String(baseCenter.y)),
              h.X2(String(baseCenter.x + 14)),
              h.Y2(String(baseCenter.y)),
              h.Stroke('#f43f5e'),
              h.StrokeWidth('1'),
            ],
            [],
          ),
          h.line(
            [
              h.X1(String(baseCenter.x - 14)),
              h.Y1(String(topCenter.y)),
              h.X2(String(baseCenter.x + 14)),
              h.Y2(String(topCenter.y)),
              h.Stroke('#f43f5e'),
              h.StrokeWidth('1'),
            ],
            [],
          ),
          h.line(
            [
              h.X1(String(widthPoint.x)),
              h.Y1(String(widthPoint.y + 18)),
              h.X2(String(VIEW_WIDTH - widthPoint.x)),
              h.Y2(String(widthPoint.y + 18)),
              h.Stroke('#64748b'),
              h.StrokeWidth('1'),
            ],
            [],
          ),
          h.text(
            [
              h.X(String(VIEW_WIDTH / 2 - 26)),
              h.Y(String(widthPoint.y + 34)),
              h.Fill('#94a3b8'),
              h.FontSize('11'),
            ],
            [`Ø${Math.round(design.bottomRadius * 2)}`],
          ),
          h.line(
            [
              h.X1(String(heightPoint.x + 26)),
              h.Y1(String(topCenter.y)),
              h.X2(String(heightPoint.x + 26)),
              h.Y2(String(baseCenter.y)),
              h.Stroke('#64748b'),
              h.StrokeWidth('1'),
            ],
            [],
          ),
          h.text(
            [
              h.X(String(heightPoint.x + 32)),
              h.Y(String((topCenter.y + baseCenter.y) / 2)),
              h.Fill('#94a3b8'),
              h.FontSize('11'),
            ],
            [`H ${design.height}`],
          ),
          h.text(
            [
              h.X(String(outerPoints[0].x + 6)),
              h.Y(String(outerPoints[0].y + 34)),
              h.Fill('#10b981'),
              h.FontSize('10'),
            ],
            [wallLabel],
          ),
          h.text(
            [
              h.X('12'),
              h.Y('20'),
              h.Fill('#64748b'),
              h.FontSize('10'),
              h.FontFamily('monospace'),
            ],
            [`profile ${design.profileType} · pattern ${design.patternType}`],
          ),
        ],
      ),
      h.div(
        [h.Class('grid grid-cols-2 gap-1.5 text-[10px] font-mono')],
        [
          h.div([h.Class('rounded bg-slate-950 border border-slate-800 p-2')], [
            h.div([h.Class('text-slate-500')], ['wall']),
            h.div([h.Class('text-emerald-300')], [wallLabel]),
          ]),
          h.div([h.Class('rounded bg-slate-950 border border-slate-800 p-2')], [
            h.div([h.Class('text-slate-500')], ['height']),
            h.div([h.Class('text-cyan-300')], [`${design.height} mm`]),
          ]),
          h.div([h.Class('rounded bg-slate-950 border border-slate-800 p-2')], [
            h.div([h.Class('text-slate-500')], ['bottom Ø']),
            h.div([h.Class('text-cyan-300')], [`${Math.round(design.bottomRadius * 2)} mm`]),
          ]),
          h.div([h.Class('rounded bg-slate-950 border border-slate-800 p-2')], [
            h.div([h.Class('text-slate-500')], ['top Ø']),
            h.div([h.Class('text-cyan-300')], [`${Math.round(design.topRadius * 2)} mm`]),
          ]),
        ],
      ),
    ],
  )
}
