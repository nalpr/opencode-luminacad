# Project Review — LuminaCAD Studio Pro

A review of the tree at `541cdc6`. Unlike `IMPROVEMENT_PLAN.md`, which proposes
work, this document records what I actually ran and measured. Every finding
below has a reproduction.

## Verdict

The application is real and it runs. The TEA architecture is clean, the scene
mounts and renders, the agent loop drives the live Model, and the default
export writes a correctly sized 76,496-triangle STL. `bun run typecheck`,
`bun run test` (53/53), and `bun run build` all pass.

But the app describes itself as a CAD exporter, and the two claims that matter
most for an exporter — **watertight** and **printable** — do not hold in the
general case:

- Every generated mesh has **inward-facing normals** (signed volume is
  negative at every pipeline step).
- One of the four fitter types, **Solid LED Base**, exports a mesh with **256
  boundary edges** while the button says "Export manifold".
- The printability audit checks the **profile curve**, not the **relief**, so
  it reports 10.8° max overhang and "printable" for surfaces that actually
  reach **65–73°**.
- Its wall check reads the **slider value**, not the mesh; the "smooth bore"
  mode produces walls from **1.08 mm to 5.58 mm** while the UI says 1.8 mm.
- The STEP button writes a **1,238-byte** file with no geometry.

Everything else is a normal amount of rough edge for a first release.

---

## What I ran

| Check | Result |
| --- | --- |
| `bun run typecheck` | exit 0 |
| `bun run test` | 53/53 in 5 files |
| `bun run build` | exit 0, 3 chunks (app 80 kB, foldkit 296 kB, three 515 kB) |
| Dev server, Chromium | live canvas, 33 buttons, 0 console errors |
| Production preview | live canvas, 0 console messages |
| WebGL diagnostics | 76,496 tris, 11 draw calls, 7 programs, no context loss |
| STL export (browser) | `luminacad_helical_flutes_200mm.stl`, 3,824,884 bytes |
| STEP export (browser) | `luminacad_helical_flutes_200mm.step`, 1,238 bytes |
| Manifold probe, all 4 fitters × steps 4/7/8 | see below |
| Overhang probe, 7 patterns | see below |

---

## P0 — the export is not what it says it is

### 1. Every mesh is inside-out

**Evidence.** The signed volume of the mesh, computed from the winding
(`Σ a·(b×c)/6`), is negative at every step:

```
step 3  -3340.7 cm³
step 4    -48.5 cm³
step 5    -56.9 cm³
step 6   -223.2 cm³
step 7   -218.8 cm³
step 8   -218.8 cm³
```

A unit cube wound outward gives **+1.0000** under the same formula, so the
convention is not the problem. The shade is wound clockwise.

The STL writer uses `(c−b) × (a−b)`, which equals the winding normal
`(b−a) × (c−a)`, so the **facet normals in the exported STL point inward**.
Three.js hides this because the shade material is `DoubleSide` and the shader
flips the normal on back faces; the STL has no such rescue.

**Where.** `src/cad/kernel.ts:252-262` (index order) and
`src/cad/exporters.ts:62-64` (normal).

**Impact.** Most slicers auto-repair normals by ray parity, so it often prints
anyway — but mesh validators, some slicers, and any downstream CAD consumer see
an inverted solid. It is one index-order flip.

### 2. `solid_base` is not watertight

**Evidence.** Boundary edge count (edges used by exactly one triangle):

```
fitter        step 4   step 7   step 8
bottom_ring        0        0        0
top_spider         0        0        0
solid_base         0      256      256
none               0        0        0
```

The Solid LED Base floor is built from two sets of vertices at identical
positions — `bottomRing`/`sideBottomRing` and `topRing`/`sideTopRing`
(`src/cad/kernel.ts:329-337`) — and the side wall is never welded to its own
caps. The result is four open rings (4 × 64 = 256 boundary edges) plus 128
coincident duplicate vertices.

**Impact.** Selecting "Solid LED Base" and pressing the button literally
labelled **Export manifold .STL** produces a file that is not manifold.

### 3. With a fitter, the export is several disconnected shells

