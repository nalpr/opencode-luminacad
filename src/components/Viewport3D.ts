import { Effect, Stream } from 'effect'
import { Mount } from 'foldkit'
import * as THREE from 'three'

import type { Message } from '../foldkit/messages'
import { Message as MessageUnion } from '../foldkit/messages'
import type { DesignParams } from '../state'
import { buildLampShadeGeometry, profileRadius } from '../cad/kernel'

export interface ViewportState {
  readonly design: DesignParams
  readonly activeStep: number
  readonly radialSegments: number
  readonly heightSegments: number
  readonly bulbOn: boolean
  readonly bulbIntensity: number
  readonly filamentColor: string
  readonly wireframe: boolean
  readonly cutaway: boolean
  readonly showDatumHelpers: boolean
}

export interface ViewportStats {
  readonly triangles: number
  readonly vertices: number
}

export interface ViewportDiagnostics {
  readonly triangles: number
  readonly vertices: number
  readonly drawCalls: number
  readonly programs: number
  readonly geometries: number
  readonly textures: number
  readonly contextLost: boolean
}

export interface ViewportHandle {
  readonly update: (state: ViewportState) => void
  readonly resetCamera: () => void
  readonly dispose: () => void
  readonly diagnostics: () => ViewportDiagnostics
}

interface ViewportInternals {
  readonly renderer: THREE.WebGLRenderer
  readonly scene: THREE.Scene
  readonly camera: THREE.PerspectiveCamera
  readonly container: HTMLElement
  readonly shadeMesh: THREE.Mesh
  readonly wireframeMesh: THREE.Mesh
  readonly bulbGroup: THREE.Group
  readonly bulbPointLight: THREE.PointLight
  readonly bulbGlowMesh: THREE.Mesh
  readonly studioLight: THREE.DirectionalLight
  readonly datumGroup: THREE.Group
  readonly clipPlane: THREE.Plane
  readonly orbit: {
    theta: number
    phi: number
    radius: number
    target: THREE.Vector3
    dragging: boolean
    panning: boolean
    previousX: number
    previousY: number
    pinchDistance: number
  }
}

const internals = new WeakMap<HTMLElement, ViewportInternals>()
const handles = new Map<HTMLElement, ViewportHandle>()

const DEFAULT_ORBIT = {
  theta: Math.PI * 0.22,
  phi: Math.PI * 0.37,
  radius: 375,
}

const updateCameraTransform = (viewport: ViewportInternals): void => {
  const { camera, orbit } = viewport
  const sinPhi = Math.sin(orbit.phi)
  const cosPhi = Math.cos(orbit.phi)
  const sinTheta = Math.sin(orbit.theta)
  const cosTheta = Math.cos(orbit.theta)
  camera.position.x = orbit.target.x + orbit.radius * sinPhi * sinTheta
  camera.position.y = orbit.target.y + orbit.radius * cosPhi
  camera.position.z = orbit.target.z + orbit.radius * sinPhi * cosTheta
  camera.lookAt(orbit.target)
}

