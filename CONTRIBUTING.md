# Contributing to LuminaCAD Studio Pro

## Before you start

Read [`FOLDKIT.md`](./FOLDKIT.md) first. It is Foldkit's own conventions guide
and it is regenerated on every Foldkit upgrade, so treat it as the source of
truth for architecture, naming, and file layout.

This project also keeps [`AGENTS.md`](./AGENTS.md), which records the domain
vocabulary and the local seams that differ from Foldkit's defaults.

## Setup

```bash
bun install
```

`bun` is the package manager. The lockfile is `bun.lock`; commit it.

## The loop

```bash
bun run typecheck   # tsc --noEmit
bun run test        # vitest run
bun run build       # typecheck + production build
bun run dev         # dev server on :5173
```

Run all three before opening a pull request.

## Tests

Tests live beside the code they drive, and the filename says how the test
works, not which file it covers.

- `*.story.test.ts` drives `update` directly. Use it for Model transitions and
  Command assertions. Every Command a story produces must be resolved.
- `*.scene.test.ts` drives the rendered view. Use it for what a user can see
  and click.

`update` is pure, so a story test needs no runtime, no DOM, and no side
effects. The `SyncViewport` Command appears whenever the viewport slice of the
Model changes, so stories that touch the design resolve it.

## Architecture rules

These are not style preferences. The framework's guarantees depend on them.

- The Model is a Schema. `modifyFields` from `foldkit/struct` is the only
  sanctioned way to change it. Never spread or `Object.assign`.
- Side effects live in Commands. `update` returns them; it never performs
  them. The view never mutates the Three.js scene.
- Every Message is a fact about what happened, in past tense. No `NoOp`.
- Declare every Message variant together with `defineMessageUnion`.
- Use `Message.match` for exhaustive matching. Never a `switch`.
- Model fields use `Option` for absence, never `null` or `undefined`.
- `Array.isArrayEmpty` / `Array.isArrayNonEmpty`, never `.length === 0`.
- Never `T[]`. Use `Array<T>` or `ReadonlyArray<T>`.
- Never a `for` loop. Use `Array.map`, `Array.filterMap`, `Array.makeBy`,
  `Array.reduce`.

## Adding a parameter

1. Add the field to `DesignParams` and to `Model` in `src/state.ts`.
2. Add the key to `PARAM_KEYS` or `ENUM_PARAM_KEYS` in
   `src/foldkit/messages.ts` so `UpdatedParam` accepts it.
3. Add a control in the params panel in `src/view.ts`.
4. Add a story test in `src/foldkit/engine.story.test.ts`.

## Adding an agent capability

A capability is a Message. Add the Message variant, handle it in `update`, and
expose it in `src/agent/contract.ts`. Then regenerate the manifest:

```bash
bun run agent:manifest
```

Commit the updated `agent.json` so the change to the agent surface is visible
in review.

## Agent tooling

The DevTools MCP bridge is pre-wired in `.mcp.json`. With the dev server
running and the app open in a browser, `foldkit_*` tools let an agent read the
Model, dispatch Messages, and time-travel the runtime.

On Windows, the relay cannot publish its discovery address. `vite.config.ts`
pins `devToolsMcpPort: 9988` for that reason; point the MCP server at it with
`FOLDKIT_DEVTOOLS_MCP_PORT=9988`.

## Pull requests

- One concern per pull request.
- Say what changed and how you verified it.
- Update `AGENTS.md` if you changed a seam another agent would need to know
  about.