**Evidence.** Connected components in the step-8 mesh:

```
bottom_ring  6 components  (shade + ring + 4 spokes)
top_spider   6 components
solid_base   4 components
none         1 component
```

Each component is closed, so the edge-manifold test passes, but the file is a
union of intersecting bodies rather than one solid. That is usually tolerated
by slicers, but it is not the "manifold solid" the README and UI claim.

**Where.** `src/cad/kernel.ts:290-302` appends the fitter without a boolean
union.

### 4. "Smooth inner bore" does not hold the wall it reports

**Evidence.** Actual wall across the surface at the default 168 × 112
resolution:

```
innerWallMode   wall min   wall max
smooth             1.08 mm   5.58 mm
follow             1.80 mm   1.80 mm
```

The mode is computed as `rInner = min(rOuter − 0.8, max(5, baseRadius − 0.6·t))`
(`src/cad/kernel.ts:227-231`), so the outer relief adds to the wall while the
bore follows the *base* profile. Every readout — telemetry, audit, preset
panel — reports the input `wallThickness` (1.8 mm), not either number above.

The UI also labels `smooth` as **"Lithophane thickness glow"** and `follow` as
"Uniform offset shell". It is the other way round: `follow` is the constant
1.8 mm wall a lithophane needs; `smooth` is the variable one.

**Where.** `src/cad/kernel.ts:227-231`, `src/view.ts:470-473`.

### 5. The nozzle-multiple check false-positives on exact multiples

**Evidence.** `design.wallThickness % 0.4 > 1e-6` in
`src/cad/constraints.ts:68`. Floating-point modulo:

```
0.8 % 0.4 = 0                    → pass
1.2 % 0.4 = 0.3999999999999999   → FAIL (should pass)
1.6 % 0.4 = 0                    → pass
2.0 % 0.4 = 0.3999999999999999   → FAIL (should pass)
2.4 % 0.4 = 0.3999999999999998   → FAIL (should pass)
2.8 % 0.4 = 0.3999999999999997   → FAIL (should pass)
```

Four of the seven multiples a user can pick with the slider are reported as
non-multiples. Use a ratio test:
`Math.abs(t / NOZZLE_MM − Math.round(t / NOZZLE_MM)) > 1e-6`.

### 6. The overhang audit does not look at the relief

**Evidence.** With `patternDepth: 6`, `twistAngle: 240`, the audit reports the
same **10.8°** for every pattern and `printable: true`. The actual surface
overhang, sampled over θ and the full height:

```
flutes      65.4°
diamond     50.5°
waves       72.8°
cellular    63.1°
lattice     60.1°
moire       53.0°
origami     62.5°
```

**Where.** `src/cad/constraints.ts:76-90` walks `sampleProfile`, which is
`profileRadius` only. The relief lives in `patternOffset` and is never
consulted.

**Impact.** The audit green-lights designs that need support — the one thing a
printability panel exists to prevent.

### 7. `minimumWall` is silently NaN and falls back to the slider value

**Evidence.** `auditPrintability` reports `minimumWall: 2` for a design whose
`wallThickness` is `2.0` — because the computed value is `NaN` and the result
falls back to `design.wallThickness` (`src/cad/constraints.ts:146`).

**Cause.** The reduce calls `profileRadius(design, point.v − 0.01)`
(`src/cad/constraints.ts:37-40`). At `v = 0` that is a **negative** `v`, and
`profileRadius` evaluates `Math.pow(arch, 1.1)` with `arch < 0`
(`src/cad/kernel.ts:34-36`), which is `NaN`. One `NaN` poisons the reduce.

Even without the NaN, the expression is the *derivative of the radius*, not
the wall thickness; it has no relationship to `wallThickness`.

### 8. The "Build Vol" readout is wrong twice

**Evidence.** Telemetry shows `4.44 cm³` (`src/view.ts:917`). The value is

```
(2R)² · H / 1e6 = 149² · 200 / 1e6 = 4.44
```

which is a **bounding-box volume in litres**, not cubic centimetres, and not
the material. The bounding box is 4,440 cm³; the actual material is ~220 cm³.