const buildDatumHelpers = (
  viewport: ViewportInternals,
  state: ViewportState,
): void => {
  const { datumGroup } = viewport
  const design = state.design
  while (datumGroup.children.length > 0) {
    const child = datumGroup.children[0]
    datumGroup.remove(child)
    if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
      child.geometry.dispose()
    }
  }

  if (!state.showDatumHelpers && state.activeStep === 8) return

  const maxRadius =
    Math.max(design.bottomRadius, design.topRadius) + design.patternDepth

  const axisGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, -10, 0),
    new THREE.Vector3(0, design.height + 20, 0),
  ])
  datumGroup.add(
    new THREE.Line(axisGeometry, new THREE.LineBasicMaterial({ color: 0xf43f5e })),
  )

  const planeWidth = maxRadius * 1.15
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(planeWidth, design.height + 16),
    new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: state.activeStep === 2 ? 0.16 : 0.05,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  )
  plane.position.set(planeWidth * 0.5, design.height * 0.5, 0)
  datumGroup.add(plane)

  const profilePoints: Array<THREE.Vector3> = []
  for (let j = 0; j <= 60; j++) {
    const v = j / 60
    profilePoints.push(
      new THREE.Vector3(profileRadius(design, v), v * design.height, 0),
    )
  }
  if (state.activeStep === 2 || state.activeStep === 3) {
    profilePoints.push(new THREE.Vector3(0, design.height, 0))
    profilePoints.push(new THREE.Vector3(0, 0, 0))
    profilePoints.push(new THREE.Vector3(profileRadius(design, 0), 0, 0))
  }
  datumGroup.add(
    new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(profilePoints),
      new THREE.LineBasicMaterial({ color: 0x22d3ee }),
    ),
  )

  const knotGeometry = new THREE.SphereGeometry(
    state.activeStep === 2 ? 3.2 : 2.2,
    16,
    16,
  )
  const knotMaterial = new THREE.MeshBasicMaterial({ color: 0xf59e0b })
  const knots = [
    { v: 0, r: profileRadius(design, 0) },
    { v: design.waistPos, r: profileRadius(design, design.waistPos) },
    { v: 1, r: profileRadius(design, 1) },
  ]
  for (const knot of knots) {
    const mesh = new THREE.Mesh(knotGeometry, knotMaterial)
    mesh.position.set(knot.r, knot.v * design.height, 0)
    datumGroup.add(mesh)
  }

  if (state.activeStep === 1) {
    const envelope = new THREE.CylinderGeometry(
      design.topRadius,
      design.bottomRadius,
      design.height,
      32,
      1,
      true,
    )
    const edges = new THREE.LineSegments(
      new THREE.EdgesGeometry(envelope),
      new THREE.LineBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.45,
      }),
    )
    envelope.dispose()
    edges.position.y = design.height * 0.5
    datumGroup.add(edges)
  }

  if (
    state.activeStep === 5 ||
    (state.activeStep === 6 && state.showDatumHelpers)
  ) {
    const helixPoints: Array<THREE.Vector3> = []
    const twistTotal = (design.twistAngle * Math.PI) / 180
    for (let j = 0; j <= 80; j++) {
      const v = j / 80
      const theta = -twistTotal * v * 0.15
      const radius = profileRadius(design, v) + design.patternDepth + 1.2
      helixPoints.push(
        new THREE.Vector3(
          radius * Math.cos(theta),
          v * design.height,
          radius * Math.sin(theta),
        ),
      )
    }
    datumGroup.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(helixPoints),
        new THREE.LineBasicMaterial({ color: 0xf59e0b }),
      ),
    )
  }
}

