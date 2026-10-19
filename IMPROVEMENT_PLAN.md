# LuminaCAD Studio Pro — Improvement Plan

Grounded in an audit of the committed tree (`afb6e97`): 5,548 lines of
TypeScript across 27 files, 53 passing tests, Effect 4 + Foldkit 0.168 +
StyleX 0.19.1 + Three.js 0.184.

Each item states the finding, the change, and how it is verified.

---

## P0 — Correctness

### 1. The theme switcher is decorative

**Finding.** `AppliedTheme` writes `themeName`, `accentHex`, and `filamentHex`
into the Model, but nothing reads them to change a style. The StyleX tokens in
`src/style/tokens.stylex.ts` are compile-time constants, so the four theme
buttons in the StyleX panel all render identically. The only visible effect is
the bulb's emissive colour, via `filamentColor`.

**Change.** Define the theme as a StyleX `defineTheme` set in
`src/style/themes.stylex.ts`, one theme per `ThemeName`, and select it with
`stylex.props(theme)`. The `AppliedTheme` message then carries only the theme
name; the view resolves the name to the compiled theme. The accent token
becomes a real variable, so `--sx-accent` in `src/styles.css` follows the
selection and the range-input thumb changes with it.

**Verify.** A scene test asserts the header background differs between two
themes. A browser check confirms the range-input thumb colour changes.

### 2. The node graph does not do what its own label says

**Finding.** `src/components/NodeBuilder.ts` renders "Click a node to jump to
the matching construction step", but `SelectedNode` only sets
`selectedNodeId`. The active step never changes, so the viewport never follows
the selection.

**Change.** `SelectedNode` sets both `selectedNodeId` and `activeStep` from
the node's `step`. The node's `step` is already in `GRAPH_NODES`.

**Verify.** A story test asserts `SelectedNode({ nodeId: 'shell' })` sets
`activeStep` to 4.

### 3. `src/update.ts` is missing from the specified layout

**Finding.** The original brief lists `src/update.ts` as a required file. The
update function currently lives inside `src/foldkit/engine.ts` (570 lines,
already the largest logic file).

**Change.** Split `engine.ts`: `src/update.ts` holds `init` and the pure
`update`; `src/foldkit/engine.ts` keeps the Commands and the history helpers.
`update.ts` re-exports what the runtime needs. This also lets the story tests
import from the path the brief names.

**Verify.** `src/update.ts` exists and the story tests import from it.

### 4. `bulbKelvin` is dead state

**Finding.** `bulbKelvin` is in the Model and the initial state, and nothing
reads it. The bulb is a fixed `0xffaa44` point light.

**Change.** Either implement it — map the Kelvin value to a blackbody colour
and drive the point light and the bulb's emissive material — or delete it from
the Model. Implementing it is more useful: the lamp shade is the product, and
the light temperature is the parameter people actually tune.

**Verify.** A test asserts that two Kelvin values produce different colours.

### 5. The overhang audit only looks at the outer profile

**Finding.** `auditPrintability` computes the maximum overhang from
`profileRadius` alone. It never looks at the relief, so a deep fluted or
lattice pattern that flares outward past 45° is not flagged.

**Change.** Sample the patterned surface, not the base profile: reuse
`patternOffset` from the kernel to get the real radius at each height, then
measure the lean of that surface. The audit already has the pattern parameters.

**Verify.** A test builds a design with a deep, outward-leaning pattern and
expects the overhang warning.

---

## P1 — Fidelity of the output

### 6. The STEP export is a stub

**Finding.** `buildStepScript` writes a valid ISO-10303-21 envelope with
entities `#1` through `#14`, but the geometry is three hard-coded
`CARTESIAN_POINT` records at the origin. Nothing describes the shade. The
header text calls it a "STEP script", which is what the file is, but the app
offers it next to the STL as if it were a solid.

**Change.** Either generate real AP214 geometry — `CARTESIAN_POINT`,
`VERTEX_POINT`, `EDGE_CURVE`, `ADVANCED_FACE`, `CLOSED_SHELL`,
`MANIFOLD_SOLID_BREP` over the triangulated mesh — or rename the button to
"Copy .part.js" and export the declarative script the FluidCAD panel already
generates.

Generating the real B-rep is the better answer: the mesh is already
triangulated and watertight, so the STEP file can be a faithful
`MANIFOLD_SOLID_BREP`.

**Verify.** A test asserts the STEP output contains one `ADVANCED_FACE` per
triangle and that the point count matches the mesh.

### 7. "Manifold" is asserted, never checked

**Finding.** The UI, the STL header, and the FluidCAD script all claim a
manifold solid. The mesh is in fact watertight — a probe over every pipeline
step found zero boundary edges and zero non-manifold edges — but nothing in
the codebase verifies it, and the tests only assert "watertight-looking".

**Change.** Add `auditManifold(geometry)` to the kernel: count edge
occurrences and report boundary edges (a hole) and non-manifold edges (a
fold). Run it on the export build and surface the result in the export toast
and the Node Graph panel.

**Verify.** A test asserts zero boundary edges for every pipeline step, and a
deliberately broken mesh reports a boundary.

