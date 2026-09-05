/**
 * MedSecure PQC — design tokens.
 *
 * The single source of truth for colour, type, motion and elevation. The
 * colour half is not constant: the piece runs in two palettes, and everything
 * that draws -- both layers -- reads it from here.
 *
 * `neutral`, `accent`, `light`, `fog` and `mark` are LIVE BINDINGS onto the
 * active palette rather than frozen objects. An importer that reads
 * `accent.pharma.base` at the moment it builds a material gets the current
 * palette's value; one that copied it into a module-level constant at import
 * time would not, which is why nothing in this project may do that. The 3D
 * scene is rebuilt when the theme changes, so every material is constructed
 * again against the palette that is current then.
 *
 * The DOM does not read these at all in the common case: `globals.css` carries
 * the same twelve neutrals and five accents as custom properties, switched by
 * `html[data-theme]`, so every `bg-n00` and `text-n12` in the markup means the
 * same role in both palettes and needs no variant.
 *
 * See DESIGN_SYSTEM.md for the reasoning behind every value, and
 * `lib/design/palette.ts` for the two palettes themselves.
 */

import {
  DEFAULT_THEME,
  PALETTES,
  type AccentSet,
  type AccentSteps,
  type BackdropSettings,
  type FogSettings,
  type LightRig,
  type MarkModel,
  type NeutralRamp,
  type Palette,
  type Theme,
} from '@/lib/design/palette';

export type { Theme, Palette };
export type AccentFamily = keyof AccentSet;
export type AccentStep = keyof AccentSteps;

let active: Palette = PALETTES[DEFAULT_THEME];

/** The 13-step neutral ramp of the active palette. See `NeutralRamp`. */
export let neutral: NeutralRamp = active.neutral;
/** The five semantic accent families of the active palette. */
export let accent: AccentSet = active.accent;
/** The studio rig colours of the active palette. */
export let light: LightRig = active.light;
/** Exponential-squared fog. A compositional tool as much as a depth cue: it
 *  dissolves chapters the camera has not reached, so a distant station never
 *  bleeds into the frame of the one being viewed. Custom shaders must apply it
 *  themselves -- see `uFogDensity` -- since ShaderMaterial gets no fog free. */
export let fog: FogSettings = active.fog;
/** The cyclorama of the active palette. See `BackdropSettings`. */
export let backdrop: BackdropSettings = active.backdrop;
/** How annotation is drawn against the active ground. See `MarkModel`. */
export let mark: MarkModel = active.mark;
/** Semantic shortcuts for the values reached for most often. */
export let color = aliases(active.neutral);

function aliases(ramp: NeutralRamp) {
  return {
    void: ramp.n00,
    chamber: ramp.n02,
    surface: ramp.n04,
    hairline: ramp.n06,
    textPrimary: ramp.n12,
    textSecondary: ramp.n11,
    textBody: ramp.n10,
    textMuted: ramp.n09,
  } as const;
}

/**
 * Point the token bindings at a palette.
 *
 * Called before the 3D scene is rebuilt, never during a frame: materials read
 * these once, when they are constructed, and a palette that moved underneath a
 * live scene would leave half of it lit by the other theme.
 */
export function setPaletteTheme(theme: Theme): void {
  active = PALETTES[theme];
  neutral = active.neutral;
  accent = active.accent;
  light = active.light;
  backdrop = active.backdrop;
  fog = active.fog;
  mark = active.mark;
  color = aliases(active.neutral);
}

/** Resolve an accent family and step to a hex string in the active palette. */
export const accentColor = (
  family: AccentFamily,
  step: AccentStep = 'base',
): string => accent[family][step];

/* -------------------------------------------------------------------------- */
/* Typography                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Fluid type scale. Every size is a clamp so there are no breakpoint jumps.
 *
 * Display sizes run LIGHT (200-300) with tight negative tracking -- large text
 * needs less weight and less space to read as confident. Body copy runs at 400
 * with open line-height. There are only three weights in the whole system.
 */
export const type = {
  displayXl: 'clamp(2.75rem, 7.5vw, 7rem)',
  displayL: 'clamp(2.25rem, 5vw, 4.25rem)',
  displayM: 'clamp(1.75rem, 3.2vw, 2.75rem)',
  lead: 'clamp(1.0625rem, 1.5vw, 1.3125rem)',
  body: 'clamp(0.9375rem, 1.05vw, 1.0625rem)',
  caption: '0.8125rem',
  label: '0.6875rem',
} as const;

export const tracking = {
  display: '-0.035em',
  headline: '-0.02em',
  body: '0em',
  label: '0.24em',
} as const;

export const weight = {
  light: 250,
  regular: 400,
  medium: 500,
} as const;

/* -------------------------------------------------------------------------- */
/* Motion                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Motion constants.
 *
 * `damp*` values are the fraction of remaining distance left after one second,
 * fed to the frame-rate-independent damper in `lib/math`. Smaller is faster.
 */
export const motion = {
  dampCamera: 0.0015,
  dampAim: 0.004,
  dampMaterial: 0.01,
  dampSlow: 0.05,

  /** DOM transition durations, in ms. */
  micro: 240,
  element: 600,
  scene: 1200,

  /** Decelerating ease for anything entering. Premium motion never bounces. */
  easeOut: 'cubic-bezier(0.22, 1, 0.36, 1)',
  /** Symmetric ease for anything that moves and settles. */
  easeInOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
} as const;

