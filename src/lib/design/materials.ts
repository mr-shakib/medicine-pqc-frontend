import { AdditiveBlending, DoubleSide, FrontSide } from 'three';
import { accent, neutral } from '@/lib/design/tokens';
import type { QualityBudget } from '@/lib/quality';

/**
 * Material direction.
 *
 * Every surface in this project is one of six materials. They are defined here
 * as plain prop objects so they can be spread straight onto an R3F material
 * element -- declarative, shareable, and impossible to drift between scenes.
 *
 * The governing rule: NOTHING is a mirror and nothing is fully rough. Real
 * premium product surfaces sit between 0.15 and 0.55 roughness. Perfect chrome
 * reads as cheap CGI; perfectly matte reads as untextured clay.
 */

/* -------------------------------------------------------------------------- */
/* Glass — precision optical, not frosted decoration                           */
/* -------------------------------------------------------------------------- */

/**
 * Laboratory borosilicate. The face of the glass is nearly invisible; what you
 * actually see is the EDGE, where the fresnel term ramps up and the thickness
 * bends the light behind it.
 *
 * Transmission is a genuinely expensive material (it renders the backbuffer per
 * object), so it is high-tier only. The fallback keeps the same silhouette and
 * fresnel read at a fraction of the cost by leaning on low roughness and
 * opacity instead.
 */
export function glass(budget: QualityBudget) {
  if (budget.transmission) {
    return {
      color: '#DCE6ED',
      transmission: 0.92,
      thickness: 0.6,
      ior: 1.46,
      roughness: 0.08,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.06,
      /** Slight tint through thickness, like real lab glass. */
      attenuationColor: '#9FBCCB',
      attenuationDistance: 2.4,
      envMapIntensity: 1.1,
      side: FrontSide,
    } as const;
  }

  // Without transmission the glass leans entirely on reflection: a hard
  // clearcoat over a low-opacity body, with the environment doing the work.
  return {
    color: '#C4D4DF',
    roughness: 0.1,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    transparent: true,
    opacity: 0.34,
    envMapIntensity: 2.2,
    side: FrontSide,
  } as const;
}

/* -------------------------------------------------------------------------- */
/* Metal — anodised and surgical, never chrome                                 */
/* -------------------------------------------------------------------------- */

/**
 * Anodised aluminium: the Apple-hardware surface. Fully metallic but with
 * enough roughness to scatter the key into a soft, wide highlight rather than a
 * hard mirror dot. The faint warm tint keeps it from going blue-steel.
 */
export const aluminium = {
  color: '#AEB4BC',
  metalness: 1,
  roughness: 0.34,
  envMapIntensity: 1.15,
} as const;

/** Surgical steel for crimp collars and instrument frames. Tighter highlight. */
export const steel = {
  color: '#C2C8D0',
  metalness: 1,
  roughness: 0.22,
  envMapIntensity: 1.25,
} as const;

/** Darkened machined housing. Reads as the chassis behind the product. */
export const housing = {
  color: neutral.n05,
  metalness: 0.85,
  roughness: 0.45,
  envMapIntensity: 0.7,
} as const;

/* -------------------------------------------------------------------------- */
/* Ceramic and gelatin — the pharmaceutical surfaces                           */
/* -------------------------------------------------------------------------- */

/** The tablet's base colour, needed outside the material factory. */
export const CERAMIC_COLOR = '#E4E0D8';

/**
 * Compressed tablet: a matte mineral surface with real subsurface softness.
 * Clearcoat at low intensity stands in for the faint film-coat sheen without
 * the cost of true subsurface scattering.
 *
 * Clearcoat is a second specular lobe -- it roughly doubles the BRDF work per
 * fragment. Negligible on a discrete GPU across a handful of objects, but it is
 * real cost on the low tier, where the sheen is dropped entirely.
 */
export function ceramic(budget: QualityBudget) {
  return {
    color: CERAMIC_COLOR,
    roughness: 0.52,
    metalness: 0,
    // High tier only — see the liquid in SerumBottle for the reasoning.
    clearcoat: budget.tier === 'high' ? 0.35 : 0,
    clearcoatRoughness: 0.5,
    envMapIntensity: 0.55,
  } as const;
}

/**
 * Capsule shell. Gelatin is glossy, slightly translucent and picks up a strong
 * rim -- the highlight running down its length is what makes it read as a
 * capsule rather than a coloured pill-shaped solid.
 */
export function gelatin(color: string, budget: QualityBudget) {
  const low = budget.tier === 'low';
  return {
    color,
    // Low tier drops to a single specular lobe and compensates with tighter
    // roughness, which keeps the long barrel highlight that identifies a
    // capsule while halving the shading cost.
    roughness: low ? 0.16 : 0.24,
    metalness: 0,
    clearcoat: low ? 0 : 1,
    clearcoatRoughness: 0.14,
    sheen: budget.tier === 'high' ? 0.4 : 0,
    sheenColor: '#FFFFFF',
    envMapIntensity: low ? 1.2 : 0.9,
  } as const;
}

/* -------------------------------------------------------------------------- */
/* Holographic — a projected measurement, not a sci-fi interface               */
/* -------------------------------------------------------------------------- */

/**
 * The holographic direction is deliberately restrained: single hue, additive,
 * low opacity, no depth writing, no rainbow iridescence and no glitch. It should
 * read as light projected onto air by an instrument -- an overlay that measures
 * the object rather than decorating it.
 */
export function hologram(color: string, opacity = 0.22) {
  return {
    color,
    transparent: true,
    opacity,
    blending: AdditiveBlending,
    depthWrite: false,
    side: DoubleSide,
    toneMapped: false,
  } as const;
}

/**
 * Emissive accents. Kept to SMALL areas: a hairline, a node, a seal segment.
 * Large emissive surfaces are what make a scene look like a games console.
 * `toneMapped: false` lets these sit above the ACES curve and actually glow.
 *
 * Always pass the `base` step, never `light` or `glow`. Emissive intensity
 * multiplies the colour and, with tone mapping bypassed, an already-pale step
 * clips every channel to 1.0 and the accent washes out to white -- the hue is
 * lost precisely where it was supposed to identify the chapter.
 */
export function emissive(color: string, intensity = 1.4) {
  return {
    color,
    emissive: color,
    emissiveIntensity: intensity,
    roughness: 0.4,
    metalness: 0,
    toneMapped: false,
  } as const;
}

/** Hairline wireframe used for structure, lattices and technical overlays. */
export function hairline(color: string, opacity = 0.3) {
  return {
    color,
    wireframe: true,
    transparent: true,
    opacity,
    depthWrite: false,
    toneMapped: false,
  } as const;
}

/* -------------------------------------------------------------------------- */
/* Particles                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * Particle direction: sterile airborne motes in a laminar-flow cabinet.
 *
 * NOT sparks, NOT digital rain, NOT a starfield. They are small, dim, slow and
 * unsaturated. Their job is to make the empty space read as air with depth --
 * you should notice them only when you look for them.
 */
export const mote = {
  size: 0.028,
  color: neutral.n10,
  opacity: 0.34,
  /** Brighter motes catching the key light, used sparsely. */
  highlightColor: accent.pharma.light,
  highlightRatio: 0.06,
} as const;