`meshStatistics` (`src/cad/kernel.ts:448-470`) computes the right quantity —
`2π·r·h·wall / 1000` in cm³ — and is never called.

### 9. The bounds readout is not a diameter

**Evidence.** The HUD shows `Ø250 × 200 mm` for a shade whose bottom is
Ø140 and whose top is Ø110. `src/view.ts:914` computes
`(bottomRadius + topRadius) · 2`, i.e. the sum of the two radii doubled.
The Section panel gets this right (separate bottom/top Ø).

---

## P1 — behaviour the UI promises and does not deliver

### 10. The theme switcher changes nothing visible

**Evidence.** Clicking **CAD Cyan** in the live app:

```
--sx-accent after click : #f59e0b   (unchanged)
body says "active theme: CAD Cyan"  (the Model did change)
```

The panel prints `.x-accent { color: #06b6d4 }` as **text**
(`src/view.ts:675`); it never applies it. The StyleX tokens are compile-time
constants, and `--sx-accent` in `src/styles.css:8` is a separate variable that
nothing writes.

The active card is also hard-coded: only the Solar Amber button carries
`styles.presetCardActive` (`src/view.ts:616`); the other three never do, so the
highlight never moves.

### 11. The node graph does not jump to the step

**Evidence.** The panel says "Click a node to jump to the matching construction
step" (`src/components/NodeBuilder.ts:177`). Clicking the `param()` node in the
live app:

```
before STEP 6/8
after  STEP 6/8
TEA log: SelectedNode "Selected node param"
```

`SelectedNode` only writes `selectedNodeId` (`src/foldkit/engine.ts:409-411`).
The SVG node rectangles are not clickable at all — only the small text buttons
under the graph dispatch anything (`NodeBuilder.ts:207-276` has no `OnClick`).

### 12. Pausing Auto-Walk rewinds to step 1

**Evidence.**

```
{ activeStep: 5, isPlayingSteps: true }
  + ToggledStepPlayback
→ activeStep 1, isPlayingSteps false
```

`engine.ts:311-316` uses `model.isPlayingSteps ? 1 : model.activeStep` — the
condition is true on pause, so pause jumps to the base. It should leave the
step alone.

### 13. Time travel restores the geometry but not the preset identity

**Evidence.**

```
apply cyberpunk_hex → revision A
apply origami_cone
restore revision A
→ pattern = lattice        (correct)
→ presetName = "Origami Cone"   (stale)
→ presetId   = "origami_cone"   (stale, wrong card highlighted)
```

`RestoredRevision` (`engine.ts:463-491`) restores the 21 `DesignParams` fields
but not `presetId`/`presetName`.

### 14. The HUD overlaps the viewport toggles

**Evidence.** Measured in the live app at 800 × 873:

```
HUD      x 12  → 460,  y 97 → 215
toggles  x 421 → 788,  y 97 → 134
overlap: true
```

The HUD is `left:12px; max-width:28rem` (448 px) and the toggles are
`right:12px` with no left constraint and no wrapping (`src/style/styles.ts`).
At the default desktop split the viewport is only ~549 px wide, so they collide
on every load; the screenshot shows the toggle bar sitting on top of the
`STEP 8/8` card. This is the most visible defect in the product.

### 15. `bulbKelvin` is dead state

Declared in the Model and initialised to 2700 (`src/state.ts:121, 174`),
included in `PARAM_KEYS`, and read by nothing. The bulb is fixed at
`0xffaa44` / `0xffb454`.

### 16. `AppliedPreset` ignores three preset fields

`engine.ts:343-345` copies `socketDiameter` and `spokeCount` but not
`socketRingWidth`, `spokeThickness`, or `spokeWidth`, even though every preset
defines them. All six currently share the same values, so it is latent, not
visible — but a new preset with a wider ring will silently not apply.

---

## P2 — robustness and the agent surface

### 17. The agent can write NaN and out-of-range values

**Evidence.**

```
UpdatedParam({ key: "height", value: "abc" })  → height = NaN
UpdatedParam({ key: "wallThickness", value: -5 }) → wallThickness = -5
```