### 8. The STL has no unit metadata

**Finding.** The binary STL header says "Unit: mm", but the STL format has
no unit field — every consumer assumes millimetres. That is fine for a
millimetre model, but the app also has a `generateSTEP` path and a FluidCAD
script that carry units explicitly, so the STL should be consistent and
documented rather than relying on a comment.

**Change.** Keep the millimetre contract, state it in the README's export
section, and put the model scale in the file name.

**Verify.** Documented in the README; the export toast already names the file.

---

## P2 — Performance

### 9. The mesh rebuild blocks the main thread

**Finding.** `buildLampShadeGeometry` at the default 168 × 112 resolution takes
**18.9 ms** per rebuild, and it runs on every slider input, on the main
thread, inside a Command. At 60 Hz that is a visible stutter on every drag.

**Change.** Two steps, in order of value:

1. **Coalesce.** Mark the viewport dirty in the Command and apply the rebuild
   in the existing animation frame, so a fast drag rebuilds once per frame
   instead of once per input event.
2. **Budget it.** Rebuild at a lower resolution while a parameter is being
   dragged, and at full resolution when it settles.

**Verify.** A browser profile shows the frame budget respected during a drag.
A test asserts that N input events in one frame produce one rebuild.

### 10. The initial patch is 632 ms

**Finding.** Foldkit reports `Slow patch: 632ms` on the first render. The
view is 1,022 lines and builds every panel, the HUD, and the 34 controls
eagerly, even though only one tab is visible.

**Change.** Render the inactive panels lazily. `createLazy` from
`foldkit/html` is already used for the memoised leaves; extend it to the
panel level so the Node Graph, Section, FluidCAD, TEA, and StyleX panels are
built only when their tab is selected.

**Verify.** The Foldkit slow-patch warning disappears. The scene tests still
pass, since they render one tab at a time.

### 11. The history lives in the Model and is copied on every update

**Finding.** `model.history` holds up to 40 `HistoryEntry` records, each with
a full `DesignParams` snapshot. Every `update` copies the array, and every
revision appends a snapshot. The Model is the single source of truth for the
view, so this is correct in principle, but it makes the Model large and the
diff noisy.

**Change.** Keep the history in the Model — it is what makes the TEA panel
and time travel work — but shrink the snapshot to only the fields that
differ, and lower `HISTORY_LIMIT` to 25. Foldkit's own DevTools already
provides a deeper, runtime-level history, so the in-app log only needs to
cover the recent past.

**Verify.** The TEA panel still restores a revision. A test asserts the
history is bounded.

### 12. `viewportSignature` stringifies the whole design on every message

**Finding.** `viewportSignature` runs `JSON.stringify` over the design and
seven other fields on every single message, including messages that cannot
possibly change the viewport — a tab switch, a history restore of the theme.

**Change.** Compare the fields directly instead of building a string. The
check is a field-by-field comparison, which is both faster and clearer.

**Verify.** A test asserts that a tab switch does not emit `SyncViewport`.

---

## P3 — Interaction and accessibility

### 13. The controls have no accessible names

**Finding.** The view uses zero `AriaLabel`, zero `h.Role`, and zero
`h.For`. The range inputs are visually labelled by a sibling `span`, but that
span is not programmatically associated, so a screen reader announces
"slider, 50%" with no indication of what it controls. The icon-only buttons
("Reset Cam") are worse.

**Change.** Give every range input an `AriaLabel` naming the parameter, and
an `AriaValueText` with the formatted value. Give the icon-only buttons a
label. The `foldkit/ui` package ships accessible primitives — `Slider` and
`Button` — that already do this; adopting them for the panel controls is
less work than hand-rolling the ARIA.

**Verify.** A scene test asserts each slider has an accessible name. An
automated axe pass reports no violations.

### 14. There is no keyboard path to the viewport

**Finding.** The 3D viewport is a bare canvas with hand-rolled mouse and
touch handlers. It cannot be reached by keyboard, the camera cannot be
orbited without a pointer, and the canvas has no accessible description.

**Change.** Use `OrbitControls` from `three/examples/jsm/controls`, which
handles pointer, touch, and keyboard, and add the `tabindex`, `role`, and
label the canvas needs. The hand-rolled orbit code in `Viewport3D.ts` (about
80 lines) goes away with it.

**Verify.** A browser check tabs to the canvas and orbits it with the arrow
keys.

### 15. Nothing persists between sessions

**Finding.** A reload loses the design. The Model has no serialisation, and
the app has no storage. A user who has tuned a shade has to redo it.

**Change.** Persist `DesignParams` to `localStorage` on change and restore it
on boot. A "Reset to defaults" action belongs beside it.

**Verify.** A browser check reloads and finds the design intact. A scene test
asserts the restore path.

### 16. There is no undo

**Finding.** The TEA panel restores a recorded revision, which is a form of
time travel, but there is no undo of the last action and no keyboard
shortcut for it.

**Change.** `Ctrl+Z` restores the previous revision, `Ctrl+Shift+Z` moves
forward. The history already holds what is needed.

