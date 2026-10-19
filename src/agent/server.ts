import { Effect } from 'effect'
import { AgentMcp } from 'foldkit-agent-mcp'

import { bindAgent } from './host'
import { Message as MessageUnion, type Message } from '../foldkit/messages'
import { init, update } from '../foldkit/engine'
import type { Model } from '../state'

export interface HeadlessHost {
  readonly model: () => Model
  readonly dispatch: (message: Message) => void
  readonly subscribe: (listener: () => void) => () => void
  readonly currentModel: Effect.Effect<Model>
}

/**
 * A headless Foldkit host for the LuminaCAD agent contract.
 *
 * It runs the same `update` the browser app runs, so an agent drives exactly
 * the transitions a user drives. The Model is the single source of truth, and
 * `dispatch` is the only way to change it.
 */
export const createHeadlessHost = (): HeadlessHost => {
  let current: Model = init().model
  const listeners = new Set<() => void>()

  const notify = (): void => {
    for (const listener of listeners) listener()
  }

  return {
    model: () => current,
    dispatch: (message) => {
      const result = update(current, message)
      current = result.model
      notify()
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    currentModel: Effect.succeed(current),
  }
}

export const startAgentServer = (): void => {
  const host = createHeadlessHost()
  const runtime = bindAgent(host)

  const server = AgentMcp.stdio({
    agent: runtime,
    serverInfo: {
      name: 'luminacad-studio-pro',
      version: '0.1.0',
    },
  })

  const shutdown = (): void => {
    server.close()
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

export { MessageUnion }
export type { Message }
