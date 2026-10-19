import { Effect } from 'effect'
import { Agent } from 'foldkit-agent'

import { contract } from './contract'
import type { Message } from '../foldkit/messages'
import type { Model } from '../state'

export interface AgentHostBridge {
  readonly model: () => Model
  readonly dispatch: (message: Message) => void
  readonly subscribe: (listener: () => void) => () => void
}

/**
 * Binds the LuminaCAD agent contract to a live Foldkit runtime.
 *
 * The host is the only seam between the contract and the application: it reads
 * the current Model, dispatches a Message into the runtime, and notifies
 * subscribers when the Model changes. Every capability in the contract is a
 * Message the application already handles, so an agent can do nothing the UI
 * cannot.
 */
export const bindAgent = (bridge: AgentHostBridge) =>
  Agent.bind({
    definition: contract,
    host: {
      model: bridge.model,
      dispatch: bridge.dispatch,
      subscribe: bridge.subscribe,
    },
  })

export type BoundAgent = ReturnType<typeof bindAgent>

export const dispatchCapability = (
  runtime: BoundAgent,
  name: string,
  input: unknown,
): Effect.Effect<unknown, unknown> =>
  runtime.messages.dispatchUnknown(name, input)

export const listCapabilities = (
  runtime: BoundAgent,
): Effect.Effect<ReadonlyArray<unknown>, unknown> => runtime.messages.available
