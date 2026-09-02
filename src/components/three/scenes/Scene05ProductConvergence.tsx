'use client';

import { useCallback, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import Capsule, { type CapsuleHandle } from '@/components/three/objects/Capsule';
import Tablet, { type TabletHandle } from '@/components/three/objects/Tablet';
import SerumBottle, {
  type SerumBottleHandle,
} from '@/components/three/objects/SerumBottle';
import Motes from '@/components/three/objects/Motes';
import { LightPool } from '@/components/three/effects';
import { useSceneProgress } from '@/hooks/useSceneProgress';
import { useQuality } from '@/components/three/QualityProvider';
import { accent } from '@/lib/design/tokens';
import { lerp, range, smoothstep } from '@/lib/math';
import type { SceneComponentProps } from '@/types';

/**
 * Resting composition.
 *
 * An asymmetric triangle rather than a row: the vial upright and furthest back
 * because it is the tallest, the capsule left and forward, the tablet low and
 * right, tipped so its face catches the key rather than presenting as an edge.
 * Three objects in a line read as a product listing; offset in all three axes
 * they read as a launch photograph.
 *
 * `from` is the direction each object travels in from, chosen so no two arrive
 * along the same axis.
 */
const COMPOSITION = {
  capsule: {
    position: [-0.5, 0.16, 0.18] as [number, number, number],
    rotation: [0.14, 0.5, 0.36] as [number, number, number],
    from: [-3, -0.8, 0.5] as [number, number, number],
    enter: [0.28, 0.5] as [number, number],
    // ~55% of the vial's height, matching a real capsule against a real vial.
    scale: 0.55,
    bob: 0.29,
  },
  tablet: {
    position: [0.46, -0.38, 0.24] as [number, number, number],
    rotation: [0.95, 0.34, 0.16] as [number, number, number],
    from: [1.8, -3, 0.7] as [number, number, number],
    enter: [0.36, 0.58] as [number, number],
    scale: 0.35,
    bob: 0.37,
  },
  vial: {
    position: [0, -0.04, -0.3] as [number, number, number],
    rotation: [0, -0.55, 0] as [number, number, number],
    from: [0.3, 3.2, -0.9] as [number, number, number],
    enter: [0.44, 0.68] as [number, number],
    // The reference. Every other scale here is set relative to the vial,
    // because it is the tallest object and the one the eye measures against.
    scale: 1,
    bob: 0.23,
  },
} as const;

const ASSEMBLY_SCALE = 3.4;

/**
 * SCENE 05 — PRODUCT CONVERGENCE.
 *
 * The three forms the piece has built one at a time arrive together. Each
 * enters from its own direction, decelerates, and settles into a balanced
 * composition that holds while the camera pulls back to reveal it.
 *
 * No security content: this chapter's only job is to establish that these are
 * three forms of one thing, before anything is claimed about protecting them.
 *
 * Everything is scroll-driven except the floating motion and rotation, which
 * are continuous by design — a composition that freezes completely once the
 * scroll stops reads as a rendered still rather than as a live scene.
 */
export default function Scene05ProductConvergence({
  definition,
}: SceneComponentProps) {
  const group = useRef<Group>(null);
  /** Animation node — never the anchored one. */
  const drift = useRef<Group>(null);

  const capsuleSlot = useRef<Group>(null);
  const tabletSlot = useRef<Group>(null);
  const vialSlot = useRef<Group>(null);

  const capsule = useRef<CapsuleHandle>(null);
  const tablet = useRef<TabletHandle>(null);
  const vial = useRef<SerumBottleHandle>(null);

  const progress = useSceneProgress(definition.index);
  const budget = useQuality();

  const motesReveal = useCallback(
    () => smoothstep(0.2, 0.55, progress.local()),
    [progress],
  );

  useFrame((state) => {
    const t = progress.local();
    const time = state.clock.elapsedTime;

    const place = (
      node: Group | null,
      spec: (typeof COMPOSITION)[keyof typeof COMPOSITION],
    ) => {
      if (!node) return;

      // Decelerating arrival. No overshoot: the design system's motion rule is
      // that premium movement settles rather than bounces.
      const raw = range(t, spec.enter[0], spec.enter[1]);
      const eased = 1 - Math.pow(1 - raw, 3);

      const bobbing = Math.sin(time * spec.bob + spec.position[0] * 3) * 0.045;

      node.position.set(
        lerp(spec.position[0] + spec.from[0], spec.position[0], eased),
        lerp(spec.position[1] + spec.from[1], spec.position[1], eased) + bobbing * eased,
        lerp(spec.position[2] + spec.from[2], spec.position[2], eased),
      );

      // Each arrives tumbling and settles onto its composed attitude.
      const tumble = (1 - eased) * 1.1;
      node.rotation.set(
        spec.rotation[0] + tumble * 0.8,
        spec.rotation[1] + tumble * 1.6 + Math.sin(time * 0.12) * 0.05,
        spec.rotation[2] - tumble * 0.6,
      );

      node.scale.setScalar(Math.max(eased * spec.scale, 0.0001));
      node.visible = eased > 0.004;
    };

    place(capsuleSlot.current, COMPOSITION.capsule);
    place(tabletSlot.current, COMPOSITION.tablet);
    place(vialSlot.current, COMPOSITION.vial);

    // Nothing is mid-transformation here; make sure no residue carries in from
    // a chapter that was.
    capsule.current?.setDissolve(0);
    capsule.current?.setSeparation(0);
    tablet.current?.setDissolve(0);
    vial.current?.setDissolve(0);
    vial.current?.setFill(0.78);

    if (drift.current) {
      drift.current.position.y = Math.sin(time * 0.24) * 0.04;
      drift.current.rotation.y = Math.sin(time * 0.09) * 0.05;
    }
  });

  return (
    <group
      ref={group}
      position={definition.anchor as unknown as [number, number, number]}
      scale={ASSEMBLY_SCALE}
    >
      <group ref={drift}>
        <group ref={capsuleSlot}>
          <Capsule ref={capsule} />
        </group>

        <group ref={tabletSlot}>
          <Tablet ref={tablet} />
        </group>

        <group ref={vialSlot}>
          <SerumBottle ref={vial} />
        </group>

        {/* The plinth glow. Sits just under the composition so the group reads
            as standing on something rather than floating in a void. */}
        <LightPool
          position={[0, -0.72, 0]}
          size={2.8}
          color={accent.pharma.light}
          intensity={0.3}
          falloff={3}
        />

        {/*
          One close accent light picking out the trio. The global rig lights the
          corridor; a product group needs its own source or the three objects
          shade identically and flatten into one silhouette.

          One, not two. Every additional light is evaluated by every material in
          the scene, so on a chapter carrying nine PBR surfaces a second lamp is
          one of the most expensive things that can be added — and the second
          was doing very little the rim light was not already doing.
        */}
        <pointLight
          position={[-1.9, 1.7, 2.6]}
          color={accent.pharma.glow}
          intensity={9}
          distance={10}
          decay={2}
        />

        <Motes
          count={Math.round(budget.particles * (budget.tier === 'high' ? 0.16 : 0.08))}
          innerRadius={1.6}
          outerRadius={5}
          size={budget.tier === 'high' ? 0.3 : 0.24}
          spin={0.02}
          seed={23}
          getReveal={motesReveal}
        />
      </group>
    </group>
  );
}
