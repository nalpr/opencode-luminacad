import { Effect } from 'effect'
import { Runtime } from 'foldkit'

import { Message as MessageUnion } from './foldkit/messages'
import { init, update } from './foldkit/engine'
import { Model } from './state'
import { subscriptions, view } from './view'

export const application = Runtime.makeApplication({
  Model,
  init,
  update,
  view,
  container: document.getElementById('root'),
  subscriptions,
  devTools: {
    Message: MessageUnion,
  },
})

export const start = (): void => {
  Runtime.run(application)
}

export const bootstrap = (): Effect.Effect<void> =>
  Effect.sync(() => {
    Runtime.run(application)
  })
