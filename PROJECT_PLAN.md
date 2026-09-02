# MedSecure PQC — Project Plan

**AI-Powered Post-Quantum Cryptography-Enabled Counterfeit Medicine Detection System**

A real-time, scroll-driven, interactive 3D landing page. Everything renders live in the browser via WebGL — no pre-rendered video, no imported model files, no Blender. Every 3D object is generated procedurally with Three.js geometry math at runtime.

---

## 1. Technical Architecture

### 1.1 Stack (versions verified against the npm registry on 2026-09-01)

| Layer | Package | Version | Role |
|---|---|---|---|
| Framework | `next` | 16.3.4 | App Router, RSC shell, build pipeline, image/font optimization |
| Runtime | `react` / `react-dom` | 19.2.8 | UI runtime (R3F 9 requires `>=19 <19.3`) |
| Language | `typescript` | 5.9.3 | Strict mode. **Pinned to 5.x deliberately** — TS 7 (native port) is not yet validated against the Next 16 + R3F toolchain |
| 3D core | `three` | 0.185.1 | WebGL renderer, geometry, materials |
| React renderer | `@react-three/fiber` | 9.7.0 | Declarative scene graph, `useFrame` render loop |
| Helpers | `@react-three/drei` | 10.7.8 | `PerformanceMonitor`, `AdaptiveDpr`, `Instances`, `Text`, `Environment`, `shaderMaterial` |
| Post FX | `@react-three/postprocessing` + `postprocessing` | 3.1.1 / ^6.36 | Bloom, chromatic aberration, vignette (desktop tiers only) |
| Animation | `gsap` | 3.15.0 | Timelines, easing, `ScrollTrigger` (bundled in core since v3.13) |
| Styling | `tailwindcss` | 4.3.3 | CSS-first config via `@theme`, no `tailwind.config.js` |
| Math utils | `maath` | 0.10.8 | Damped lerps, easing helpers for frame-rate-independent motion |

Dev-only: `eslint`, `eslint-config-next`, `prettier`, `@types/*`, `leva` (debug panel, tree-shaken out of production builds behind a `NEXT_PUBLIC_DEBUG` flag).

### 1.2 Rendering model

```
┌─────────────────────────────────────────────────────────┐
│  <body>                                                 │
│  ┌───────────────────────────────────────────────────┐  │
│  │ SceneCanvas  — position: fixed, inset 0, z-0      │  │
│  │  One <Canvas> for the whole page. Never remounts. │  │
│  │  Persistent WebGL context, one camera rig.        │  │
│  └───────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────┐  │
│  │ ContentLayer — position: relative, z-10           │  │
│  │  Normal scrolling DOM. ~800vh of <section>s that  │  │
│  │  are mostly empty; they exist to give the scroll  │  │
│  │  bar length and to host the typographic overlays. │  │
│  │  pointer-events: none except on interactive UI.   │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

**The single most important architectural rule:** scroll progress never enters React state. A `ScrollTrigger` writes to a plain mutable object (`scrollStore`); `useFrame` hooks read from it each frame. This means scrolling triggers **zero React re-renders** — only WebGL draw calls. React state is reserved for discrete, low-frequency events (act entered/exited, quality tier changed, menu open).

### 1.3 Data flow

```
window scroll
   │
   ▼
ScrollTrigger (single instance, scrub: true, normalizeScroll on touch)
   │
   ├──► scrollStore.progress  (0 → 1, raw)          ─┐
   ├──► scrollStore.velocity  (px/s, for FX)         │  read every frame
   └──► scrollStore.act       (0 → 7, discrete)     ─┘  by useFrame
   │
   ├──► (discrete change only) React setState → mounts/unmounts act components
   │
   └──► GSAP timeline (paused, scrubbed) → DOM overlay opacity/transform
