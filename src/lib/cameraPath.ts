import { CatmullRomCurve3, Vector3 } from 'three';
import { SCENES, sceneProgressAt, sceneWeight, SCROLL_SPAN } from '@/lib/scenes';
import { clamp } from '@/lib/math';

/**
 * The camera travels one continuous path through the world, defined as a list
 * of keys that each declare the exact global scroll progress at which the
 * camera is standing on that mark.
 *
 * Keys are deliberately NOT one-per-chapter. A chapter can be approached from a
 * distant establishing mark before it settles, which is what the opening does:
 * an OPENING key far back at progress 0, then chapter 01's own key partway into
 * its band. Anything the story needs -- a hold, an overshoot, a pull-back --
 * is a key, not a special case in the rig.
 */
export interface CameraKey {
  /** Global scroll progress at which the camera is exactly here. */
  at: number;
  position: Vector3;
  target: Vector3;
}

/**
 * Where the experience opens: far back from the core, slightly above it,
 * looking into the dark. The first chapter's job is to close this distance.
 */
const OPENING_POSITION = new Vector3(0, 1.5, 26);
const OPENING_POSITION_MOBILE = new Vector3(0, 1.1, 33);

function buildKeys(mobile: boolean): CameraKey[] {
  const keys: CameraKey[] = [];
  const firstAnchor = SCENES[0].anchor;

  keys.push({
    at: 0,
    position: (mobile ? OPENING_POSITION_MOBILE : OPENING_POSITION).clone(),
    target: new Vector3(firstAnchor[0], firstAnchor[1], firstAnchor[2]),
  });

  for (const scene of SCENES) {
    const [ax, ay, az] = scene.anchor;
    const [ox, oy, oz] = mobile ? scene.mobileCameraOffset : scene.cameraOffset;

    // A chapter's key sits `cameraArrival` of the way into its own band, so a
    // chapter can be approached across its opening stretch rather than being
    // on its mark the instant it is framed.
    const arrival = scene.cameraArrival ?? 0;
    const at =
      sceneProgressAt(scene.index) +
      (arrival * sceneWeight(scene.index)) / SCROLL_SPAN;

    keys.push({
      at: clamp(at),
      position: new Vector3(ax + ox, ay + oy, az + oz),
      target: new Vector3(ax, ay, az),
    });

    if (scene.cameraExit) {
      const exit = scene.cameraExit;
      const [ex, ey, ez] =
        mobile && exit.mobileOffset ? exit.mobileOffset : exit.offset;

      keys.push({
        at: clamp(
          sceneProgressAt(scene.index) +
            (exit.at * sceneWeight(scene.index)) / SCROLL_SPAN,
        ),
        position: new Vector3(ax + ex, ay + ey, az + ez),
        target: new Vector3(ax, ay, az),
      });
    }
  }

  keys.sort((a, b) => a.at - b.at);

  // The progress -> arc map below needs strictly increasing keys. Two keys
  // can only coincide through clamping at the end of the scroll; nudge the
  // later one so it still has a (vanishing) segment of its own.
  for (let i = 1; i < keys.length; i++) {
    if (keys[i].at <= keys[i - 1].at) keys[i].at = keys[i - 1].at + 1e-4;
  }

  return keys;
}

/* -------------------------------------------------------------------------- */
/* Progress -> distance along the path                                         */
/* -------------------------------------------------------------------------- */

/**
 * A monotone cubic map from scroll progress to a fraction of the path's length
 * (Fritsch-Carlson tangents).
 *
 * This is the whole reason the motion no longer steps. Keys are unevenly
 * spaced in progress and the marks are unevenly spaced in the world -- a
 * chapter's hold moves the camera a couple of units, the flight to the next
 * chapter fifty -- so any per-segment easing has to come to rest at every key
 * to hide the speed change, and the camera visibly stops and starts fifteen
 * times down the page. Mapping progress to ARC LENGTH with a C1 curve makes
 * the camera's world speed continuous everywhere: it slows through a hold and
 * accelerates into a flight without ever halting. Monotone tangents keep it
 * from overshooting or backing up on a short segment next to a long one.
 */
interface MonotoneMap {
  t: Float64Array;
  v: Float64Array;
  m: Float64Array;
}

function buildMonotone(t: number[], v: number[]): MonotoneMap {
  const n = t.length;
  const h = new Float64Array(n - 1);
  const d = new Float64Array(n - 1);
  for (let k = 0; k < n - 1; k++) {
    h[k] = t[k + 1] - t[k];
    d[k] = h[k] > 1e-9 ? (v[k + 1] - v[k]) / h[k] : 0;
  }

  const m = new Float64Array(n);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let k = 1; k < n - 1; k++) {
    if (d[k - 1] * d[k] <= 0) {
      // A flat or turning neighbour: rest here, so a hold is a genuine hold.
      m[k] = 0;
    } else {
      const w1 = 2 * h[k] + h[k - 1];
      const w2 = h[k] + 2 * h[k - 1];
      m[k] = (w1 + w2) / (w1 / d[k - 1] + w2 / d[k]);
    }
  }

  return { t: Float64Array.from(t), v: Float64Array.from(v), m };
}

