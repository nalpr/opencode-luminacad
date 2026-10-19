import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Agent } from 'foldkit-agent'

import { contract } from '../src/agent/contract'

/**
 * Writes the agent contract to `agent.json` so a change to what the
 * application exposes is visible in review, not only at runtime.
 */
const manifest = Agent.toManifest(contract)

const json = `${JSON.stringify(manifest, null, 2)}\n`
const target = resolve(process.cwd(), 'agent.json')

writeFileSync(target, json, 'utf-8')
process.stdout.write(`Wrote ${target}\n`)