const createViewport = (
  container: HTMLElement,
  canvas: HTMLCanvasElement,
): ViewportInternals => {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x05080c)

  const camera = new THREE.PerspectiveCamera(
    40,
    container.clientWidth / Math.max(1, container.clientHeight),
    1,
    2500,
  )

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  })
  renderer.setSize(container.clientWidth, container.clientHeight, false)
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.localClippingEnabled = true

  scene.add(new THREE.AmbientLight(0x94a3b8, 0.45))

  const studioLight = new THREE.DirectionalLight(0xffffff, 0.7)
  studioLight.position.set(190, 320, 230)
  scene.add(studioLight)

  const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.35)
  rimLight.position.set(-200, 140, -180)
  scene.add(rimLight)

  const bulbGroup = new THREE.Group()
  const bulbPointLight = new THREE.PointLight(0xffaa44, 1.6, 700, 1.5)
  bulbPointLight.position.set(0, 95, 0)
  bulbGroup.add(bulbPointLight)

  const bulbGlow = new THREE.Mesh(
    new THREE.SphereGeometry(17, 24, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd27d }),
  )
  bulbGlow.position.set(0, 95, 0)
  bulbGroup.add(bulbGlow)

  const bulbBase = new THREE.Mesh(
    new THREE.CylinderGeometry(13, 13, 25, 24),
    new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.4,
      metalness: 0.7,
    }),
  )
  bulbBase.position.set(0, 68, 0)
  bulbGroup.add(bulbBase)
  scene.add(bulbGroup)

  const grid = new THREE.GridHelper(260, 26, 0x06b6d4, 0x162032)
  grid.position.y = -0.2
  scene.add(grid)

  const datumGroup = new THREE.Group()
  scene.add(datumGroup)

  const shadeMesh = new THREE.Mesh(
    new THREE.BufferGeometry(),
    new THREE.MeshStandardMaterial({
      color: 0xfff8eb,
      roughness: 0.42,
      metalness: 0.06,
      vertexColors: true,
      side: THREE.DoubleSide,
    }),
  )
  scene.add(shadeMesh)

  const wireframeMesh = new THREE.Mesh(
    new THREE.BufferGeometry(),
    new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      wireframe: true,
      transparent: true,
      opacity: 0.25,
    }),
  )
  scene.add(wireframeMesh)

  const viewport: ViewportInternals = {
    renderer,
    scene,
    camera,
    container,
    shadeMesh,
    wireframeMesh,
    bulbGroup,
    bulbPointLight,
    bulbGlowMesh: bulbGlow,
    studioLight,
    datumGroup,
    clipPlane: new THREE.Plane(new THREE.Vector3(0, 0, -1), 0),
    orbit: {
      theta: DEFAULT_ORBIT.theta,
      phi: DEFAULT_ORBIT.phi,
      radius: DEFAULT_ORBIT.radius,
      target: new THREE.Vector3(0, 95, 0),
      dragging: false,
      panning: false,
      previousX: 0,
      previousY: 0,
      pinchDistance: 0,
    },
  }

  internals.set(container, viewport)
  updateCameraTransform(viewport)
  return viewport
}

const attachControls = (viewport: ViewportInternals): (() => void) => {
  const canvas = viewport.renderer.domElement
  const { orbit } = viewport

  const onMouseDown = (event: MouseEvent): void => {
    orbit.dragging = true
    orbit.panning = event.button === 2 || event.shiftKey
    orbit.previousX = event.clientX
    orbit.previousY = event.clientY
  }
  const onMouseMove = (event: MouseEvent): void => {
    if (!orbit.dragging) return
    const dx = event.clientX - orbit.previousX
    const dy = event.clientY - orbit.previousY
    orbit.previousX = event.clientX
    orbit.previousY = event.clientY
    if (orbit.panning) {
      orbit.target.y = Math.max(0, Math.min(300, orbit.target.y + dy * 0.4))
    } else {
      orbit.theta -= dx * 0.007
      orbit.phi = Math.max(0.08, Math.min(Math.PI - 0.08, orbit.phi - dy * 0.007))
    }
    updateCameraTransform(viewport)
  }
  const onMouseUp = (): void => {
    orbit.dragging = false
  }
  const onContextMenu = (event: Event): void => {
    event.preventDefault()
  }
  const onWheel = (event: WheelEvent): void => {
    event.preventDefault()
    orbit.radius = Math.max(110, Math.min(900, orbit.radius + event.deltaY * 0.28))
    updateCameraTransform(viewport)
  }
  const onTouchStart = (event: TouchEvent): void => {
    if (event.touches.length === 1) {
      orbit.dragging = true
      orbit.previousX = event.touches[0].clientX
      orbit.previousY = event.touches[0].clientY
    } else if (event.touches.length === 2) {
      orbit.dragging = false
      orbit.pinchDistance = Math.hypot(
        event.touches[0].clientX - event.touches[1].clientX,
        event.touches[0].clientY - event.touches[1].clientY,
      )
    }
  }
  const onTouchMove = (event: TouchEvent): void => {
    if (event.touches.length === 1 && orbit.dragging) {
      const dx = event.touches[0].clientX - orbit.previousX
      const dy = event.touches[0].clientY - orbit.previousY
      orbit.previousX = event.touches[0].clientX
      orbit.previousY = event.touches[0].clientY
      orbit.theta -= dx * 0.008
      orbit.phi = Math.max(0.08, Math.min(Math.PI - 0.08, orbit.phi - dy * 0.008))
      updateCameraTransform(viewport)
    } else if (event.touches.length === 2) {
      const distance = Math.hypot(
        event.touches[0].clientX - event.touches[1].clientX,
        event.touches[0].clientY - event.touches[1].clientY,
      )
      const delta = orbit.pinchDistance - distance
      orbit.pinchDistance = distance
      orbit.radius = Math.max(110, Math.min(900, orbit.radius + delta * 0.8))
      updateCameraTransform(viewport)
    }
  }
  const onTouchEnd = (): void => {
    orbit.dragging = false
  }

  canvas.addEventListener('mousedown', onMouseDown)
  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
  canvas.addEventListener('contextmenu', onContextMenu)
  canvas.addEventListener('wheel', onWheel, { passive: false })
  canvas.addEventListener('touchstart', onTouchStart, { passive: true })
  canvas.addEventListener('touchmove', onTouchMove, { passive: true })
  canvas.addEventListener('touchend', onTouchEnd)

  return () => {
    canvas.removeEventListener('mousedown', onMouseDown)
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup', onMouseUp)
    canvas.removeEventListener('contextmenu', onContextMenu)
    canvas.removeEventListener('wheel', onWheel)
    canvas.removeEventListener('touchstart', onTouchStart)
    canvas.removeEventListener('touchmove', onTouchMove)
    canvas.removeEventListener('touchend', onTouchEnd)
  }
}

