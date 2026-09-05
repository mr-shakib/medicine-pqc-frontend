/**
 * The two palettes the piece can be lit by.
 *
 * Light is not an inversion of dark, and could not be. The dark palette is a
 * studio with the lights off: annotation is drawn as ADDITIVE light, so a
 * hairline, a mote or a lattice edge is something added to blackness. Add the
 * same thing to white and nothing happens at all -- white plus anything is
 * still white. On a light ground those same marks have to be drawn the way a
 * technical drawing draws them, as ink laid onto paper.
 *
 * So each palette carries the colours AND the drawing model that goes with
 * them: how a mark is blended, what colour it is drawn in, and how much of the
 * emissive lift it keeps. `mark` is what lets one component satisfy both.
 */

/* -------------------------------------------------------------------------- */
/* Shape                                                                       */
/* -------------------------------------------------------------------------- */

export type Theme = 'light' | 'dark';

/**
 * A 13-step neutral ramp, addressed by ROLE rather than by lightness.
 *
 * n00 is always the ground the piece sits on and n12 is always primary type,
 * whichever way round those happen to be. That is the whole reason the DOM
 * needs no markup changes between themes: `bg-n00` and `text-n12` mean the
 * same thing in both, and only the twelve hex values move.
 *
 *   00-05 surfaces · 06-08 lines and borders · 09-12 type
 */
export interface NeutralRamp {
  n00: string; n01: string; n02: string; n03: string; n04: string;
  n05: string; n06: string; n07: string; n08: string; n09: string;
  n10: string; n11: string; n12: string;
}

/**
 * The four object-shading steps, plus the one drawing step.
 *
 * `deep`/`base`/`light`/`glow` describe how a solid object is shaded, and they
 * do NOT invert between themes: a shadowed face is darker than a lit one on
 * paper as much as in the dark. `ink` is the odd one out -- it is not a
 * property of an object at all, but the colour a mark is drawn ON THE GROUND
 * in, so it is the one step that flips: a pale line in the dark, a deep one in
 * the light.
 */
export interface AccentSteps {
  deep: string;
  base: string;
  light: string;
  glow: string;
  ink: string;
}

export interface AccentSet {
  pharma: AccentSteps;
  analysis: AccentSteps;
  lattice: AccentSteps;
  alert: AccentSteps;
  verified: AccentSteps;
}

export interface LightRig {
  key: string;
  fill: string;
  bounce: string;
  ambient: string;
  /**
   * Rig intensities.
   *
   * They are part of the palette because a light ground changes what the rig
   * is FOR. In the dark, separation comes from light falling off into
   * blackness, so the rig is mostly key with a quarter-power fill and a strong
   * rim to cut the subject out of the ground. On paper there is nothing to
   * fall off into: separation has to come from shading, so the fill comes up
   * to keep shadows open and the rim comes down, because a bright edge against
   * a bright ground reads as a blown highlight rather than as a silhouette.
   */
  keyIntensity: number;
  fillIntensity: number;
  rimIntensity: number;
  bounceIntensity: number;
}

/** The cyclorama the objects float against. */
export interface BackdropSettings {
  /** The lifted band behind the subject. */
  horizon: string;
  floor: string;
  ceiling: string;
  /** How strongly the chapter accent pools into the backdrop. */
  accentAmount: number;
  /**
   * How the accent is combined with the ground.
   *
   * Added on a dark ground, where a pool of light IS an addition. Multiplied
   * on a light one, where the same pool has to read as a tint the ground takes
   * on -- adding to something already near white does nothing at all.
   */
  accentMultiply: boolean;
}

export interface FogSettings {
  density: number;
  color: string;
}

/** How annotation is drawn against this palette's ground. */
export interface MarkModel {
  /** Additive builds light onto darkness; normal lays ink onto paper. */
  additive: boolean;
  /** Multiplier on a mark's opacity. Ink needs less than glow. */
  opacity: number;
  /**
   * Multiplier on emissive intensity. Near zero on a light ground: an emissive
   * term pushed above 1 clips to white, which on white is invisible.
   */
  emissive: number;
  /**
   * How much harder a mark has to be drawn to read.
   *
   * Additive marks accumulate: two faint edges crossing add up, and a whole
   * lattice of them builds into something legible out of contributions that
   * are individually almost nothing. Ink does not accumulate that way -- it
   * covers -- so the same alpha that reads as a bright structure against black
   * is a barely-there grey wash on paper. Applied where a mark's opacity is
   * set, not baked into the shaders.
   */
  density: number;
  /**
   * Renderer exposure. ACES maps 1.0 to about 0.8, so a light ground rendered
   * at the dark palette's exposure comes out grey rather than white.
   */
  exposure: number;
}

export interface Palette {
  neutral: NeutralRamp;
  accent: AccentSet;
  light: LightRig;
  backdrop: BackdropSettings;
  fog: FogSettings;
  mark: MarkModel;
}

/* -------------------------------------------------------------------------- */
/* Dark — the original chamber                                                 */
/* -------------------------------------------------------------------------- */

