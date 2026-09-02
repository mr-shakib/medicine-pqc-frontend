/** Small, allocation-free math helpers shared across the experience. */

export const clamp = (v: number, min = 0, max = 1): number =>
  v < min ? min : v > max ? max : v;

/** Linear interpolation. */
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Map `v` from range [inMin, inMax] into [outMin, outMax], unclamped. */
export const remap = (
  v: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number => outMin + ((v - inMin) / (inMax - inMin)) * (outMax - outMin);

/** Map `v` from [inMin, inMax] into [0, 1], clamped. */
export const range = (v: number, inMin: number, inMax: number): number =>
  clamp((v - inMin) / (inMax - inMin));

/** Hermite smoothstep between two edges. */
export const smoothstep = (edge0: number, edge1: number, v: number): number => {
  const t = clamp((v - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

/**
 * A 0 -> 1 -> 0 envelope. Returns 1 while `v` is inside [start+fade, end-fade]
 * and eases to 0 outside [start, end]. Used to fade scenes in and out.
 */
export const envelope = (
  v: number,
  start: number,
  end: number,
  fade = 0.15,
): number => {
  const inner = Math.min(fade, (end - start) * 0.5);
  return (
    smoothstep(start, start + inner, v) * (1 - smoothstep(end - inner, end, v))
  );
};

/**
 * Frame-rate independent exponential damping.
 * `smoothing` is the fraction of the remaining distance left after 1 second.
 */
export const damp = (
  current: number,
  target: number,
  smoothing: number,
  dt: number,
): number => lerp(target, current, Math.exp(Math.log(smoothing) * dt));

/** Deterministic pseudo-random in [0,1) from an integer seed. */
export const seededRandom = (seed: number): number => {
  const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453123;
  return x - Math.floor(x);
};

/**
 * Largest frame delta any damped motion is allowed to see, in seconds.
 *
 * The clamp exists so a backgrounded tab, which returns with a delta of many
 * seconds, cannot teleport the camera on the frame it comes back. But set too
 * tight it does real harm: at anything below 1/CLAMP frames per second the
 * damping advances less than wall-clock time, so the camera falls progressively
 * behind the scroll and a merely low frame rate turns into visible LAG on top
 * of it — the two compound.
 *
 * At 1/10 the motion stays true down to 10fps and the teleport guard still
 * holds, since a tab restore is orders of magnitude larger.
 */
export const MAX_FRAME_DELTA = 1 / 10;

/** Clamp a frame delta for use in frame-rate-independent damping. */
export const frameDelta = (delta: number): number =>
  delta < MAX_FRAME_DELTA ? delta : MAX_FRAME_DELTA;
