# Agent Development Notes

This is a Foldkit app. Read [`FOLDKIT.md`](./FOLDKIT.md) before writing any code in this project. It covers the architecture, the APIs, and the conventions the project is built on.

Foldkit owns `FOLDKIT.md` and replaces it whole on upgrade. This file is yours. Anything you want an agent to know about this project goes below, where an upgrade won't touch it.

`FOLDKIT.md` reads the line below to decide whether it has already offered to vendor the Foldkit source. Leave it in place.

subtree_prompted: false

## Project Notes

LuminaCAD Studio Pro is a browser-based parametric 3D lamp shade modeler. The
domain is "printable lamp shades": a lathe-revolved profile, hollowed to a wall
thickness, covered in a repeatable surface relief, and fitted with a socket
fitter.

### Domain vocabulary

- `DesignParams` — the printable subset of the Model: profile, pattern, and
  fitter parameters. Everything the CAD kernel needs. `Model` extends it with
  view state (active step, tab, theme, viewport toggles) and the revision log.
- `profileType` — the 2D profile curve family (`bulbous`, `cylinder`,
  `hourglass`, `bell`, `organic`, `pagoda`).
- `patternType` — the surface relief family (`flutes`, `diamond`, `waves`,
  `cellular`, `lattice`, `moire`, `origami`).
- `activeStep` — 1..8, the construction pipeline: param, sketch, revolve,
  shell, pattern, repeat, fitter, export. Steps 1–4 are a plain lathe; step 5
  shows one rib; steps 6–8 show the full 360° array.
- `innerWallMode` — `smooth` (constant bore, lithophane-friendly) or `follow`
  (offset shell that tracks the relief).

### Architecture seams

- `src/foldkit/messages.ts` — the whole Message union, declared with
  `defineMessageUnion`. Every agent capability maps to one of these variants.
- `src/foldkit/engine.ts` — the TEA core: `init`, the pure `update`, and the
  Commands (`ExportBinaryStl`, `ExportStepScript`, `SyncViewport`). The update
  records every revision into `model.history`, which is what the Foldkit TEA
  panel renders and what `RestoredRevision` time-travels to.
- `src/cad/kernel.ts` — pure geometry. `buildLampShadeGeometry` returns a
  `THREE.BufferGeometry`; it never touches the DOM.
- `src/cad/constraints.ts` — `auditPrintability` returns findings with a
  severity. The Node Graph panel renders them.
- `src/cad/exporters.ts` — binary STL and STEP writers.
- `src/components/Viewport3D.ts` — the Three.js scene, owned by a
  `Mount.defineStream` so the runtime releases the WebGL context on unmount.
  The `SyncViewport` Command pushes Model state into the live scene.
- `src/components/NodeBuilder.ts` — the SVG node graph and constraint cards.
- `src/components/SectionViewer.ts` — the XZ orthographic section drawing.

### Agent surface

`src/agent/contract.ts` projects the Message union into an agent contract
using `foldkit-agent`. A capability is a Message, so an agent can do nothing the
UI cannot. `src/agent/host.ts` binds that contract to the running runtime.

Run `bun run agent` to serve the contract over MCP on stdio.

### Local conventions

- `bun` is the package manager. `bun install`, `bun run typecheck`,
  `bun run build`, `bun run test`, `bun run agent`.
- The viewport is driven by the `SyncViewport` Command, not by imperative calls
  from the view. Do not call `Viewport3D` from `view.ts`.
- The Model is a Schema. `modifyFields` from `foldkit/struct` is the only
  sanctioned way to change it. Do not spread or `Object.assign`.
