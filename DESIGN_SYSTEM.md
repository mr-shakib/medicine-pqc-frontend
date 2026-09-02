# MedSecure PQC — Design System

The visual language for a real-time 3D pharmaceutical security experience.

**The brief in one line:** objects of real value, floating inside a premium dark scientific space.

**Implementation:** `src/lib/design/tokens.ts` (values), `src/lib/design/materials.ts` (surfaces), `src/styles/globals.css` (DOM mirror). Those three files are the system; this document is the reasoning behind them.

---

## 0. The four references, and what each contributes

| Reference | What we take | What we reject |
|---|---|---|
| **Apple product presentation** | One object, isolated, lit like a photograph. Enormous negative space. Three type weights. Colour used in doses, not fields. | Its whiteness — our space is dark. |
| **Futuristic pharmaceutical lab** | Clean-room calm. Bone whites, borosilicate, surgical steel. Precision without clinical coldness. | Its literal blue-and-white brand palette. |
| **Advanced scientific instrumentation** | Monospace annotation, hairline rules, tabular figures, calibrated readouts. | Dense telemetry — no dashboards. |
| **Elegant cybersecurity** | Cryptography as *architecture*: lattices, seals, structure. | Terminal green, matrix rain, padlock icons, glitch. |

### The single rule that keeps us out of the wrong genre

**Saturation.** Cyberpunk, gaming and hacker aesthetics all live at 70–100% saturation. Premium scientific work lives at **23–45%**. Every accent in this system sits in that band. It is the one measurable difference between the register we want and the register we are avoiding.

The corollary: neutrals do roughly 90% of the visual work. Colour identifies a chapter — it never fills the frame.

---

## 1. Background system

The background is not a colour. It is a **studio cyclorama** — a lit space with a floor, a horizon and a falloff.

### The neutral ramp

13 steps, every one carrying a slight blue bias (hue ≈ 220) rather than being a pure grey. Warm light reading against a subtly cool ground is what makes a dark scene feel like *a space* instead of *an absence*.

| Token | Hex | Role |
|---|---|---|
| `n00` | `#06070A` | Page base, fog far end, ceiling |
| `n01` | `#090B0F` | Chamber floor |
| `n02` | `#0D0F15` | The chamber the objects float in |
| `n03` | `#11141B` | Horizon line (the lifted band) |
| `n04` | `#161A22` | Raised surfaces, glass panels |
| `n05` | `#1C212A` | Machined housing |
| `n06`–`n08` | `#242A35` → `#414957` | Hairlines, borders, dividers |
| `n09` | `#5C6474` | Dimmed type, inactive marks |
| `n10` | `#8A93A3` | Body copy — 5.8:1 on `n00` |
| `n11` | `#B9C0CC` | Subtitles — 10.2:1 on `n00` |
| `n12` | `#E9ECF1` | Primary type |

`n12` is deliberately **not** `#FFFFFF`. Pure white on near-black glares and halates; pulling it to `#E9ECF1` keeps headlines crisp without the buzz.

### Three layers build the background

1. **Backdrop shader** (`src/shaders/backdrop.ts`) — an inverted sphere locked to the camera. A two-sided falloff from a lifted horizon (`n03`), darkening faster upward to `n00` than downward to `n01`, which reads as a room with a lit floor rather than open sky. Over it sits a broad **elliptical pool** of the current chapter's accent at ~8.5% — wider than tall, so it reads as a large softbox rather than a spotlight.

2. **Exponential fog** at `n00` — dissolves the far end of the 360-unit corridor so there is never a visible "end of the world".

3. **The grade** (`src/components/ui/Grade.tsx`) — a CSS vignette plus top and bottom scrims between the canvas and the copy. Does two jobs at once: focuses the eye centre-frame the way a real lens does, and guarantees a contrast floor under the typography whatever the 3D layer is rendering.

### Dithering is mandatory

An 8-bit framebuffer has 256 levels per channel. A gradient this dark and this wide **will** band into visible rings. The backdrop fragment shader adds a sub-LSB of interleaved gradient noise (`±1/255`) to break up the quantisation.

It runs at `highp`. This is not optional either: the conventional `fract(sin(dot(p, …)) * 43758.5)` hash loses its mantissa at `mediump` and aliases into horizontal stripes — which is exactly what happened on the first implementation, visible in testing before it was fixed.

---

## 2. Lighting colours

Lit as a **product photograph**, not a game level. Five sources:

| Light | Colour | Intensity | Job |
|---|---|---|---|
| **Key** | `#FFF4E8` warm white | 2.1 | Large, high, camera-right. Does most of the work. |
| **Fill** | `#DCE8F2` cool white | 0.52 | Opposite the key at ~¼ power. Opens shadows without flattening. |
| **Rim** | chapter accent | 1.5 | Behind and above. Separates subject from ground. |
| **Bounce** | `#2A3340` | 0.5 | Hemisphere return off the imagined floor. Undersides never crush to black. |
| **Practical** | accent `glow` | 9, decay 2, range 14 | Small, close, fast-decaying. Grades the object without lighting the corridor. |
| Ambient | `#0F131A` | 0.18 | Near-zero on purpose. |

**Warm key against cool fill** is the whole trick. It is what gives dark product imagery its sense of volume; two neutral lights produce a flat grey object no matter how they are placed.

**Ambient is kept near-zero.** On a dark set, ambient light is the fastest route to looking flat and cheap — volume has to come from directional sources.

The whole rig travels with the scroll position, so eight stations across 360 world units stay lit by five lights instead of forty.

### The reflection environment

`StudioEnvironment` bakes a **procedural** cubemap (128–256px, rendered once) from emissive planes arranged like a real studio: a broad overhead softbox, two tall side strips, a warm ring bounce behind.

This is the single highest-leverage element for making glass and metal read as premium. Specular materials show you a reflection of their surroundings; in an empty dark scene there is nothing to reflect, so glass renders as **dark plastic** and aluminium as **flat grey** regardless of how roughness is tuned. The vial in testing looked like a dull plastic bottle until this was added.

The two tall side strips specifically produce the vertical specular lines that make a cylinder read as a cylinder — the classic bottle-photography setup. No HDR files are downloaded; nothing is fetched at runtime.

---

## 3. Primary accent colours

Four semantic families plus a verification state. Every `base` step sits in a narrow band — **saturation 23–45%, lightness 51–58%** — which is what makes five different hues read as one system.

| Family | `deep` | `base` | `light` | `glow` | Carries |
|---|---|---|---|---|---|
| **pharma** | `#6E5030` | `#BE8B4E` | `#DFB98A` | `#F2DCBC` | The medicine. Chapters 1–4. |
| **analysis** | `#1F4C56` | `#5C9AA8` | `#96C4CE` | `#C6E2E8` | AI, measurement. Chapter 6. |
| **lattice** | `#33356B` | `#6E70B8` | `#A3A5D8` | `#CFD0EC` | Post-quantum crypto. Chapter 7. |
| **alert** | `#6E2A28` | `#C0605A` | `#DC908B` | `#F0C0BC` | Counterfeit, tamper. Chapter 5. |
| **verified** | `#2C5240` | `#6FA588` | `#A3C9B4` | `#CFE3D8` | Authenticated. Chapter 8. |

**Pharma is the only warm hue in a cool system.** That is deliberate: the medicine is the protagonist, and warmth against a cool field is the oldest way to make a subject advance from its background. It carries slightly more saturation (43%) than the others for the same reason.

**Alert is reserved.** Red appears only for counterfeit and tamper states — never as decoration, never as chrome. If red is on screen, something is wrong. That reservation is what will give the corruption wave its force.

**Verified is sage, not signal green.** `#6FA588` at 23% saturation reads as calm confirmation. A `#00FF00` would read as a games console, and would undercut the one moment the whole narrative is building toward.

### The four steps have distinct jobs

- `deep` — shadowed material, deep tints, pressed states
- `base` — the material colour of an object. **The default; reach for this first.**
- `light` — lit faces, hovered chrome, type on accent
- `glow` — emissive highlights only, and only over small areas

**Emissive materials must be passed `base`, never `light` or `glow`.** Emissive intensity multiplies the colour, and with tone mapping bypassed an already-pale step clips every channel to 1.0 and washes out to white — losing the hue exactly where it was meant to identify the chapter. This was caught in testing: the lattice rendered near-white before the correction.

---

## 4. Secondary colours

There is no separate secondary palette, and that is a deliberate constraint. Secondary emphasis comes from **the neutral ramp** and from **the four accent steps**, not from new hues.

Adding a sixth and seventh hue is how a restrained palette turns into a generic one. Where hierarchy is needed:

- **Chapter-secondary** → the same family's `light` step at reduced opacity
- **Structural** → `n06`–`n08` hairlines
- **Supporting type** → `n09`–`n11`
- **Chrome** → neutral until it becomes active, then the chapter accent

Tone mapping is **ACES filmic** at exposure `0.94`. ACES stops bright accents from clipping to flat white and keeps highlight rolloff photographic; the slightly sub-1 exposure keeps the chamber genuinely dark rather than lifted.

---

## 5. Typography

**Geist Sans** for everything readable. **Geist Mono** for anything measured.

Geist is a modern technical grotesque with a large x-height, unambiguous figures and a genuinely usable low weight range — the same category of typeface as the ones used on premium hardware product pages, without the licensing of a bespoke face.