```

A separate smoothed value `scrollStore.smooth` is produced inside `useFrame` with `maath/easing.damp` so camera motion is silky on trackpads and mouse wheels without a scroll-hijacking library.

### 1.4 Rendering/SSR strategy

- All 3D lives in `"use client"` components, dynamically imported with `{ ssr: false }`. The server renders the full text content and layout so the page is meaningful, SEO-indexable, and readable before WebGL boots.
- A lightweight CSS-only hero poster paints instantly; the canvas fades in over it when the first frame is drawn (`onCreated`).
- If `WebGLRenderingContext` is unavailable or `prefers-reduced-motion: reduce` is set, a **static fallback experience** renders: the same content with CSS gradients and no canvas. This is a real implementation, not a placeholder.

---

## 2. Folder Structure

```
medicine-pqc/
├── PROJECT_PLAN.md
├── README.md
├── next.config.ts
├── tsconfig.json                 # strict, paths: "@/*" → "./src/*"
├── postcss.config.mjs            # @tailwindcss/postcss
├── eslint.config.mjs
├── package.json
│
├── public/
│   └── favicon / og image (generated, no 3D assets — nothing is loaded at runtime)
│
└── src/
    ├── app/
    │   ├── layout.tsx            # fonts, metadata, <html> shell
    │   ├── page.tsx              # server component: composes ContentLayer + dynamic SceneCanvas
    │   └── globals.css           # Tailwind v4 @import + @theme tokens + base styles
    │
    ├── components/
    │   ├── dom/                  # 2D / HTML layer
    │   │   ├── ContentLayer.tsx      # the ~800vh scroll spine
    │   │   ├── ActSection.tsx        # generic full-height section wrapper w/ data-act
    │   │   ├── Nav.tsx               # minimal fixed nav + act indicator
    │   │   ├── ScrollProgressRail.tsx# right-edge act rail (clickable, scrolls to act)
    │   │   ├── Preloader.tsx         # boot sequence + first-frame handoff
    │   │   ├── StatCounter.tsx       # GSAP-driven number rollups
    │   │   ├── Footer.tsx
    │   │   └── copy/acts.ts          # all narrative text in one typed file
    │   │
    │   ├── canvas/               # 3D layer
    │   │   ├── SceneCanvas.tsx       # <Canvas> + providers + perf monitor + FX stack
    │   │   ├── CameraRig.tsx         # curve-following camera, look-at targets, parallax
    │   │   ├── Lighting.tsx          # tier-aware light setup
    │   │   ├── Effects.tsx           # postprocessing stack, tier-gated
    │   │   ├── ActRouter.tsx         # mounts only acts near current scroll window
    │   │   └── acts/
    │   │       ├── Act0Hero.tsx
    │   │       ├── Act1Threat.tsx
    │   │       ├── Act2AIInspection.tsx
    │   │       ├── Act3QuantumThreat.tsx
    │   │       ├── Act4Lattice.tsx
    │   │       ├── Act5SupplyChain.tsx
    │   │       ├── Act6Verification.tsx
    │   │       └── Act7Resolution.tsx
    │   │
    │   └── objects/              # reusable procedural 3D primitives
    │       ├── Capsule.tsx           # two-tone pharma capsule (lathe + caps)
    │       ├── Tablet.tsx            # round tablet w/ debossed score line
    │       ├── BlisterPack.tsx       # instanced foil sheet + domes
    │       ├── PillField.tsx         # InstancedMesh field of capsules/tablets
    │       ├── MolecularCloud.tsx    # instanced points + bond lines
    │       ├── ScanRig.tsx           # scanner frame, sweeping laser plane
    │       ├── NeuralLattice.tsx     # layered node graph + animated signals
    │       ├── LatticeCrystal.tsx    # PQC lattice point grid + basis vectors
    │       ├── QuantumCore.tsx       # qubit rings, superposition shells
    │       ├── ShieldDome.tsx        # RSA (shatterable) & PQC (absorbing) shields
    │       ├── ChainLedger.tsx       # signed-block chain along a curve
    │       ├── SupplyGraph.tsx       # node/edge network with packet travel
    │       ├── HexSeal.tsx           # rotating cryptographic seal
    │       └── ParticleField.tsx     # global ambient dust (instanced points)
    │
    ├── shaders/                  # GLSL as typed template strings
    │   ├── scanline.ts               # sweeping analysis band
    │   ├── dissolve.ts               # counterfeit corruption / noise dissolve
    │   ├── hologram.ts               # fresnel + grid hologram material
    │   ├── energyLine.ts             # animated dashed flow along tubes
    │   └── noise.ts                  # shared simplex/curl noise chunk
    │
    ├── hooks/
    │   ├── useScrollProgress.ts      # subscribe to scrollStore (frame-loop safe)
    │   ├── useActProgress.ts         # remaps global 0→1 into local 0→1 per act
    │   ├── useQualityTier.ts         # returns 'low' | 'medium' | 'high'
    │   ├── usePointerParallax.ts     # damped pointer offset, disabled on touch
    │   ├── useReducedMotion.ts
    │   └── useGsapContext.ts         # safe GSAP context w/ cleanup on unmount
    │
    ├── lib/
    │   ├── scrollStore.ts            # the mutable, non-reactive scroll state
    │   ├── actMap.ts                 # single source of truth: act ranges + camera keys
    │   ├── cameraPath.ts             # CatmullRomCurve3 definitions + lookAt targets
    │   ├── quality.ts                # device/GPU tiering + per-tier budgets
    │   ├── math.ts                   # clamp, remap, smoothstep, damp helpers
    │   ├── palette.ts                # colour tokens shared by CSS and Three
    │   └── geometryCache.ts          # module-level singleton geometries/materials
    │
    └── types/
        └── index.ts