const applyState = (
  viewport: ViewportInternals,
  state: ViewportState,
): ViewportStats => {
  const geometry = buildLampShadeGeometry({
    design: state.design,
    activeStep: state.activeStep,
    radialSegments: state.radialSegments,
    heightSegments: state.heightSegments,
  })

  viewport.shadeMesh.geometry.dispose()
  viewport.shadeMesh.geometry = geometry
  viewport.wireframeMesh.geometry.dispose()
  viewport.wireframeMesh.geometry = geometry

  const material = viewport.shadeMesh.material as THREE.MeshStandardMaterial
  const baseColor = new THREE.Color(state.filamentColor)
  const warmBulb = new THREE.Color(0xffb454)

  if (state.activeStep <= 2) {
    material.transparent = true
    material.opacity = state.activeStep === 1 ? 0.12 : 0.22
    material.vertexColors = false
    material.color.setHex(0x06b6d4)
    material.emissive.setHex(0x000000)
    viewport.bulbGroup.visible = false
    viewport.studioLight.intensity = 0.35
  } else {
    material.transparent = false
    material.opacity = 1
    if (state.bulbOn && state.activeStep === 8) {
      material.vertexColors = true
      material.color.copy(baseColor).lerp(warmBulb, 0.35)
      material.emissive.copy(warmBulb).multiplyScalar(0.32 * state.bulbIntensity)
      viewport.bulbGroup.visible = true
      viewport.studioLight.intensity = 0.35
    } else {
      material.vertexColors = state.activeStep === 5 || state.activeStep === 7
      material.color.copy(baseColor)
      material.emissive.setHex(0x000000)
      viewport.bulbGroup.visible = false
      viewport.studioLight.intensity = 0.85
    }
  }

  const showCutaway = state.cutaway || state.activeStep === 4
  material.clippingPlanes = showCutaway ? [viewport.clipPlane] : []
  material.needsUpdate = true

  viewport.wireframeMesh.visible = state.wireframe || state.activeStep === 1

  const midHeight = state.design.height * 0.48
  viewport.bulbPointLight.position.y = midHeight
  viewport.bulbGlowMesh.position.y = midHeight
  viewport.bulbGroup.children[2].position.y = midHeight - 25
  viewport.bulbPointLight.intensity = state.bulbOn ? state.bulbIntensity : 0

  viewport.orbit.target.y = state.design.height * 0.48
  updateCameraTransform(viewport)

  buildDatumHelpers(viewport, state)

  const position = geometry.getAttribute('position')
  return {
    triangles: geometry.index ? geometry.index.count / 3 : 0,
    vertices: position ? position.count : 0,
  }
}

export const mountViewport = (
  container: HTMLElement,
  canvas: HTMLCanvasElement,
): Stream.Stream<
  | typeof MessageUnion.SucceededMountViewport.Type
  | typeof MessageUnion.FailedMountViewport.Type,
  never,
  never
