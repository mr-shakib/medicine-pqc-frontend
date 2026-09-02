'use client';

import { useCallback, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import Capsule, { type CapsuleHandle } from '@/components/three/objects/Capsule';
import Tablet from '@/components/three/objects/Tablet';
import SerumBottle, {
  type SerumBottleHandle,
} from '@/components/three/objects/SerumBottle';
import CryptoLattice from '@/components/three/objects/CryptoLattice';
import Motes from '@/components/three/objects/Motes';
import SceneAnchor from '@/components/three/SceneAnchor';
import { useSceneProgress } from '@/hooks/useSceneProgress';
import { useQuality } from '@/components/three/QualityProvider';
import { accent } from '@/lib/design/tokens';
import { lerp, smoothstep } from '@/lib/math';
import type { SceneComponentProps } from '@/types';

const T = {
  /** The three forms draw together into the centre. */
  gatherFrom: 0.26,
  gatherTo: 0.46,
  /** Cryptographic particles appear and begin taking their places. */
  latticeFrom: 0.42,
  latticeTo: 0.82,
  /** The boundary closes and the field settles. */
  fieldFrom: 0.72,
  fieldTo: 0.94,
} as const;

const ASSEMBLY_SCALE = 2;

/** Where each form waits before it is gathered, and where it settles. */
const GATHER = {
  capsule: { from: [-3.4, 0.9, 1.2], to: [-0.52, 0.16, 0.26] },
  vial: { from: [0.4, 3.6, -1.4], to: [0.04, -0.06, -0.3] },
  tablet: { from: [3.2, -2.2, 1] as const, to: [0.48, -0.4, 0.28] },
} as const;

/**
 * SCENE 07 — POST-QUANTUM CRYPTOGRAPHY.
 *
 * The three forms gather, and a lattice crystallises around them from the
 * inside out: nodes travel into their places as the growth front reaches them,
 * edges connect behind it, and a faceted boundary and field close over the
 * whole thing.
 *
 * The imagery is the mathematics, not a metaphor for it. ML-KEM and ML-DSA rest
 * on the hardness of finding short vectors in a lattice, so the structure here
 * IS a lattice — a cubic point grid with its own basis edges — rather than a
 * padlock, a shield or a wall of code. The nodes are octahedra because a
 * crystal habit reads as structure; the boundary is a polytope because a dome
 * reads as a force field.
 *
 * Four draws carry the entire architecture regardless of how many nodes it has.
 */
export default function Scene07PQCProtection({
  definition,
}: SceneComponentProps) {
  const capsuleSlot = useRef<Group>(null);
  const vialSlot = useRef<Group>(null);
  const tabletSlot = useRef<Group>(null);
  const capsule = useRef<CapsuleHandle>(null);
  const vial = useRef<SerumBottleHandle>(null);

  const progress = useSceneProgress(definition.index);
  const budget = useQuality();

  const getGrow = useCallback(
    () => smoothstep(T.latticeFrom, T.latticeTo, progress.local()),
    [progress],
  );

  const getField = useCallback(
    () => smoothstep(T.fieldFrom, T.fieldTo, progress.local()),
    [progress],
  );

  const motesReveal = useCallback(() => {
    const t = progress.local();
    // Present while the structure is assembling, gone once it has stabilised —
    // loose particles inside a finished system would undo the sense of order.
    return (
      smoothstep(T.latticeFrom - 0.08, T.latticeFrom + 0.08, t) *
      (1 - smoothstep(T.fieldFrom, T.fieldTo, t) * 0.8)
    );
  }, [progress]);

  useFrame((state) => {
    const t = progress.local();
    const time = state.clock.elapsedTime;
    const gather = smoothstep(T.gatherFrom, T.gatherTo, t);

    const place = (
      node: Group | null,
      spec: { from: readonly number[]; to: readonly number[] },
      phase: number,
    ) => {
      if (!node) return;
      node.position.set(
        lerp(spec.from[0], spec.to[0], gather),
        lerp(spec.from[1], spec.to[1], gather) +
          Math.sin(time * 0.26 + phase) * 0.04 * gather,
        lerp(spec.from[2], spec.to[2], gather),
      );
      node.rotation.y = (1 - gather) * 1.4 + time * 0.05;
      node.scale.setScalar(Math.max(gather, 0.0001));
      node.visible = gather > 0.004;
    };

    place(capsuleSlot.current, GATHER.capsule, 0);
    place(vialSlot.current, GATHER.vial, 2.1);
    place(tabletSlot.current, GATHER.tablet, 4.2);

    capsule.current?.setSeparation(0);
    vial.current?.setFill(0.78);

  });

  return (
    <SceneAnchor definition={definition} scale={ASSEMBLY_SCALE} driftAmount={0.04} driftSpeed={0.2}>
        <group ref={capsuleSlot}>
          <Capsule ref={capsule} scale={0.55} rotation={[0.14, 0.5, 0.34]} />
        </group>
        <group ref={vialSlot}>
          <SerumBottle ref={vial} rotation={[0, -0.55, 0]} />
        </group>
        <group ref={tabletSlot}>
          <Tablet scale={0.35} rotation={[0.95, 0.34, 0.16]} />
        </group>

        <CryptoLattice
          spacing={0.52}
          innerRadius={1.25}
          outerRadius={2.15}
          getGrow={getGrow}
          getField={getField}
          boundaryRadius={2.55}
          detail={budget.detail}
        />

        {/* Loose cryptographic particles, before the structure orders them. */}
        <Motes
          count={Math.round(budget.particles * (budget.tier === 'high' ? 0.1 : 0.05))}
          innerRadius={1.4}
          outerRadius={3.4}
          color={accent.lattice.light}
          size={budget.tier === 'high' ? 0.26 : 0.22}
          spin={0.03}
          seed={31}
          getReveal={motesReveal}
        />

        <pointLight
          position={[1.6, 1.4, 3]}
          color={accent.lattice.light}
          intensity={8}
          distance={12}
          decay={2}
        />
    </SceneAnchor>
  );
}
