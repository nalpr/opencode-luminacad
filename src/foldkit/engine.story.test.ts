import { Command, given, message, model, story } from 'foldkit/story'
import { describe, expect, test } from 'vitest'

import { Message } from './messages'
import {
  ExportBinaryStl,
  ExportStepScript,
  SyncViewport,
  init,
  update,
} from './engine'
import type { Model } from '../state'

const initialModel: Model = init().model

const resolveViewport = Command.resolve(
  SyncViewport,
  Message.CompletedSyncViewport(),
)

describe('update', () => {
  test('SelectedStep clamps the pipeline to 1..8', () => {
    story(
      update,
      given(initialModel),
      message(Message.SelectedStep({ step: 3 })),
      resolveViewport,
      model((current) => {
        expect(current.activeStep).toBe(3)
      }),
      message(Message.SelectedStep({ step: 99 })),
      resolveViewport,
      model((current) => {
        expect(current.activeStep).toBe(8)
      }),
      message(Message.SelectedStep({ step: -4 })),
      resolveViewport,
      model((current) => {
        expect(current.activeStep).toBe(1)
      }),
    )
  })

  test('SteppedNext wraps from 8 back to 1', () => {
    story(
      update,
      given(initialModel),
      message(Message.SteppedNext()),
      resolveViewport,
      model((current) => {
        expect(current.activeStep).toBe(1)
      }),
    )
  })

  test('SteppedPrev wraps from 1 back to 8', () => {
    story(
      update,
      given({ ...initialModel, activeStep: 1 }),
      message(Message.SteppedPrev()),
      resolveViewport,
      model((current) => {
        expect(current.activeStep).toBe(8)
      }),
    )
  })

  test('UpdatedParam writes a numeric design value', () => {
    story(
      update,
      given(initialModel),
      message(Message.UpdatedParam({ key: 'height', value: 250 })),
      resolveViewport,
      model((current) => {
        expect(current.height).toBe(250)
      }),
    )
  })

  test('UpdatedParam writes an enum design value', () => {
    story(
      update,
      given(initialModel),
      message(Message.UpdatedParam({ key: 'patternType', value: 'diamond' })),
      resolveViewport,
      model((current) => {
        expect(current.patternType).toBe('diamond')
      }),
    )
  })

  test('UpdatedParam ignores an unknown key', () => {
    story(
      update,
      given(initialModel),
      message(Message.UpdatedParam({ key: 'notAField', value: 1 })),
      model((current) => {
        expect(current.height).toBe(initialModel.height)
      }),
    )
  })

  test('AppliedPreset loads every parameter of the template', () => {
    story(
      update,
      given(initialModel),
      message(Message.AppliedPreset({ presetId: 'cyberpunk_hex' })),
      resolveViewport,
      model((current) => {
        expect(current.presetName).toBe('Cyberpunk Hex')
        expect(current.patternType).toBe('lattice')
        expect(current.fitterType).toBe('bottom_ring')
      }),
    )
  })

  test('AppliedPreset on an unknown id leaves the model alone', () => {
    story(
      update,
      given(initialModel),
      message(Message.AppliedPreset({ presetId: 'nope' })),
      model((current) => {
        expect(current.presetName).toBe(initialModel.presetName)
      }),
    )
  })

  test('ToggledBulb flips the bulb state', () => {
    story(
      update,
      given(initialModel),
      message(Message.ToggledBulb()),
      resolveViewport,
      model((current) => {
        expect(current.bulbOn).toBe(false)
      }),
    )
  })

  test('SwitchedTab changes the inspector panel', () => {
    story(
      update,
      given(initialModel),
      message(Message.SwitchedTab({ tab: 'nodes' })),
      model((current) => {
        expect(current.mainTab).toBe('nodes')
      }),
    )
  })

  test('RequestedStlExport returns the export Command', () => {
    story(
      update,
      given(initialModel),
      message(Message.RequestedStlExport()),
      Command.expectHas(ExportBinaryStl),
      Command.resolve(
        ExportBinaryStl,
        Message.CompletedStlExport({ fileName: 'a.stl', triangles: 10 }),
      ),
    )
  })

  test('RequestedStepExport returns the STEP Command', () => {
    story(
      update,
      given(initialModel),
      message(Message.RequestedStepExport()),
      Command.expectHas(ExportStepScript),
      Command.resolve(
        ExportStepScript,
        Message.CompletedStlExport({ fileName: 'a.step', triangles: 0 }),
      ),
    )
  })

  test('every update records a revision and a history entry', () => {
    story(
      update,
      given(initialModel),
      message(Message.UpdatedParam({ key: 'height', value: 120 })),
      resolveViewport,
      model((current) => {
        expect(current.revision).toBe(initialModel.revision + 1)
        expect(current.history.length).toBe(1)
        expect(current.history[0].tag).toBe('UpdatedParam')
        expect(current.history[0].design.height).toBe(120)
      }),
    )
  })

  test('RestoredRevision rewinds the design to a recorded revision', () => {
    story(
      update,
      given(initialModel),
      message(Message.UpdatedParam({ key: 'height', value: 120 })),
      resolveViewport,
      message(Message.UpdatedParam({ key: 'height', value: 260 })),
      resolveViewport,
      model((current) => {
        expect(current.height).toBe(260)
      }),
      message(Message.RestoredRevision({ index: initialModel.revision + 1 })),
      resolveViewport,
      model((current) => {
        expect(current.height).toBe(120)
      }),
    )
  })

  test('RandomizedDesign produces a printable design', () => {
    story(
      update,
      given(initialModel),
      message(Message.RandomizedDesign()),
      resolveViewport,
      model((current) => {
        expect(current.presetName).toBe('Generative Seed')
        expect(current.height).toBeGreaterThanOrEqual(140)
        expect(current.height).toBeLessThanOrEqual(250)
      }),
    )
  })
})
