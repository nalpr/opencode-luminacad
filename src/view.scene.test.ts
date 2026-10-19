import { click, expect, given, role, scene, text, Mount, Command } from 'foldkit/scene'
import { describe, test } from 'vitest'

import { view } from './view'
import { init, SyncViewport, update } from './foldkit/engine'
import { MountViewport } from './components/Viewport3D'
import { Message } from './foldkit/messages'
import type { Model } from './state'

const initialModel: Model = init().model

const resolveViewportMount = Mount.resolveAll(
  [MountViewport, Message.SucceededMountViewport()],
)

describe('view', () => {
  test('renders the eight construction steps', () => {
    scene(
      { update, view },
      given(initialModel),
      resolveViewportMount,
      expect(text('1. param() & datum init')).toExist(),
      expect(text('8. manifold STL export')).toExist(),
    )
  })

  test('renders the active step badge', () => {
    scene(
      { update, view },
      given(initialModel),
      resolveViewportMount,
      expect(text('STEP 8/8')).toExist(),
    )
  })

  test('the params panel shows the current height', () => {
    scene(
      { update, view },
      given(initialModel),
      resolveViewportMount,
      expect(text('200 mm')).toExist(),
    )
  })

  test('the export button is present', () => {
    scene(
      { update, view },
      given(initialModel),
      resolveViewportMount,
      expect(role('button', { name: 'Export manifold .STL (mm)' })).toExist(),
    )
  })

  test('the STEP export button is present', () => {
    scene(
      { update, view },
      given(initialModel),
      resolveViewportMount,
      expect(role('button', { name: '.STEP' })).toExist(),
    )
  })

  test('every inspector tab is reachable', () => {
    scene(
      { update, view },
      given(initialModel),
      resolveViewportMount,
      expect(role('button', { name: 'CAD Params' })).toExist(),
      expect(role('button', { name: 'Node Graph' })).toExist(),
      expect(role('button', { name: 'Section' })).toExist(),
      expect(role('button', { name: 'FluidCAD' })).toExist(),
      expect(role('button', { name: 'Foldkit TEA' })).toExist(),
      expect(role('button', { name: 'StyleX' })).toExist(),
    )
  })

  test('the node graph tab renders the CAD kernel stages', () => {
    scene(
      { update, view },
      given({ ...initialModel, mainTab: 'nodes' }),
      resolveViewportMount,
      expect(text('FluidCAD node graph')).toExist(),
      expect(text('revolve(profile, "z")')).toExist(),
    )
  })

  test('the section tab renders the XZ drawing', () => {
    scene(
      { update, view },
      given({ ...initialModel, mainTab: 'section' }),
      resolveViewportMount,
      expect(text('XZ orthographic section')).toExist(),
    )
  })

  test('the code tab renders the declarative script', () => {
    scene(
      { update, view },
      given({ ...initialModel, mainTab: 'code' }),
      resolveViewportMount,
      expect(text('lampshade.part.js')).toExist(),
    )
  })

  test('the TEA tab shows the revision log', () => {
    scene(
      { update, view },
      given({ ...initialModel, mainTab: 'tea' }),
      resolveViewportMount,
      expect(text('Foldkit Elm architecture + Effect-TS')).toExist(),
    )
  })

  test('the stylex tab shows the theme switcher', () => {
    scene(
      { update, view },
      given({ ...initialModel, mainTab: 'stylex' }),
      resolveViewportMount,
      expect(text('@stylexjs/stylex atomic engine')).toExist(),
    )
  })

  test('clicking a construction step selects it', () => {
    scene(
      { update, view },
      given(initialModel),
      resolveViewportMount,
      click(role('button', { name: '3. revolve(profile, z)' })),
      Command.resolve(SyncViewport, Message.CompletedSyncViewport()),
      expect(text('STEP 3/8')).toExist(),
    )
  })

  test('clicking the bulb toggle turns the bulb off', () => {
    scene(
      { update, view },
      given(initialModel),
      resolveViewportMount,
      click(role('button', { name: 'Bulb: ON' })),
      Command.resolve(SyncViewport, Message.CompletedSyncViewport()),
      expect(text('Bulb: OFF')).toExist(),
    )
  })
})