`UpdatedParam` does `Number(value)` with no `Number.isFinite` check and no
range clamp (`engine.ts:318-326`). The contract exposes `update_param` to
agents (`src/agent/contract.ts:74-78`), and `value` is `Union(Number, String,
Boolean)`, so `"abc"` is accepted by the schema. A `NaN` height produces a
degenerate mesh and an STL full of NaNs.

The UI cannot do this — the range input is bounded — but the agent path can.

### 18. The stdio MCP server drops every Command

**Evidence.** `createHeadlessHost` (`src/agent/server.ts:33-37`):

```ts
dispatch: (message) => {
  const result = update(current, message)
  current = result.model
  notify()
}
```

`result.commands` is discarded. So through `bun run agent`:

- `export_stl` returns the model update but never runs `ExportBinaryStl`, so
  there is no file and no `CompletedStlExport`.
- `export_step` behaves the same.
- `SyncViewport` is irrelevant headless, so that one is harmless.

Even if the Command ran, `exportBinaryStl` calls `downloadBuffer`, which uses
`document`, and this host runs in Node.

`currentModel: Effect.succeed(current)` on line 44 also captures the **initial**
model at construction and never updates; `foldkit-agent` does not read it, so
it is dead and misleading.

The browser path (DevTools MCP) does work — that is the one that should be
documented as the export path.

### 19. The viewport mount hard-codes the default design

`Viewport3D.ts:562-601` builds a literal copy of `initialModel` instead of
reading the Model. `MountViewport` has no Model access, and
`SucceededMountViewport` is internal, so no `SyncViewport` follows it. It works
today only because the literal matches `initialModel` exactly. Restore,
persistence, or a changed default will silently render the wrong model until
the next viewport-affecting message.

### 20. The render loop never idles

`Viewport3D.ts:511-516` runs `requestAnimationFrame` unconditionally, rendering
every frame forever, even when the camera is still and the mesh has not
changed. For a mostly static CAD scene this is a constant GPU/CPU cost and a
laptop-battery tax. Render on demand (camera move, resize, `applyState`) and
stop the loop when idle.

### 21. Accessibility is absent

**Evidence.** In the live app: `document.querySelectorAll('[aria-label]')` → **0**.

- The 14 range inputs are labelled only by a sibling `span`
  (`src/view.ts:217-241`), with no `aria-label`, `aria-labelledby`, or `for`.
- Icon-only controls ("Reset Cam") have text, but the canvas has no role or
  label.
- `index.html:5` sets `maximum-scale=1.0, user-scalable=no`, which blocks zoom.
- The canvas is pointer- and touch-only; there is no keyboard orbit.

Foldkit's `foldkit/ui` has accessible `Slider`/`Button` primitives; using them
is less work than hand-rolling the ARIA.

---

## P3 — repository and build

### 22. CI never runs

`.github/workflows/deploy.yml:5` triggers on `main`; the repository branch is
`master`. Nothing is deployed until the branch is renamed or the trigger
changed. There is also no remote configured, so nothing has been pushed.

### 23. The STEP export is a stub

**Evidence.** The downloaded file is **1,238 bytes** while the STL is
3,824,884 bytes. `buildStepScript` (`exporters.ts:112-147`) emits a valid
ISO-10303-21 envelope with three `CARTESIAN_POINT`s at the origin and no
`ADVANCED_FACE`, `CLOSED_SHELL`, or `MANIFOLD_SOLID_BREP`. The button sits
beside the STL as if it were an equivalent solid.

Either write a real B-rep over the triangulated mesh, or rename the button to
what it is ("Copy .part.js" / "Export script") so the two exports are not
presented as peers.

### 24. `meshStatistics` is dead

`src/cad/kernel.ts:448-470` computes a correct material volume, filament grams,
and filament metres. Nothing calls it; the UI uses the wrong `buildVolumeUsed`
instead. This is the one place a "filament estimate" feature already exists.

### 25. Deprecated Vite option

`vite.config.ts:33` uses `advancedChunks`, which Vite 8 warns is deprecated in
favour of `codeSplitting`. The build succeeds with a warning.

### 26. `src/update.ts` is still missing