The mono/sans split carries meaning: **sans is prose, mono is instrumentation.** Chapter numbers, labels, readouts and technical annotation are monospace, because that is the typographic signal for "this is measured data". Prose is never monospace.

### Scale — fully fluid, no breakpoint jumps

| Token | Size | Weight | Tracking | Leading |
|---|---|---|---|---|
| `display-xl` | `clamp(2.75rem, 7.5vw, 7rem)` | 250 | −0.035em | 0.92 |
| `display-l` | `clamp(2.25rem, 5vw, 4.25rem)` | 250 | −0.032em | 0.96 |
| `display-m` | `clamp(1.75rem, 3.2vw, 2.75rem)` | 300 | −0.02em | 1.1 |
| `lead` | `clamp(1.0625rem, 1.5vw, 1.3125rem)` | 400 | −0.011em | 1.4 |
| `body-copy` | `clamp(0.9375rem, 1.05vw, 1.0625rem)` | 400 | 0 | 1.7 |
| `eyebrow` | `0.6875rem` mono | 400 | **+0.24em** | 1.4 |

**Three weights in the entire system:** 250, 400, 500.

**Display type runs light with negative tracking.** At 7rem, weight is loud enough on its own; what large text actually needs is its letterforms pulled *together*. Heavy display weight is one of the clearest markers of the gaming register.

**Tracking runs opposite by size:** tight negative on display, zero on body, and a wide `+0.24em` on the mono labels. Widely-tracked small caps read as instrument panel engraving.

---

## 6. Text hierarchy

Five levels, and no page uses more than four.

```
01 / CAPSULE          ← eyebrow    mono, +0.24em, chapter accent
                        preceded by an 8px hairline rule

Formation             ← display    250 weight, −0.032em, n12
                        the only large element

From raw compound     ← lead       400, n11, max ~34rem
to sealed capsule.

Active ingredient,    ← body       400, n10, 1.7 leading, max ~30rem
excipient, shell…

SCROLL TO BEGIN       ← caption    mono, n09
```

**Measure is capped at ~34rem** for the lead and ~30rem for body. On a 1440px viewport that leaves the copy in a narrow column on one side, with the object in the rest of the frame — the caption-beside-photograph relationship, not text-over-image.

The camera enforces the other half of this: `CameraRig` applies a compositional offset derived from the view frustum, so the subject sits **right of the copy column** on desktop and **above it** on mobile. The copy is never fighting the object for the same pixels.

Contrast: body `n10` on `n00` is **5.8:1**, subtitle `n11` is **10.2:1** — both clear AA, before the scrims add their floor.

---

## 7. Glass material direction

**Precision optical glass. Not frosted decoration.**

The face of good glass is nearly invisible. What you actually see is the **edge**, where the fresnel term ramps and thickness bends what is behind it. So the design effort goes into edges and specular, not into opacity.

**High tier** — true transmission:
```
transmission 0.92   ior 1.46      roughness 0.08
thickness 0.6       clearcoat 1   clearcoatRoughness 0.06
attenuationColor #9FBCCB   attenuationDistance 2.4
```
The attenuation gives the faint blue-green tint real borosilicate has through its thickness.

**Medium / low tier** — transmission renders the backbuffer per object and is genuinely expensive, so below high tier it falls back to a hard clearcoat over a low-opacity body (`opacity 0.34`, `envMapIntensity 2.2`), leaning entirely on the studio environment. Same silhouette, same edge read, a fraction of the cost.

**In the DOM,** glass is equally restrained: a hairline edge at 7% white over a 62% wash, `blur(14px)`. Heavy frosted panels are the fastest way to make an interface look like a dashboard.

Two details that sell it: the serum sits **inset** from the vial wall so there is a real air gap (without it the vial reads as a solid coloured cylinder), and a separate **meniscus** disc catches the key.

---

## 8. Metallic material direction

**Anodised and surgical. Never chrome.**

| Material | Colour | Metalness | Roughness | Used for |
|---|---|---|---|---|
| `aluminium` | `#AEB4BC` | 1.0 | **0.34** | Instrument bodies, chassis |
| `steel` | `#C2C8D0` | 1.0 | **0.22** | Crimp collars, frames |
| `housing` | `n05` | 0.85 | 0.45 | Darkened machined parts |

**Nothing is a mirror.** Roughness never goes below 0.22. A perfect mirror scatters the key into a hard dot and reads instantly as cheap CGI; 0.34 spreads it into the soft wide highlight that anodised aluminium actually produces. This is the Apple-hardware surface.

The faint warm tint in `aluminium` keeps it from going blue-steel, which drifts toward sci-fi weaponry.

**The governing rule for every surface in the project: roughness lives between 0.15 and 0.55.** Below that is fake chrome; above it is untextured clay.

