'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { PerspectiveCamera, Vector3 } from 'three';
import { scrollStore } from '@/lib/scrollStore';
import {
  getCameraPath,
  responsiveFov,
  sampleCameraPath,
} from '@/lib/cameraPath';
import { damp, frameDelta } from '@/lib/math';

/** Module-level scratch vectors -- the frame loop must never allocate. */
const desiredPosition = new Vector3();
const desiredTarget = new Vector3();
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

/** Pointer parallax amplitude, in world units at full deflection. */
const PARALLAX = 0.55;

export interface CameraRigProps {
  /** Use the portrait camera offsets and a wider lens. */
  mobile: boolean;
  /** Normalised pointer position for parallax; pass a zeroed ref to disable. */
  pointer: React.RefObject<{ x: number; y: number }>;
  /** Disable the parallax for reduced-motion users. */
  reducedMotion: boolean;
}

/**
 * Flies the camera along the world path defined in `lib/cameraPath`, then
 * applies a compositional offset so the subject never sits underneath the copy.
 *
 * The camera sits EXACTLY on the path at the smoothed scroll position. There is
 * no further damping of its position or aim: the scroll value is already
 * smoothed to a continuous velocity, and the path itself is continuous in
 * speed, so a second and third smoother here would only add lag -- which is
 * what they used to do. The one thing still damped is the pointer parallax,
 * so mouse jitter never reaches the lens.
 */
export default function CameraRig({
  mobile,
  pointer,
  reducedMotion,
}: CameraRigProps) {
  const parallax = useRef({ x: 0, y: 0 });

  // `camera` and `size` are read from the per-frame state rather than `useThree`
  // so that mutating them stays inside the render loop, where it belongs.
  useFrame((state, delta) => {
    const { camera, size } = state;
    const dt = frameDelta(delta);

    sampleCameraPath(
      getCameraPath(mobile),
      scrollStore.smooth,
      desiredPosition,
      desiredTarget,
    );

    // Subtle pointer parallax, disabled on touch and on the wider mobile lens.
    const amount = mobile || reducedMotion ? 0 : PARALLAX;
    parallax.current.x = damp(
      parallax.current.x,
      pointer.current.x * amount,
      0.001,
      dt,
    );
    parallax.current.y = damp(
      parallax.current.y,
      -pointer.current.y * amount * 0.6,
      0.001,
      dt,
    );

    camera.position.set(
      desiredPosition.x + parallax.current.x,
      desiredPosition.y + parallax.current.y,
      desiredPosition.z,
    );

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
    forward.copy(desiredTarget).sub(camera.position);
    const distance = forward.length();
    forward.divideScalar(distance || 1);

    right.crossVectors(forward, WORLD_UP).normalize();
    trueUp.crossVectors(right, forward).normalize();

    const halfHeight = distance * Math.tan((fov * Math.PI) / 360);
    const halfWidth = halfHeight * aspect;

    aimPoint.copy(desiredTarget);
    if (mobile) {
      aimPoint.addScaledVector(trueUp, -halfHeight * MOBILE_Y_FRAMING);
    } else {
      aimPoint.addScaledVector(right, -halfWidth * DESKTOP_X_FRAMING);
    }

    camera.lookAt(aimPoint);
  });

  return null;
}