The original layout named `src/update.ts`; the update lives in
`src/foldkit/engine.ts`. `AGENTS.md` now documents the current layout, so this
is a documentation/spec mismatch rather than a defect — but the brief and the
tree disagree.

---

## Measurements at a glance

| Quantity | Reported / claimed | Actual |
| --- | --- | --- |
| Mesh orientation | manifold solid | signed volume negative at every step |
| Solid LED Base | watertight | 256 boundary edges, 128 duplicate verts |
| Shade + fitter | one solid | 6 shells (bottom_ring/top_spider), 4 (solid_base) |
| Wall (smooth bore) | 1.8 mm | 1.08 – 5.58 mm |
| Wall (follow bore) | 1.8 mm | 1.80 mm |
| Max overhang (6 mm relief) | 10.8°, printable | 50.5 – 72.8° |
| Nozzle multiple | 2.0 mm fails | 2.0 mm is 5 × 0.4 |
| Build volume | 4.44 cm³ | 4,440 cm³ bounding box, ~220 cm³ material |
| Bounds | Ø250 × 200 | Ø140 bottom, Ø110 top |
| STEP file | model export | 1,238 bytes, no geometry |
| STL file | 76,496 tris | 3,824,884 bytes = 84 + 76,496 × 50 |

---

## What is genuinely good

- **The TEA seam is clean.** `update` is pure, the Model is a Schema,
  `modifyFields` is used consistently, and side effects are Commands.
  `SyncViewport` is only emitted when the viewport slice changed.
- **The scene lifecycle is right.** `Mount.defineStream` owns the WebGL
  context and `dispose()` releases geometry, renderer, and listeners.
- **The mesh is edge-manifold for three of four fitters**, at every pipeline
  step — the kernel is closer to correct than the audit suggests.
- **The STL writer is exactly right on size and normal math**; the only defect
  is the inherited winding.
- **The agent surface is a real projection of the Message union**, not a
  parallel API. The DevTools MCP loop (`AppliedPreset`, `UpdatedParam`,
  `RequestedStlExport`) drives the live app and really exports.
- **StyleX is properly compiled**, not runtime-injected; 187 atomic rules, no
  console errors in production.
- **The tests are real integration tests** through `foldkit/story` and
  `foldkit/scene`, not mock-heavy unit tests.

---

## Suggested fix order

**One afternoon, highest value first:**

1. Flip the index winding (finding 1) — one change, fixes every export.
2. Weld the Solid LED Base rings (finding 2) — makes the manifold button true
   for all fitters.
3. Fix the nozzle ratio test (finding 5) and the `minimumWall` NaN (finding 7)
   — two small pure functions.
4. Make the audit sample the relief for overhang (finding 6) — turns the panel
   from decorative into useful.
5. Use `meshStatistics` for the telemetry volume and fix the two readouts
   (findings 8, 9).
6. Fix the HUD/toggle overlap (finding 14) — a layout constraint, visible on
   every load.

**Then the promises:**

7. Make the theme write `--sx-accent` and select the active card (finding 10).
8. Make `SelectedNode` set `activeStep` and make the SVG nodes clickable
   (finding 11).
9. Leave the step alone on pause (finding 12).
10. Restore `presetId`/`presetName` with a revision (finding 13).

**Then the surfaces:**

11. Validate and clamp agent-written parameters (finding 17).
12. Either implement the stdio export or document the DevTools path as the
    only one that exports (finding 18).
13. Accessibility pass on sliders and the canvas (finding 21).
14. Rename the STEP button or emit a real B-rep (finding 23).

---

## Appendix — how to reproduce

```bash
# build and runtime
bun run typecheck && bun run test && bun run build
bun run dev    # http://localhost:5173/opencode-luminacad/

# manifold / winding / components / wall / overhang probes
# (each was a throwaway script under the repo root, run with `bun run`)
bun -e '...'   # see the measurements above
```

The probes build the geometry directly from `src/cad/kernel.ts` and count edge
incidence, connected components, signed volume, and sampled wall thickness. The
browser checks used the DevTools bridge and the in-app `globalThis.luminacad`
diagnostics surface.