const DARK: Palette = {
  /**
   * Cool-cast, hue ~220. Every step carries a slight blue bias rather than
   * being a pure grey: warm light reading against a subtly cool ground is what
   * makes a dark studio feel like a space rather than a void.
   */
  neutral: {
    n00: '#06070A', n01: '#090B0F', n02: '#0D0F15', n03: '#11141B',
    n04: '#161A22', n05: '#1C212A', n06: '#242A35', n07: '#2F3542',
    n08: '#414957', n09: '#5C6474', n10: '#8A93A3', n11: '#B9C0CC',
    n12: '#E9ECF1',
  },
  /**
   * Every `base` sits in a narrow band -- saturation 23-45%, lightness 51-58%
   * -- which is what makes five different hues read as one system. Fully
   * saturated colour is what makes an interface look like a game; these are
   * pigments, not lights.
   */
  accent: {
    pharma: { deep: '#6E5030', base: '#BE8B4E', light: '#DFB98A', glow: '#F2DCBC', ink: '#DFB98A' },
    analysis: { deep: '#1F4C56', base: '#5C9AA8', light: '#96C4CE', glow: '#C6E2E8', ink: '#96C4CE' },
    lattice: { deep: '#33356B', base: '#6E70B8', light: '#A3A5D8', glow: '#CFD0EC', ink: '#A3A5D8' },
    alert: { deep: '#6E2A28', base: '#C0605A', light: '#DC908B', glow: '#F0C0BC', ink: '#DC908B' },
    verified: { deep: '#2C5240', base: '#6FA588', light: '#A3C9B4', glow: '#CFE3D8', ink: '#A3C9B4' },
  },
  light: {
    key: '#FFF4E8',
    fill: '#DCE8F2',
    bounce: '#2A3340',
    ambient: '#0F131A',
    keyIntensity: 2.1,
    fillIntensity: 0.52,
    rimIntensity: 1.5,
    bounceIntensity: 0.85,
  },
  backdrop: {
    horizon: '#11141B',
    floor: '#090B0F',
    ceiling: '#06070A',
    accentAmount: 0.085,
    accentMultiply: false,
  },
  fog: { density: 0.034, color: '#06070A' },
  mark: { additive: true, opacity: 1, emissive: 1, density: 1, exposure: 0.94 },
};

/* -------------------------------------------------------------------------- */
/* Light — the same studio, shot on a white cyclorama                          */
/* -------------------------------------------------------------------------- */

const LIGHT: Palette = {
  /**
   * The same cool cast, run the other way. Never pure white at the ground and
   * never pure black at the type: #FFF on a screen glares, and #000 text on it
   * has more contrast than the eye wants to hold for a page of reading.
   *
   * Type steps are checked against n00: n09 4.9:1, n10 6.9:1, n11 11.3:1,
   * n12 16.6:1.
   */
  neutral: {
    n00: '#F7F8FA', n01: '#F2F4F7', n02: '#EBEEF2', n03: '#E3E7ED',
    n04: '#D9DEE6', n05: '#CCD3DC', n06: '#B8C1CD', n07: '#A0ABBA',
    n08: '#8390A1', n09: '#626D7D', n10: '#4C5666', n11: '#2E3643',
    n12: '#131922',
  },
  /**
   * Deeper and more saturated than the dark set. The dark palette's steps were
   * chosen to sit on near-black, where a light desaturated pigment reads
   * clearly; the same colour on paper is a wash. `base` is pulled down to
   * roughly 30% lightness so it carries as an object colour and passes as
   * type, and `ink` is deeper still.
   */
  accent: {
    pharma: { deep: '#4A3418', base: '#8C6224', light: '#B98A45', glow: '#D9B37C', ink: '#6E4C18' },
    analysis: { deep: '#123840', base: '#2E6B78', light: '#5C9AA8', glow: '#96C4CE', ink: '#1C4E58' },
    lattice: { deep: '#242657', base: '#454796', light: '#6E70B8', glow: '#A3A5D8', ink: '#33356B' },
    alert: { deep: '#5A1B19', base: '#9C3A34', light: '#C0605A', glow: '#DC908B', ink: '#7A2622' },
    verified: { deep: '#1E3D2D', base: '#3E7359', light: '#6FA588', glow: '#A3C9B4', ink: '#2C5240' },
  },
  /**
   * Directional, and NOT high-key.
   *
   * The instinct on a white ground is to raise everything -- more fill, more
   * bounce, more exposure -- and it is wrong, which cost a whole pass to find
   * out. The subjects here are a white tablet, a translucent capsule and clear
   * glass; flood them with light on white and they disappear into it. What
   * separates a pale object from a pale ground is the SHADOW side and the
   * edge, so the key stays hard, the fill drops below the dark palette's, and
   * the rim comes right down -- a bright edge against a bright ground reads as
   * a blown highlight rather than as a silhouette.
   */
  light: {
    key: '#FFF8EE',
    fill: '#DCE6F2',
    bounce: '#C3CCD8',
    ambient: '#E8ECF1',
    keyIntensity: 2.6,
    fillIntensity: 0.42,
    rimIntensity: 0.35,
    bounceIntensity: 0.45,
  },
  /*
    Brightest at the horizon in both palettes -- a lifted band behind the
    subject is what a cyclorama IS -- but the whole thing runs near the top of
    the range instead of near the bottom.
  */
  backdrop: {
    horizon: '#FDFDFE',
    floor: '#E2E8EF',
    ceiling: '#EFF2F6',
    accentAmount: 0.1,
    accentMultiply: true,
  },
  /**
   * Fog toward the ground colour is aerial perspective, and it is the one part
   * of this that gets EASIER in the light: distance washing out to white is
   * what distance actually does.
   */
  fog: { density: 0.03, color: '#F7F8FA' },
  /*
    Exposure BELOW the dark palette's, not above it.

    The backdrop is a raw shader that writes its own final colour and is never
    tone mapped, so it holds whatever the palette says. Everything lit is tone
    mapped, so dropping the exposure darkens the objects while the ground stays
    where it is -- which is the entire separation between a pale product and
    the pale cyclorama behind it. Raising it, which is what the light ground
    first seemed to ask for, washes the two together.
  */
  mark: { additive: false, opacity: 0.9, emissive: 0.12, density: 2.3, exposure: 0.86 },
};

export const PALETTES: Record<Theme, Palette> = { light: LIGHT, dark: DARK };

export const DEFAULT_THEME: Theme = 'light';