```

---

## 3. Scene Architecture

### 3.1 The corridor model

Rather than swapping scenes in and out at the origin, all eight acts are laid out as **stations in one continuous 3D world** along a curved path. The camera physically flies through the world as you scroll. This is what produces the cinematic feel: transitions are real camera travel, not cross-fades.

```
 Y
 ↑            ╭────── Act3 Quantum (y +18)
 │      Act2 ─╯                 ╲
 │   Act1                        ╲── Act4 Lattice (y +6)
 │  Act0                                ╲
 └────────────────────────────────────────╲───► −Z
                                  Act5 Supply ── Act6 Verify ── Act7 Resolve
```

| Act | World anchor (x, y, z) | Subject | Camera behaviour |
|---|---|---|---|
| 0 Hero | (0, 0, 0) | Single hero capsule | Slow orbit + dolly-in |
| 1 Threat | (0, -2, -60) | Pill field, corruption wave | Pull back, wide, slight roll |
| 2 AI Inspection | (14, 2, -130) | Scan rig + neural lattice | Push in tight, then arc around |
| 3 Quantum Threat | (6, 18, -205) | Quantum core, RSA shield shatters | Rise, look up, shockwave recoil |
| 4 PQC Lattice | (-10, 6, -285) | Lattice crystal, key exchange | Fly *inside* the lattice |
| 5 Supply Chain | (0, -4, -370) | Node graph + signed block chain | High wide establishing, slow truck |
| 6 Verification | (12, -2, -450) | Pack + scan beam + verdict burst | Close, handheld-ish sway |
| 7 Resolution | (0, 0, -530) | Sealed capsule, all motifs converge | Pull back to reveal, then hold |

`src/lib/cameraPath.ts` stores these as a `CatmullRomCurve3` for position and a second curve for the look-at target, so the camera never snaps — it eases along a smooth spline with independently animated aim.

### 3.2 Act lifecycle

`ActRouter` mounts an act only when `scrollStore.progress` is inside `[actStart - 0.06, actEnd + 0.06]`. Outside that window the act is unmounted, its geometries disposed, and its draw calls vanish. At any moment at most **two** acts are live (during a transition). Each act receives a local progress `0 → 1` via `useActProgress`, so act-internal animation code never has to know about global scroll numbers.

### 3.3 Narrative — the eight acts

**Act 0 — Cold Open.** Black. A single translucent two-tone capsule rotates in a shaft of light, suspended in slow-drifting molecular dust. Title *MedSecure PQC* resolves letter by letter. Establishes beauty and stakes: this object is what we're protecting.

**Act 1 — The Threat.** The camera pulls back and the one capsule becomes ten thousand, tiled into blister packs across the void. A corruption wave sweeps through the field: pills desaturate, fracture, dissolve into red noise. Counters roll up the real WHO figures — roughly 1 in 10 medical products in low- and middle-income countries is substandard or falsified. The problem, felt at scale.

**Act 2 — AI Inspection.** One suspect capsule is pulled from the field into a scanning chamber. A laser plane sweeps it; the surface becomes a point cloud; extracted features (imprint geometry, coating variance, spectral signature) stream out as data motes into a three-layer neural lattice that ignites layer by layer. The verdict lands: **COUNTERFEIT — 99.2% confidence.** AI catches what the eye cannot.

**Act 3 — The Quantum Threat.** But detection alone is not enough — the certificate of authenticity must be unforgeable. Camera rises to a quantum core: nested rings of qubits in superposition. A beam strikes a classical RSA-2048 shield, which shatters. Copy: today's signatures are one cryptographically relevant quantum computer away from forgeable. Harvest-now-decrypt-later is a supply-chain problem *today*.

**Act 4 — The Lattice.** Camera dives into a structured lattice grid — the mathematical object behind ML-KEM (Kyber) and ML-DSA (Dilithium). Basis vectors rotate; the shortest-vector problem visualises as a point that will not resolve. A key-encapsulation animation runs: public key → encapsulation → shared secret, mirrored at both ends. The same beam from Act 3 hits the lattice shield and is absorbed. NIST FIPS 203/204 named on screen.

**Act 5 — The Signed Supply Chain.** Wide reveal of a network: Manufacturer → Distributor → Pharmacy → Patient. Each custody event mints a block, signed with ML-DSA, chained by hash. A packet travels the graph, glowing. Then a tamper attempt at a distributor node: the block's signature fails, the node flares red, and the chain rejects it in real time.

**Act 6 — Verification.** Ground level, human scale. A pack is scanned; the beam reads its tag; the AI verdict and the PQC signature check resolve together into a single green seal. Two independent proofs, one answer, under 200 ms.

**Act 7 — Resolution.** All motifs converge on the original hero capsule, now sealed inside a slowly rotating hexagonal cryptographic seal. The camera pulls back; the pill field from Act 1 is whole again. Closing statement, tech credits, CTA.

---

## 4. Scroll Timeline Architecture

### 4.1 Global mapping

Total scroll height ≈ **800vh**, divided into eight 100vh acts. Global progress `p ∈ [0,1]`.

```
p:  0.000   0.125   0.250   0.375   0.500   0.625   0.750   0.875   1.000
    │ Act0  │ Act1  │ Act2  │ Act3  │ Act4  │ Act5  │ Act6  │ Act7  │
    └───────┴───────┴───────┴───────┴───────┴───────┴───────┴───────┘
              ╲___╱   overlap bands (±0.03) where two acts co-exist
