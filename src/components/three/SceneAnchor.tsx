'use client';

import { useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import type { SceneDefinition } from '@/lib/scenes';

export interface SceneAnchorProps {
  definition: SceneDefinition;
  /** Scale applied to the whole assembly. */
  scale?: number;
  /** Amplitude of the ambient float, in local units. */
  driftAmount?: number;
  /** Speed of the ambient float. */
  driftSpeed?: number;
  /** Amplitude of the ambient yaw. 0 disables it. */
  swayAmount?: number;
  children: ReactNode;
}

/**
 * Places a chapter in the world and gives it its ambient float.
 *
 * Two nested nodes, and the separation is the entire point. The OUTER node
 * carries the chapter's world anchor and scale and is never written to again.
 * The INNER node carries the drift.
 *
 * Every chapter needs exactly this, and writing it out per chapter invites one
 * specific bug: animating `position.y` on the anchored node overwrites the
 * anchor's own y, silently dropping the whole chapter out of the camera's aim.
 * That happened in chapter 03, where the anchor sits at y = 1 and a ±0.05 drift
 * put the assembly a full world unit below where the camera was looking — a
 * mistake invisible in any chapter whose anchor happens to sit at y = 0.
 *
 * Centralising it means no chapter can make it again.
 */
export default function SceneAnchor({
  definition,
  scale = 1,
  driftAmount = 0.04,
  driftSpeed = 0.24,
  swayAmount = 0,
  children,
}: SceneAnchorProps) {
  const drift = useRef<Group>(null);

  useFrame((state) => {
    if (!drift.current) return;
    const time = state.clock.elapsedTime;
    drift.current.position.y = Math.sin(time * driftSpeed) * driftAmount;
    if (swayAmount) {
      drift.current.rotation.y = Math.sin(time * driftSpeed * 0.4) * swayAmount;
    }
  });

  return (
    <group
      position={definition.anchor as unknown as [number, number, number]}
      scale={scale}
    >
      <group ref={drift}>{children}</group>
    </group>
  );
}