---

## 9. Particle style

**Sterile airborne motes in a laminar-flow cabinet.** Not sparks, not digital rain, not a starfield.

```
size 0.028   opacity 0.34   colour n09 (#8A93A3)
6% highlight motes in pharma-light   drift 0.005 rad/s
additive · sizeAttenuation on · depthWrite off
```

Their job is to make empty space read as **air with depth parallax**. You should register them as atmosphere, not notice them as particles. Three constraints keep them there:

- **Unsaturated.** Neutral `n09`, not the chapter accent. Coloured particles read as magic.
- **Slow.** 0.005 rad/s rotation and a 0.07Hz vertical breath. Fast particles read as speed, which is a games idiom.
- **Small and dim.** 0.028 units at 34% opacity.

The **6% highlight fraction** is what stops the field looking like uniform noise — a minority of motes drifting through the key light, exactly as real dust does in a lit room.

One `Points` draw call spans all eight stations, so cost is fixed however far the camera travels. Count scales 1,200 / 4,000 / 9,000 by tier.

---

## 10. Holographic visual style

**A projected measurement, not a sci-fi interface.**

The holographic layer must read as light an *instrument* is casting onto air to measure the object — not as decoration, and emphatically not as a HUD.

Five hard constraints:

1. **Single hue** per overlay. No rainbow iridescence, no spectrum sweeps.
2. **Additive, low opacity** (0.12–0.24), `depthWrite: false`.
3. **Hairline geometry.** Wireframes and rings at 0.008–0.02 tube radius. Structure, not fill.
4. **No glitch.** No scanline tearing, no chromatic split, no datamosh. Glitch is the visual grammar of "compromised system" — the opposite of what this product claims.
5. **No text-as-decoration.** No scrolling hex, no fake code, no random glyphs.

Provided as `hologram(color, opacity)` and `hairline(color, opacity)` in the materials module.

**Emissive is rationed.** `emissive()` is for *small* areas only — a hairline, a lattice node, a seal segment. Large emissive surfaces are what make a scene look like a games console. The hero core proved this during implementation: rendered with a large emissive material and tone mapping disabled it blew out into a flat orange orb; rebuilt as a *polished* physical surface with clearcoat, picking up the studio rig, it reads as a bead of cast resin.

That is the general principle, and the one to hold on to:

> **Objects should be lit, not luminous.**

---

## Applied: chapter accents

| # | Chapter | Family |
|---|---|---|
| 01 | Core — *MedSecure PQC* | pharma |
| 02 | Capsule — *Formation* | pharma |
| 03 | Tablet — *Compression* | pharma |
| 04 | Serum — *Suspension* | pharma |
| 05 | Scale — *Convergence* | **alert** |
| 06 | AI — *Detection* | analysis |
| 07 | PQC — *Protection* | lattice |
| 08 | Sealed — *Verified* | verified |

Four consecutive pharma chapters establish the warm baseline, so the single break to `alert` at chapter 5 lands hard. Colour is carrying narrative, not variety.

The active accent is written to `--scene-accent` on `<html>` once per chapter, so DOM chrome and WebGL cross-fade from the same source.

---

## Motion

| Token | Value | Use |
|---|---|---|
| `dampCamera` | 0.0015 | Camera position |
| `dampAim` | 0.004 | Camera aim (looser than position — reads as an operator, not a rail) |
| `dampMaterial` | 0.01 | Material and colour transitions |
| `micro` / `element` / `scene` | 240 / 600 / 1200ms | DOM transitions |
| `easeOut` | `cubic-bezier(0.22, 1, 0.36, 1)` | Anything entering |
| `easeInOut` | `cubic-bezier(0.65, 0, 0.35, 1)` | Anything that moves and settles |

All damping is frame-rate independent, so a 144Hz display and a throttled 30fps phone trace the same curve.

**Premium motion never bounces.** No overshoot, no elastic, no spring wobble. Decelerate and settle.

---

## What this system forbids

A checklist, because knowing what to leave out is most of the work:

- ✗ Saturation above ~50% on any surface
- ✗ Pure `#000` grounds or pure `#FFF` type
- ✗ Neon glow, bloom halos as decoration, lens flares
- ✗ Terminal green, matrix rain, scrolling hex, fake code
- ✗ Glitch, datamosh, chromatic aberration as style
- ✗ Mirror-finish chrome (roughness < 0.2)
- ✗ Large emissive surfaces
- ✗ Frosted-glass panels stacked into a dashboard
- ✗ More than three font weights
- ✗ Heavy display type
- ✗ Padlock, shield or circuit-board iconography
- ✗ Red for anything except counterfeit and tamper
- ✗ Bouncy or elastic easing
- ✗ Any externally fetched asset — every texture and environment is generated at runtime