```

Act ranges live in `src/lib/actMap.ts` as the single source of truth. The DOM sections, the camera path knots, the rail indicator, and the 3D act router all derive from that one array — adding or reordering an act is a one-file change.

### 4.2 Three synchronised timelines

1. **Camera timeline (imperative, per frame).** `CameraRig` samples `cameraPath.getPointAt(smoothP)` plus a per-act offset, then `damp3`s the camera toward it. Frame-rate independent — identical motion at 60 Hz, 120 Hz, and 30 Hz.
2. **Object timelines (imperative, per frame).** Each act reads its local `0 → 1` and drives uniforms, instance matrices, and material properties directly. No GSAP tweens inside `useFrame` — GSAP is used for *event-driven* bursts (a shatter, a verdict flash) via `gsap.to()` on a plain object read by the frame loop.
3. **DOM timeline (GSAP ScrollTrigger, scrubbed).** One `gsap.timeline({ scrollTrigger: { scrub: 1 } })` handles all text overlays: masked line reveals, opacity, `y` translation, stat counters, and pinned captions.

### 4.3 Scroll implementation details

- One `ScrollTrigger` for the whole page (`trigger: body, start: top top, end: bottom bottom, scrub: true`) writing to `scrollStore`. Additional triggers only for isolated DOM effects.
- `ScrollTrigger.normalizeScroll(true)` on touch devices to defuse iOS Safari address-bar resize jitter and rubber-banding.
- `ScrollTrigger.config({ ignoreMobileResize: true })` so the mobile URL bar collapsing does not re-trigger layout thrash.
- Anchor navigation and the act rail use `gsap.to(window, { scrollTo })` for eased jumps.
- Full `ScrollTrigger.refresh()` on resize, debounced 150 ms.
- Reduced motion: scrubbing is replaced by discrete act snapping and all camera easing durations collapse to near-zero.

---

## 5. List of 3D Objects (all procedural)

Nothing is downloaded or imported. Every object below is built from Three.js geometry constructors, `LatheGeometry`/`TubeGeometry` from generated point arrays, `BufferGeometry` written from typed arrays, or instanced primitives.

### 5.1 Pharmaceutical objects
| Object | Construction |
|---|---|
| **Capsule** | `LatheGeometry` from a generated profile, split into two coloured halves with a slight overlap band; `MeshPhysicalMaterial` with clearcoat + transmission (high tier) or a cheap physical material (low tier). |
| **Tablet** | `CylinderGeometry` with beveled rim from a lathe profile, plus a debossed score line via a thin subtractive-looking inset ring. |
| **Blister pack** | Instanced domes over a foil plane; foil uses an anisotropic-looking physical material with a procedural normal wobble in the shader. |
| **Pill field** | `InstancedMesh` — 1,200 / 4,000 / 10,000 instances by tier, with per-instance colour, phase, and a `corruption` attribute driving the dissolve shader. |
| **Molecular cloud** | Instanced spheres for atoms + `LineSegments` bonds, positions from a seeded pseudo-random lattice walk. |
| **Medicine pack / carton** | Rounded box (`BoxGeometry` + custom bevel via a lathe-swept profile) with a procedural label drawn to an `OffscreenCanvas` texture at runtime. |

### 5.2 AI objects
| Object | Construction |
|---|---|
| **Scan rig** | Torus + box frame, plus a sweeping emissive plane with a custom scanline shader. |
| **Point-cloud sampler** | `Points` built by sampling the capsule geometry's vertices, animated outward with curl noise. |
| **Neural lattice** | Three layers of instanced node spheres; edges as a single `LineSegments` buffer with per-vertex alpha animated to simulate forward propagation; signal pulses as instanced sprites travelling along edges. |
| **Feature motes** | Instanced points flowing along `CatmullRomCurve3` paths from the pill to the network. |
| **Verdict HUD** | `drei/Text` (SDF, no image assets) + a ring-gauge built from a `RingGeometry` with an animated `thetaLength`. |

### 5.3 Cryptography objects
| Object | Construction |
|---|---|
| **PQC lattice crystal** | 3D point grid (`InstancedMesh`, 12³ down to 6³ by tier) plus `LineSegments` basis vectors; a highlighted "short vector" path animates through it. |
| **Quantum core** | Three nested `TorusGeometry` rings on different axes + instanced qubit spheres orbiting; superposition rendered as a fresnel shell with animated interference fringes. |
| **RSA shield (shatterable)** | Icosahedron split into ~200 independent triangle shards (each face extracted into its own instance) so it can explode outward with per-shard physics-ish integration on impact. |
| **PQC shield (absorbing)** | Hexagonal-tiled dome — hex cells generated from a subdivided icosphere's dual — with a shader that ripples and reinforces where struck. |
| **Key pair orbs** | Two icospheres with an inverse-fresnel hologram material, linked by an animated energy tube. |
| **Signed block** | Rounded box with an emissive glyph face (runtime canvas texture of a truncated hex digest) and an ML-DSA seal ring. |
| **Hash chain** | `TubeGeometry` along a curve with an animated dashed flow shader connecting the blocks. |
| **Hex seal** | Two counter-rotating rings of extruded hexagons + a central emissive core. |

### 5.4 Supply chain & environment
| Object | Construction |
|---|---|
| **Supply graph** | Node icospheres at fixed anchors, edges as tube geometry, packets as instanced glowing capsules travelling along edge curves. |
| **Ground grid** | Shader-based infinite grid on a large plane (analytic anti-aliased lines, no texture). |
| **Ambient dust** | 3,000–12,000 instanced points with curl-noise drift, tier-scaled. |
| **Volumetric shafts** | Cone geometry with additive, depth-write-off fresnel material — fake god rays at a fraction of the cost of real volumetrics. |
| **Data rain** | Instanced thin planes falling in the background of the crypto acts, alpha-faded by distance. |

---

## 6. Animation Strategy

### 6.1 Division of responsibility

| Motion type | Driver | Why |
|---|---|---|
| Camera travel | `useFrame` + `damp3` sampling the spline | Must be frame-rate independent and interruption-safe |
| Continuous ambient motion (rotation, drift, pulsing) | `useFrame` with `elapsedTime` | Free, no allocations |
| Scroll-locked object motion | `useActProgress` → direct property/uniform writes | Perfectly reversible when scrolling up |
| Discrete event bursts (shatter, verdict flash, tamper reject) | GSAP tween on a plain JS object read in `useFrame` | GSAP's easing is better than hand-rolled, and the tween lives outside React |
| DOM text, counters, masks | GSAP ScrollTrigger timeline | GSAP's native domain |

### 6.2 Rules

- **No `setState` in `useFrame`.** Ever. Mutable refs only.
- **No object allocation in `useFrame`.** All `Vector3`/`Color`/`Matrix4`/`Quaternion` temporaries are module-level scratch singletons.
- **Damping over lerp:** `maath/easing.damp` and `damp3` everywhere, so a 144 Hz monitor and a throttled 30 fps mobile device produce the same motion curve.
- **Everything is reversible.** Because scroll-locked animation is a pure function of local progress, scrolling backwards perfectly reverses every act. Event bursts guard against re-firing with a `hasFired` ref that resets when the act's progress leaves its trigger band.
- **GSAP cleanup:** every timeline is created inside `gsap.context()` and reverted on unmount (`useGsapContext`), preventing leaked ScrollTriggers across Next's fast refresh and route changes.
- **Entrance choreography:** each act's objects animate in on a staggered offset of local progress (`remap(p, 0.0→0.25)` for entrance, `0.75→1.0` for exit), so nothing pops.

---

## 7. Performance Strategy

**Targets:** 60 fps desktop (integrated GPU acceptable), ≥ 30 fps mid-range mobile, < 250 draw calls at any moment, first contentful paint under 1.5 s on 4G, TBT under 300 ms.

### 7.1 Quality tiering
`src/lib/quality.ts` probes at boot: `navigator.hardwareConcurrency`, `deviceMemory`, `matchMedia('(pointer: coarse)')`, `WEBGL_debug_renderer_info` where exposed, and max texture size. It resolves to `low | medium | high`, then drei's `<PerformanceMonitor>` **downgrades live** if the measured frame rate sags, and can upgrade once if the device proves itself.

| Budget | low | medium | high |
|---|---|---|---|
| DPR | 1.0 | 1.0–1.5 | 1.0–2.0 |
| Pill field instances | 1,200 | 4,000 | 10,000 |
| Dust particles | 3,000 | 7,000 | 12,000 |
| Lattice grid | 6³ | 9³ | 12³ |
| Shield shards | 60 | 120 | 240 |
| Post-processing | none | bloom | bloom + CA + vignette |
| Transmission material | off (physical fallback) | off | on (hero capsule only) |
| Shadows | off | off | single soft directional |
| MSAA samples | 0 | 0 | 4 |

### 7.2 Techniques
- **Instancing first.** Anything appearing more than ~8 times is an `InstancedMesh` with per-instance attributes; per-instance colour and animation phase live in `InstancedBufferAttribute`s so the CPU never touches matrices per frame after setup.
- **Act unmounting** (Section 3.2) keeps the live scene graph small; disposal is explicit in a `useEffect` cleanup for every custom geometry/material.
- **Shared resources.** `geometryCache.ts` holds module-level singleton geometries and materials so remounting an act is nearly free.
- **Code splitting.** Each act is a `next/dynamic` import, so the initial JS payload is Act 0 only; later acts prefetch on idle (`requestIdleCallback`) once the first frame is stable.
- **`AdaptiveDpr` + `AdaptiveEvents`** from drei: resolution drops during camera movement, restores when still; raycasting is disabled during motion.
- **No textures over the network.** Every "texture" (block digests, pack labels) is drawn to an `OffscreenCanvas` at runtime, so there are zero image requests and zero decode cost on the main thread.
- **Render-loop gating:** `IntersectionObserver` on the canvas and a `visibilitychange` listener stop the loop entirely when the page is hidden or scrolled past — meaningful for battery on mobile.
- **Shader discipline:** no branching in fragment hot paths, `precision mediump` where safe, noise computed in the vertex stage when the result can be interpolated.
- **Bundle hygiene:** `three` is imported by named symbol (never `import * as THREE` in app code beyond a typed barrel), postprocessing is lazily imported for medium/high only.

---

## 8. Mobile Strategy

- **Portrait-first layout.** Text overlays are bottom-anchored above the thumb line on small screens, side-anchored on desktop. Type scales with `clamp()`.
- **Reframed camera.** A responsive FOV curve (`fov = 35 + 20 * (1 - min(aspect,1.6)/1.6)`) plus per-act `mobileOffset` vectors ensures the subject stays framed in a 9:19.5 viewport rather than cropped. This is authored per act, not a global hack.
- **Touch scrolling:** `normalizeScroll` + `ignoreMobileResize`; `overscroll-behavior-y: none`; the canvas is `pointer-events: none` so scrolling is never captured by the 3D layer.
- **No hover dependencies.** Pointer parallax is disabled on coarse pointers; every hover affordance has a scroll-triggered or tap equivalent.
- **Thermal safety.** Low tier caps DPR at 1.0, disables post-processing, and halves particle counts. `PerformanceMonitor` steps quality down further if sustained frame time degrades (thermal throttling shows up here first).
- **Memory ceiling.** Aggressive act unmounting plus small instance counts keeps GPU memory well under the ~250 MB practical ceiling on older iOS devices, avoiding Safari's silent context loss.
- **Context-loss recovery.** A `webglcontextlost` handler prevents default, shows a "restoring" state, and remounts the canvas on `webglcontextrestored` — a real failure mode on mobile Safari.
- **Reduced motion & no-WebGL** both resolve to the static content experience described in §1.4.

---

## 9. Development Phases

Each phase ends with the same gate: **`npm run build` succeeds with zero TypeScript and ESLint errors, `npm run dev` runs, the page is loaded and checked for console errors, and frame rate is sampled.** No phase begins until the previous one passes.

| # | Phase | Deliverable | Verification |
|---|---|---|---|
| **1** | **Foundation** | Next 16 + TS strict + Tailwind v4 scaffold; folder structure; palette/type tokens; ESLint + Prettier; `lib/math.ts`. | Dev server serves a styled placeholder page; build clean. |
| **2** | **Scroll spine & DOM shell** | `ContentLayer` with 8 sections, `scrollStore`, `actMap`, the single ScrollTrigger, act rail, nav, all narrative copy. A debug HUD prints live progress/act. | Scrolling updates progress smoothly 0→1; act indices fire at the right offsets; no re-render storm (verified with React DevTools profiler). |
| **3** | **Canvas boot & camera rig** | `SceneCanvas`, `CameraRig` on the spline, `Lighting`, ground grid, ambient dust, quality tiering, `PerformanceMonitor`, debug orbit toggle. | Camera flies the full corridor on scroll at 60 fps with an empty world; DPR adapts; tier detection logged. |
| **4** | **Core pharma objects** | `Capsule`, `Tablet`, `BlisterPack`, `PillField`, `MolecularCloud` + Act 0 hero fully realised. | Act 0 is beautiful and stable; instanced field of 10k renders in budget; mobile check. |
| **5** | **Act 1 — Threat** | Corruption/dissolve shader, wave propagation across instances, stat counters, DOM overlay choreography. | Corruption sweep is reversible on scroll-up; no shader compile warnings. |
| **6** | **Act 2 — AI Inspection** | `ScanRig`, point-cloud sampler, `NeuralLattice`, feature motes, verdict HUD. | Full inspection sequence reads clearly at both desktop and mobile framing. |
| **7** | **Acts 3 & 4 — Quantum & PQC** | `QuantumCore`, shatterable `ShieldDome`, `LatticeCrystal`, key-encapsulation animation, hex shield absorb. | Shatter fires once per entry and resets on exit; lattice fly-through holds frame rate. |
| **8** | **Acts 5 & 6 — Chain & Verification** | `SupplyGraph`, `ChainLedger`, signed blocks with runtime canvas textures, tamper-rejection event, verification burst. | Packet travel and tamper sequence sync to scroll; no texture-allocation hitches. |
| **9** | **Act 7 — Resolution & outro** | `HexSeal`, convergence choreography, CTA, footer, credits. | End-to-end scroll of all 8 acts, forwards and backwards, is seamless. |
| **10** | **Post-processing & colour grade** | Tier-gated bloom / chromatic aberration / vignette; final lighting and palette pass across all acts. | Visual consistency; measured cost of FX stack within budget on medium tier. |
| **11** | **Performance & mobile hardening** | Act unmounting audit, disposal audit, dynamic imports, idle prefetch, context-loss recovery, reduced-motion + no-WebGL fallback, responsive framing pass. | Profiled on a throttled 4× CPU / mobile emulation: ≥ 30 fps, no leaks across 5 full scroll cycles (heap snapshot comparison). |
| **12** | **Polish, a11y & ship** | Semantic headings, skip link, focus states, keyboard act navigation, `aria-label`s, metadata + OG image, README, production build. | Lighthouse pass; keyboard-only navigation works; production build served and re-verified. |

**Rolling practice throughout:** run the dev server continuously, check the browser console after every phase, keep every module under ~200 lines with a single clear responsibility, and never leave a stub — if an act isn't ready yet, it simply isn't mounted.

---

## Open questions for you (defaults chosen if you don't reply)

1. **Colour direction** — default is deep navy/near-black base with cyan-teal for AI, violet for quantum, and amber-gold for the pharmaceutical objects, with red reserved exclusively for counterfeit/tamper states. Say the word if you want a different palette.
2. **Act count** — 8 acts ≈ 800vh. I can compress to 6 for a shorter page if you prefer.
3. **Branding** — no logo assumed; the wordmark will be set in type. Send a logo and I'll integrate it.