> => {
  const viewport = createViewport(container, canvas)
  const detachControls = attachControls(viewport)

  let frame = 0
  const render = (): void => {
    frame = requestAnimationFrame(render)
    viewport.renderer.render(viewport.scene, viewport.camera)
  }
  frame = requestAnimationFrame(render)

  const onResize = (): void => {
    const width = container.clientWidth
    const height = Math.max(1, container.clientHeight)
    viewport.camera.aspect = width / height
    viewport.camera.updateProjectionMatrix()
    viewport.renderer.setSize(width, height, false)
  }
  window.addEventListener('resize', onResize)

  handles.set(container, {
    update: (state) => {
      applyState(viewport, state)
    },
    resetCamera: () => {
      viewport.orbit.theta = DEFAULT_ORBIT.theta
      viewport.orbit.phi = DEFAULT_ORBIT.phi
      viewport.orbit.radius = DEFAULT_ORBIT.radius
      updateCameraTransform(viewport)
    },
    diagnostics: () => {
      const info = viewport.renderer.info
      const position = viewport.shadeMesh.geometry.getAttribute('position')
      return {
        triangles: viewport.shadeMesh.geometry.index
          ? viewport.shadeMesh.geometry.index.count / 3
          : 0,
        vertices: position ? position.count : 0,
        drawCalls: info.render.calls,
        programs: info.programs?.length ?? 0,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
        contextLost: viewport.renderer.getContext().isContextLost(),
      }
    },
    dispose: () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', onResize)
      detachControls()
      viewport.shadeMesh.geometry.dispose()
      viewport.wireframeMesh.geometry.dispose()
      viewport.renderer.dispose()
    },
  })

  return Stream.fromEffect(
    Effect.sync(() => {
      const handle = handles.get(container)
      handle?.update({
        design: {
          profileType: 'bulbous',
          height: 200,
          bottomRadius: 70,
          topRadius: 55,
          wallThickness: 1.8,
          curvature: 0.35,
          waistPos: 0.45,
          fitterType: 'bottom_ring',
          socketDiameter: 40.5,
          socketRingWidth: 7,
          spokeCount: 4,
          spokeThickness: 5.5,
          spokeWidth: 6.5,
          patternType: 'flutes',
          radialFreq: 28,
          verticalFreq: 10,
          patternDepth: 4.5,
          twistAngle: 120,
          sharpness: 1.4,
          rimBorder: 8,
          innerWallMode: 'smooth',
        },
        activeStep: 8,
        radialSegments: 168,
        heightSegments: 112,
        bulbOn: true,
        bulbIntensity: 1.6,
        filamentColor: '#fff8eb',
        wireframe: false,
        cutaway: false,
        showDatumHelpers: true,
      })
      return MessageUnion.SucceededMountViewport()
    }),
  )
}

export const getViewportHandle = (
  container: HTMLElement,
): ViewportHandle | undefined => handles.get(container)

/**
 * A read-only diagnostic surface over the live viewport. It is how the
 * DevTools MCP bridge and the agent can confirm the WebGL scene is actually
 * rendering, without reaching into Three.js internals.
 */
export const viewportDiagnostics = (): ViewportDiagnostics | null => {
  const container = document.getElementById('viewport-container')
  if (!container) return null
  const handle = handles.get(container)
  return handle ? handle.diagnostics() : null
}

if (typeof globalThis !== 'undefined') {
  ;(globalThis as Record<string, unknown>)['luminacad'] = {
    diagnostics: viewportDiagnostics,
  }
}

export const disposeViewport = (container: HTMLElement): void => {
  const handle = handles.get(container)
  if (handle) {
    handle.dispose()
    handles.delete(container)
  }
}

export const MountViewport = Mount.defineStream('MountViewport', {
  messages: [MessageUnion.SucceededMountViewport, MessageUnion.FailedMountViewport],
  execute: ({ element }) => {
    const canvas = element as HTMLCanvasElement
    const container = canvas.parentElement ?? canvas
    return mountViewport(container, canvas)
  },
})

export type { Message }
