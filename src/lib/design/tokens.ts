/**
 * MedSecure PQC — design tokens.
 *
 * The single source of truth for colour, type, motion and elevation. These
 * values are mirrored as CSS custom properties in `src/styles/globals.css`, so
 * the DOM layer and the WebGL layer grade identically.
 *
 * See DESIGN_SYSTEM.md for the reasoning behind every value here.
 */

/* -------------------------------------------------------------------------- */
/* Neutrals                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * A 13-step cool-cast neutral ramp. Every step carries a slight blue bias
 * (hue ~220) rather than being a pure grey: warm light reading against a subtly
 * cool ground is what makes a dark studio feel like a space rather than a void.
 *
 * Steps 00-05 are surfaces, 06-08 are lines and borders, 09-12 are type.
 */
export const neutral = {
  /** Deepest ground. The page base and the far end of the fog. */
  n00: '#06070A',
  n01: '#090B0F',
  /** The chamber the objects float inside. */
  n02: '#0D0F15',
  n03: '#11141B',
  n04: '#161A22',
  n05: '#1C212A',
  /** Hairlines and dividers. */
  n06: '#242A35',
  n07: '#2F3542',
  n08: '#414957',
  /** Dimmed / disabled type. */
  n09: '#5C6474',
  /** Body copy. 5.8:1 on n00. */
  n10: '#8A93A3',
  /** Secondary copy and subtitles. 10.2:1 on n00. */
  n11: '#B9C0CC',
  /** Primary type. Never pure white -- #FFF on near-black glares. */
  n12: '#E9ECF1',
} as const;

/* -------------------------------------------------------------------------- */
/* Accents                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Four semantic accent families, plus a verification state.
 *
 * Every `base` step sits in a narrow band -- saturation 23-45%, lightness
 * 51-58% -- which is what makes five different hues read as one system. Fully
 * saturated colour is what makes an interface look like a game or a hacker
 * movie; these are pigments, not lights.
 *
 * Each family has four steps with distinct jobs:
 *   deep  -- shadowed material, deep tints, pressed states
 *   base  -- the material colour of an object; the token you reach for first
 *   light -- lit faces, hovered chrome, secondary type on accent
 *   glow  -- emissive highlights ONLY, and only over small areas
 */
export const accent = {
  /** Pharmaceutical objects. The single warm hue in a cool system. */
  pharma: {
    deep: '#6E5030',
    base: '#BE8B4E',
    light: '#DFB98A',
    glow: '#F2DCBC',
  },
  /** AI, measurement, inspection. Calm instrument blue. */
  analysis: {
    deep: '#1F4C56',
    base: '#5C9AA8',
    light: '#96C4CE',
    glow: '#C6E2E8',
  },
  /** Post-quantum cryptography, lattice structure. Muted indigo. */
  lattice: {
    deep: '#33356B',
    base: '#6E70B8',
    light: '#A3A5D8',
    glow: '#CFD0EC',
  },
  /** Counterfeit and tamper. Reserved -- never decorative. */
  alert: {
    deep: '#6E2A28',
    base: '#C0605A',
    light: '#DC908B',
    glow: '#F0C0BC',
  },
  /** Authenticated. Calm sage, deliberately not a signal green. */
  verified: {
    deep: '#2C5240',
    base: '#6FA588',
    light: '#A3C9B4',
    glow: '#CFE3D8',
  },
} as const;

export type AccentFamily = keyof typeof accent;
export type AccentStep = keyof typeof accent.pharma;

/** Resolve an accent family and step to a hex string. */
export const accentColor = (
  family: AccentFamily,
  step: AccentStep = 'base',
): string => accent[family][step];

/* -------------------------------------------------------------------------- */
/* Light                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Studio lighting colours.
 *
 * The rig is a product-photography setup, not a game scene: a large warm key,
 * a cool fill at a fraction of its power, and an accent rim that carries the
 * current chapter's hue. Warm key against cool fill is what gives dark product
 * imagery its sense of dimension.
 */
export const light = {
  /** Large soft key. Warm white, like a tungsten-balanced softbox. */
  key: '#FFF4E8',
  /** Opposing fill. Cool white, roughly a quarter of the key's intensity. */
  fill: '#DCE8F2',
  /** Bounce off the imagined chamber floor. */
  bounce: '#2A3340',
  /** Ambient floor so nothing is ever crushed to pure black. */
  ambient: '#0F131A',
} as const;

/* -------------------------------------------------------------------------- */
/* Atmosphere                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Exponential-squared fog. This is a compositional tool, not just a depth cue:
 * it dissolves chapters the camera has not reached yet, so a distant station
 * never bleeds into the frame of the one being viewed, and it is what lets the
 * opening core genuinely emerge FROM darkness as the camera closes on it.
 *
 * Custom shaders must apply this themselves -- see `uFogDensity` in
 * `shaders/medicineCore` -- since ShaderMaterial gets no fog for free.
 */
export const fog = {
  density: 0.034,
  color: neutral.n00,
} as const;

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

/* -------------------------------------------------------------------------- */
/* Convenience aliases                                                         */
/* -------------------------------------------------------------------------- */

/** Semantic shortcuts for the values reached for most often. */
export const color = {
  void: neutral.n00,
  chamber: neutral.n02,
  surface: neutral.n04,
  hairline: neutral.n06,
  textPrimary: neutral.n12,
  textSecondary: neutral.n11,
  textBody: neutral.n10,
  textMuted: neutral.n09,
} as const;
