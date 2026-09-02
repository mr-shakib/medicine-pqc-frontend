import { Vector3 } from 'three';
import { SCENES, sceneProgressAt, sceneWeight, SCROLL_SPAN } from '@/lib/scenes';
import { clamp, smoothstep } from '@/lib/math';

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

  return keys.sort((a, b) => a.at - b.at);
}

export const desktopKeys = buildKeys(false);
export const mobileKeys = buildKeys(true);

export const getCameraKeys = (mobile: boolean) =>
  mobile ? mobileKeys : desktopKeys;

/* -------------------------------------------------------------------------- */
/* Sampling                                                                    */
/* -------------------------------------------------------------------------- */

/** Scratch vectors -- the frame loop must never allocate. */
const scratch = new Vector3();

/**
 * Tension for the camera POSITION curve.
 *
 * A Cardinal spline's tangent at a key is `tension * (next - previous)`, so at
 * 0.5 it is a plain Catmull-Rom and at 0 it is a straight line. Low tension
 * keeps a gentle arc between marks without letting a distant next key bend the
 * path before the camera has finished with the current one.
 */
const POSITION_TENSION = 0.22;

/**
 * Tension for the AIM curve — deliberately zero.
 *
 * With any tension at all, the tangent at a chapter's last key points at the
 * NEXT chapter's subject, which drags the aim point off the current subject
 * while the camera is still supposed to be looking at it. In chapter 02 that
 * showed up as the finished capsule sliding toward the edge of frame during
 * its hold. Where the camera LOOKS should never anticipate; only where it
 * travels should.
 */
const TARGET_TENSION = 0;

/**
 * Cardinal spline through four control points at local parameter `u`.
 *
 * Hermite form: value and tangent are specified at each end, and the tangents
 * are scaled by `tension`.
 */
function cardinal(
  p0: Vector3,
  p1: Vector3,
  p2: Vector3,
  p3: Vector3,
  u: number,
  tension: number,
  out: Vector3,
): Vector3 {
  const u2 = u * u;
  const u3 = u2 * u;

  const h00 = 2 * u3 - 3 * u2 + 1;
  const h10 = u3 - 2 * u2 + u;
  const h01 = -2 * u3 + 3 * u2;
  const h11 = u3 - u2;

  out.copy(p1).multiplyScalar(h00);
  out.addScaledVector(p2, h01);

  if (tension !== 0) {
    scratch.copy(p2).sub(p0).multiplyScalar(tension * h10);
    out.add(scratch);
    scratch.copy(p3).sub(p1).multiplyScalar(tension * h11);
    out.add(scratch);
  }

  return out;
}

/**
 * Sample the path at global progress `p`, writing into the supplied vectors.
 *
 * The local parameter is eased with a smoothstep before evaluation. That has
 * one important consequence: the camera's velocity is zero at every key, from
 * both sides. Because keys are unevenly spaced in progress, a raw parameter
 * would make world-space speed jump at each mark; easing to a standstill
 * removes that discontinuity entirely and, as a bonus, gives the camera a
 * natural settle on arrival at each chapter.
 */
export function sampleCameraPath(
  keys: CameraKey[],
  p: number,
  outPosition: Vector3,
  outTarget: Vector3,
): void {
  const last = keys.length - 1;

  if (p <= keys[0].at) {
    outPosition.copy(keys[0].position);
    outTarget.copy(keys[0].target);
    return;
  }
  if (p >= keys[last].at) {
    outPosition.copy(keys[last].position);
    outTarget.copy(keys[last].target);
    return;
  }

  let i = 0;
  while (i < last - 1 && p > keys[i + 1].at) i++;

  const k0 = keys[Math.max(0, i - 1)];
  const k1 = keys[i];
  const k2 = keys[i + 1];
  const k3 = keys[Math.min(last, i + 2)];

  const span = k2.at - k1.at;
  const u = span > 1e-6 ? clamp((p - k1.at) / span) : 0;
  const eased = smoothstep(0, 1, u);

  cardinal(
    k0.position, k1.position, k2.position, k3.position,
    eased, POSITION_TENSION, outPosition,
  );
  cardinal(
    k0.target, k1.target, k2.target, k3.target,
    eased, TARGET_TENSION, outTarget,
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