function evalMonotone(map: MonotoneMap, p: number): number {
  const { t, v, m } = map;
  const last = t.length - 1;
  if (p <= t[0]) return v[0];
  if (p >= t[last]) return v[last];

  let k = 0;
  while (k < last - 1 && p > t[k + 1]) k++;

  const h = t[k + 1] - t[k];
  const u = (p - t[k]) / h;
  const u2 = u * u;
  const u3 = u2 * u;

  const h00 = 2 * u3 - 3 * u2 + 1;
  const h10 = u3 - 2 * u2 + u;
  const h01 = -2 * u3 + 3 * u2;
  const h11 = u3 - u2;

  return h00 * v[k] + h10 * h * m[k] + h01 * v[k + 1] + h11 * h * m[k + 1];
}

/* -------------------------------------------------------------------------- */
/* The path                                                                    */
/* -------------------------------------------------------------------------- */

export interface CameraPath {
  keys: CameraKey[];
  /** The camera's route through the world, through every key in order. */
  position: CatmullRomCurve3;
  positionMap: MonotoneMap;
  /** The aim's route: a polyline through the distinct subjects. */
  targets: Vector3[];
  /** Cumulative length along `targets`, normalised 0 -> 1. */
  targetLengths: Float64Array;
  targetMap: MonotoneMap;
}

/**
 * Arc-length samples per key segment.
 *
 * The curve's own parameter runs at very different rates on a short hold
 * segment and the long flight after it, and within a sample the arc-length
 * lookup is linear. Too few samples and the speed steps at each key by
 * however much the parameter rate changes across one sample; at this density
 * the step is under a percent. The table is built once and searched by
 * bisection, so the density costs nothing per frame.
 */
const ARC_SAMPLES_PER_SEGMENT = 2000;

function buildPath(mobile: boolean): CameraPath {
  const keys = buildKeys(mobile);
  const at = keys.map((key) => key.at);

  /*
    Position: a centripetal Catmull-Rom through every mark. Centripetal rather
    than uniform because the marks alternate between close pairs (arrival and
    exit, a few units apart) and long flights; the uniform variant loops and
    overshoots on exactly that layout, the centripetal one never does.
  */
  const position = new CatmullRomCurve3(
    keys.map((key) => key.position),
    false,
    'centripetal',
  );
  position.arcLengthDivisions = (keys.length - 1) * ARC_SAMPLES_PER_SEGMENT;
  const lengths = position.getLengths();
  const total = lengths[lengths.length - 1] || 1;
  const positionArc = keys.map(
    (_, i) => lengths[i * ARC_SAMPLES_PER_SEGMENT] / total,
  );

  /*
    Aim: straight lines between the DISTINCT subjects.

    Consecutive keys usually share a target -- arrival and exit both look at
    the chapter's anchor -- and a spline through repeated points makes a small
    loop out of each repeat, which would drag the aim off the subject during
    its own hold. Deduplicating collapses each hold to a single point and a
    zero-length span, and the monotone map then rests there exactly. The path
    between subjects can be straight because the aim only moves when its
    speed is zero at both ends: a corner taken at rest is invisible.
  */
  const targets: Vector3[] = [];
  const targetIndex: number[] = [];
  for (const key of keys) {
    const last = targets[targets.length - 1];
    if (!last || last.distanceToSquared(key.target) > 1e-8) {
      targets.push(key.target.clone());
    }
    targetIndex.push(targets.length - 1);
  }

  const targetLengths = new Float64Array(targets.length);
  for (let i = 1; i < targets.length; i++) {
    targetLengths[i] =
      targetLengths[i - 1] + targets[i].distanceTo(targets[i - 1]);
  }
  const targetTotal = targetLengths[targets.length - 1] || 1;
  for (let i = 0; i < targets.length; i++) targetLengths[i] /= targetTotal;

  return {
    keys,
    position,
    positionMap: buildMonotone(at, positionArc),
    targets,
    targetLengths,
    targetMap: buildMonotone(
      at,
      targetIndex.map((i) => targetLengths[i]),
    ),
  };
}

export const desktopPath = buildPath(false);
export const mobilePath = buildPath(true);

export const getCameraPath = (mobile: boolean): CameraPath =>
  mobile ? mobilePath : desktopPath;

/* -------------------------------------------------------------------------- */
/* Sampling                                                                    */
/* -------------------------------------------------------------------------- */

function samplePolyline(
  points: Vector3[],
  lengths: Float64Array,
  a: number,
  out: Vector3,
): void {
  const last = points.length - 1;
  if (last <= 0 || a <= 0) {
    out.copy(points[0]);
    return;
  }
  if (a >= 1) {
    out.copy(points[last]);
    return;
  }

  let i = 0;
  while (i < last - 1 && a > lengths[i + 1]) i++;

  const span = lengths[i + 1] - lengths[i];
  const u = span > 1e-9 ? (a - lengths[i]) / span : 0;
  out.copy(points[i]).lerp(points[i + 1], u);
}

/**
 * Sample the path at global progress `p`, writing into the supplied vectors.
 * Allocation-free: safe to call every frame.
 */
export function sampleCameraPath(
  path: CameraPath,
  p: number,
  outPosition: Vector3,
  outTarget: Vector3,
): void {
  path.position.getPointAt(
    clamp(evalMonotone(path.positionMap, p)),
    outPosition,
  );
  samplePolyline(
    path.targets,
    path.targetLengths,
    clamp(evalMonotone(path.targetMap, p)),
    outTarget,
  );
}

/**
 * Responsive field of view. Portrait viewports get a wider lens so subjects stay
 * framed rather than cropped.
 */
export function responsiveFov(aspect: number): number {
  const a = clamp(aspect, 0.45, 1.8);
  return 34 + (1 - (a - 0.45) / 1.35) * 22;
}