**Verify.** A story test asserts the shortcut produces the expected revision.

---

## P4 — Structure and the agent surface

### 17. `view.ts` and `styles.ts` are both very large

**Finding.** `view.ts` is 1,022 lines and `styles.ts` is 886. Both hold more
than one concern. The StyleX conventions say a file that has grown large is
evidence a seam has formed.

**Change.** Split the view by panel, following the pattern the codebase
already uses for `NodeBuilder` and `SectionViewer`: `src/components/ParamsPanel.ts`,
`src/components/CodePanel.ts`, `src/components/TeaPanel.ts`,
`src/components/StylexPanel.ts`, and a `src/components/Viewport.ts` for the
canvas and its overlays. Split the styles the same way, one file per panel.

**Verify.** Each new file has a single reason to change. The scene tests
still cover every panel.

### 18. The agent contract cannot read the design

**Finding.** The contract exposes 14 capabilities, all of them writes. An
agent can set a parameter but cannot ask what the current design is. The
`design` resource exists in `contract.ts` but is not in `agent.json`'s
capability list and is not served over stdio.

**Change.** Make the resource reachable: the MCP adapter already maps
resources, so verify it is served, and add a read-only capability for the
constraint report, so an agent can check printability before exporting.

**Verify.** The MCP server responds to a resource read with the current
design.

### 19. The agent contract has no completion contracts

**Finding.** Every capability dispatches and returns. `RequestedStlExport`
resolves when the Message is accepted, not when the STL is written, so an
agent cannot tell whether the export succeeded. The `CompletedStlExport` and
`FailedStlExport` Messages already exist and are exactly the correlated facts
a completion contract needs.

**Change.** Declare the completion on the export capabilities, so the agent
call resolves on `CompletedStlExport` and fails on `FailedStlExport`.

**Verify.** An MCP call to `export_stl` returns the triangle count.

### 20. Three StyleX tokens and one style are unused

**Finding.** `surfacePanel`, `radiusSmall`, and `radiusLarge` are defined and
never referenced. The `muted` style is defined and never used.

**Change.** Delete them, or use them where the hard-coded values they
replace are still inline.

**Verify.** A check that every declared token and style is referenced.

---

## P5 — Consistency with Foldkit's conventions

### 21. The codebase uses `for` loops in 26 places

**Finding.** `FOLDKIT.md` says: "Never use `for` loops or `let` for
iteration. Reach for `Array.map`, `Array.filterMap`, `Array.makeBy`,
`Array.reduce`." Most of the loops are in the CAD kernel, where they index
into parallel vertex arrays and are genuinely clearer as loops.

**Change.** Convert the loops that iterate a collection to the Effect
`Array` helpers. Keep the indexed loops in the mesh builder — they walk
parallel arrays by index — and say so in a short note, so the deviation is
deliberate and visible rather than accidental.

**Verify.** The remaining `for` loops are only the indexed mesh walks.

### 22. `switch` is used in four places

**Finding.** `FOLDKIT.md` says to use `Message.match` for exhaustive matching
and Effect `Match` otherwise, and never `switch`. Four `switch` statements
remain, including one over `mainTab` in the view.

**Change.** Convert the tag switches to `Message.match` or Effect `Match`.
The `mainTab` switch becomes a `defineTaggedUnion` over the tab, which also
makes the tab type exhaustive by construction.

**Verify.** No `switch` remains outside the mesh builder.

---

## Suggested order

**First pass — correctness (1–5).** The theme switcher and the node graph
both promise behaviour they do not deliver. Both are small, and both are
visible the moment the app opens.

**Second pass — output fidelity (6–8).** The STEP export and the manifold
claim are the difference between a demo and a tool. A real
`MANIFOLD_SOLID_BREP` and an actual manifold check are the two things that
make the export trustworthy.

**Third pass — performance (9–12).** The 18.9 ms rebuild is felt on every
drag. The lazy panels and the coalesced rebuild together take the app from
"noticeably janky" to "smooth", and the initial patch from 632 ms to
imperceptible.

**Fourth pass — interaction (13–16).** Accessibility and keyboard support
are table stakes; persistence and undo are what make a modelling tool
usable across a session.

**Fifth pass — structure and conventions (17–22).** Splitting the large
files makes the next set of changes easier, and the convention cleanups are
mechanical.

---

## What is already solid

Worth keeping as-is, because the plan does not touch it:

- The TEA architecture is clean. The Model is a Schema, the update is pure,
  and every side effect is a Command. `SyncViewport` is only emitted when the
  viewport slice actually changed, which is the right instinct.
- The Three.js scene is owned by a `Mount.defineStream`, so the runtime
  releases the WebGL context on unmount. That is the correct seam.
- The CAD kernel produces genuinely watertight geometry at every pipeline
  step — zero boundary edges, zero non-manifold edges, verified by probe.
- The agent surface works end to end. An agent can read the live Model,
  dispatch Messages, and trigger a real export through the DevTools MCP
  bridge.
- StyleX compiles to 187 atomic rules with no runtime injection, and the
  build is clean.
