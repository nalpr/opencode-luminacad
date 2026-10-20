# LuminaCAD Studio Pro

A browser-based parametric 3D lamp shade modeler built on **Foldkit 0.168** and
**Effect 4**, with a **Three.js** viewport and a first-class **agent surface**.

Model a printable lamp shade — lathe profile, hollow wall, repeatable surface
relief, socket fitter — then export a watertight binary STL or a STEP script.
Every change flows through one typed Message union and one pure `update`
function, so the UI, the tests, and the AI agent all drive the same transitions.

---

## Stack

| Layer | Choice |
| --- | --- |
| Runtime | Foldkit `0.168.0` (Elm architecture on Effect) |
| Effects | Effect `4.0.0` |
| 3D | Three.js `0.184.0` |
| Styling | StyleX `0.19.1` (atomic CSS via `@stylexjs/unplugin`) |
| Build | Vite `8` + `@foldkit/vite-plugin` |
| Tests | Vitest (`foldkit/story` + `foldkit/scene`) |
| Agents | `@foldkit/devtools-mcp`, `foldkit-agent`, `foldkit-agent-mcp` |

## Quick start

```bash
bun install
bun run dev          # http://localhost:5173/opencode-luminacad/
```

```bash
bun run typecheck    # tsc --noEmit
bun run test         # vitest run
bun run build        # typecheck + production build
bun run preview      # serve the production build
```

## Architecture

```
src/
  entry.ts               browser entry — boots the runtime
  main.ts                Runtime.makeApplication + Runtime.run
  state.ts               Model Schema, DesignParams, initial state
  view.ts                the whole view, as a pure function of the Model
  foldkit/
    messages.ts          the Message union (defineMessageUnion)
    engine.ts            init, the pure update, and the Commands
  cad/
    kernel.ts            profile curve, pattern field, manifold mesh builder
    constraints.ts       printability audit (wall, overhang, build volume)
    exporters.ts         binary STL and STEP writers
    fluidcad.ts          the declarative .part.js script generator
  components/
    Viewport3D.ts        the Three.js scene, owned by a Mount
    NodeBuilder.ts       the SVG node graph and constraint cards
    SectionViewer.ts     the XZ orthographic section drawing
    PresetLibrary.ts     the curated templates
  style/
    tokens.stylex.ts     the design tokens, compiled to CSS custom properties
    styles.ts            the component styles, compiled to atomic classes
    className.ts         the StyleX-to-Foldkit class attribute bridge
  agent/
    contract.ts          the agent contract, projected from the Message union
    host.ts              the binding to a live runtime
    server.ts            the MCP server over stdio
```

### Model → Update → View

`src/state.ts` holds the Model Schema. `src/foldkit/messages.ts` declares every
Message variant in one union. `src/foldkit/engine.ts` holds the pure `update`,
which returns the next Model and any Commands. `src/view.ts` renders the Model
and nothing else.

Side effects are Commands, never calls from the view:

| Command | Effect |
| --- | --- |
| `SyncViewport` | pushes the Model's viewport slice into the live Three.js scene |
| `ExportBinaryStl` | writes a watertight binary STL in millimeters |
| `ExportStepScript` | writes a STEP script |

`SyncViewport` is only emitted when the viewport slice actually changed, so a
tab switch does not rebuild the mesh.

### Styling

StyleX compiles the design tokens and component styles into atomic CSS
classes. `src/style/tokens.stylex.ts` holds the tokens, `src/style/styles.ts`
holds the rules, and `src/style/className.ts` bridges them to Foldkit's HTML
builder:

```ts
h.Class(className(styles.button, isActive && styles.buttonActive))
```

`className` merges the sets and resolves the last one that defines a property.
`src/styles.css` holds only what is not a component style: the reset, the
range input, and the scrollbars.

The compiler runs through `@stylexjs/unplugin`, so the atomic CSS is extracted
at build time rather than injected at runtime. `defineVars` needs a
`.stylex.ts` file extension, because the compiler hashes the file path to
generate the variable names.

### The 8-stage construction pipeline

`activeStep` walks the model through its own construction: `param` → `sketch` →
`revolve` → `shell` → `pattern` → `repeat` → `fitter` → `export`. Steps 1–4
show a plain lathe, step 5 isolates a single rib, steps 6–8 show the full 360°
array. The Auto-Walk button plays the sequence.

### Time travel

`update` records every user action into `model.history` with a snapshot of the
design. The **Foldkit TEA** panel lists the log; clicking an entry restores it.
Foldkit's own DevTools overlay provides a deeper runtime-level time travel.

## Agent integration

Two surfaces, both speaking MCP.

### 1. DevTools MCP — inspect and drive the running app

`@foldkit/vite-plugin` hosts a relay that the browser bridge connects to, and
`@foldkit/devtools-mcp` exposes it as MCP tools. The `.mcp.json` in this repo
pre-wires the server.

```json
{
  "mcpServers": {
    "foldkit-devtools": {
      "command": "npx",
      "args": ["-y", "@foldkit/devtools-mcp"]
    }
  }
}
```

With the dev server running and the app open in a browser, an agent gets:

| Tool | What it does |
| --- | --- |
| `foldkit_get_model` | read the live Model, narrowed by a dot path |
| `foldkit_dispatch_message` | send a Message into the runtime |
| `foldkit_list_messages` | the Message history with diffs |
| `foldkit_replay_to_keyframe` | time-travel the runtime |
| `foldkit_get_message_schema` | the JSON Schema of the Message union |

Dispatch works because `main.ts` passes the Message Schema to `devTools`.

> On Windows the relay cannot publish its discovery address, so `vite.config.ts`
> pins `devToolsMcpPort: 9988`. Point the MCP server at it with
> `FOLDKIT_DEVTOOLS_MCP_PORT=9988`.

### 2. The LuminaCAD contract — a purpose-built agent surface

`src/agent/contract.ts` projects the Message union into an agent contract with
`foldkit-agent`. A capability *is* a Message, so an agent can do nothing the UI
cannot.

```bash
bun run agent           # serve the contract over MCP on stdio
bun run agent:manifest  # write agent.json for review
```

`agent.json` records the 14 exposed capabilities and the read-only `design`
resource:

`select_step`, `step_next`, `step_previous`, `update_param`, `apply_preset`,
`randomize_design`, `toggle_bulb`, `toggle_cutaway`, `toggle_wireframe`,
`toggle_cad_helpers`, `export_stl`, `export_step`, `switch_tab`, `apply_theme`.

The headless server in `src/agent/server.ts` runs the same `update` the browser
runs, so an agent's dispatches go through exactly the transitions a user's do.

## Printability

`auditPrintability` reports errors and warnings on every model change:

- wall thickness below the 0.8mm minimum
- height or footprint beyond the build volume
- a wall that is not a multiple of the 0.4mm nozzle
- an outward flare past 45° that will need support material
- a socket ring that intersects the shade wall
- relief deeper than the wall can carry

The Node Graph panel renders the findings.

## Deployment

`.github/workflows/deploy.yml` runs typecheck, tests, and the production build
on every push to `main`, then publishes to GitHub Pages. Pages is only
attempted for public repositories, because GitHub does not serve Pages from a
private repository on the free plan; making the repository public enables the
deploy automatically. The Vite `base` is `/opencode-luminacad/`, matching the
repository name — change it in `vite.config.ts` if you rename the repo.

## License

MIT
