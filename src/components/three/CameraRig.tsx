'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { PerspectiveCamera, Vector3 } from 'three';
import { scrollStore } from '@/lib/scrollStore';
import {
  getCameraKeys,
  responsiveFov,
  sampleCameraPath,
} from '@/lib/cameraPath';
import { damp } from '@/lib/math';

/** Module-level scratch vectors -- the frame loop must never allocate. */
const desiredPosition = new Vector3();
const desiredTarget = new Vector3();
const smoothedTarget = new Vector3();
const aimPoint = new Vector3();
const forward = new Vector3();
const right = new Vector3();
const trueUp = new Vector3();
const WORLD_UP = new Vector3(0, 1, 0);

/**
 * How far off-centre the subject sits, as a fraction of the visible half-extent
 * at the subject's distance. Expressing it this way rather than in world units
 * keeps the composition identical at every focal length and viewport size.
 */
const DESKTOP_X_FRAMING = 0.34; // subject sits right of the copy column
const MOBILE_Y_FRAMING = 0.3; // subject sits above the bottom-anchored copy

export interface CameraRigProps {
  /** Use the portrait camera offsets and a wider lens. */
  mobile: boolean;
  /** Normalised pointer position for parallax; pass a zeroed ref to disable. */
  pointer: React.RefObject<{ x: number; y: number }>;
  /** Collapse easing to near-instant for reduced-motion users. */
  reducedMotion: boolean;
}

/**
 * Flies the camera along the world spline defined in `lib/cameraPath`, then
 * applies a compositional offset so the subject never sits underneath the copy.
 *
 * Position and aim are damped independently, which is what makes the motion read
 * as a camera operator rather than a rail. All damping is frame-rate independent,
 * so a 144 Hz display and a throttled 30 fps phone trace the same curve.
 */
export default function CameraRig({
  mobile,
  pointer,
  reducedMotion,
}: CameraRigProps) {
  const initialised = useRef(false);

  // `camera` and `size` are read from the per-frame state rather than `useThree`
  // so that mutating them stays inside the render loop, where it belongs.
  useFrame((state, delta) => {
    const { camera, size } = state;
    // Clamp delta so a backgrounded tab does not teleport the camera on return.
    const dt = Math.min(delta, 1 / 20);
    const keys = getCameraKeys(mobile);
    sampleCameraPath(keys, scrollStore.smooth, desiredPosition, desiredTarget);

    // Subtle pointer parallax, disabled on touch and on the wider mobile lens.
    const parallax = mobile ? 0 : 0.55;
    desiredPosition.x += pointer.current.x * parallax;
    desiredPosition.y += -pointer.current.y * parallax * 0.6;

    const posSmoothing = reducedMotion ? 0.000001 : 0.0015;
    const aimSmoothing = reducedMotion ? 0.000001 : 0.004;

    if (!initialised.current) {
      camera.position.copy(desiredPosition);
      smoothedTarget.copy(desiredTarget);
      initialised.current = true;
    } else {
      camera.position.set(
        damp(camera.position.x, desiredPosition.x, posSmoothing, dt),
        damp(camera.position.y, desiredPosition.y, posSmoothing, dt),
        damp(camera.position.z, desiredPosition.z, posSmoothing, dt),
      );
      smoothedTarget.set(
        damp(smoothedTarget.x, desiredTarget.x, aimSmoothing, dt),
        damp(smoothedTarget.y, desiredTarget.y, aimSmoothing, dt),
        damp(smoothedTarget.z, desiredTarget.z, aimSmoothing, dt),
      );
    }

    const aspect = size.width / size.height;
    const fov = responsiveFov(aspect);

    if (camera instanceof PerspectiveCamera && Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }

    // --- Compositional framing -------------------------------------------
    // Aiming to one side of the subject pushes the subject to the other side of
    // the frame. The offset is derived from the view frustum at the subject's
    // distance, so the composition holds at any viewport size or focal length.
    forward.copy(smoothedTarget).sub(camera.position);
    const distance = forward.length();
    forward.divideScalar(distance || 1);

    right.crossVectors(forward, WORLD_UP).normalize();
    trueUp.crossVectors(right, forward).normalize();

    const halfHeight = distance * Math.tan((fov * Math.PI) / 360);
    const halfWidth = halfHeight * aspect;

    aimPoint.copy(smoothedTarget);
    if (mobile) {
      aimPoint.addScaledVector(trueUp, -halfHeight * MOBILE_Y_FRAMING);
    } else {
      aimPoint.addScaledVector(right, -halfWidth * DESKTOP_X_FRAMING);
    }

    camera.lookAt(aimPoint);
  });

  return null;
}
