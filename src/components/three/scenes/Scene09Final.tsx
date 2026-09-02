'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import {
  MeshStandardMaterial,
  Object3D,
  TorusGeometry,
  type InstancedMesh,
} from 'three';
import Capsule, { type CapsuleHandle } from '@/components/three/objects/Capsule';
import Tablet from '@/components/three/objects/Tablet';
import SerumBottle, {
  type SerumBottleHandle,
} from '@/components/three/objects/SerumBottle';
import CryptoLattice from '@/components/three/objects/CryptoLattice';
import Motes from '@/components/three/objects/Motes';
import { LightPool } from '@/components/three/effects';
import SceneAnchor from '@/components/three/SceneAnchor';
import { useSceneProgress } from '@/hooks/useSceneProgress';
import { useQuality } from '@/components/three/QualityProvider';
import { accent } from '@/lib/design/tokens';
import { emissive } from '@/lib/design/materials';
import { smoothstep } from '@/lib/math';
import type { SceneComponentProps } from '@/types';

const dummy = new Object3D();

const T = {
  /** Everything eases into its resting state. */
  settleFrom: 0.24,
  settleTo: 0.52,
  /** The verification marks resolve last, and then stay still. */
  verifyFrom: 0.5,
  verifyTo: 0.72,
} as const;

const ASSEMBLY_SCALE = 1.7;

/**
 * The resting composition.
 *
 * Wider and flatter than the gathering pose in chapter 07 — the products are no
 * longer being collected, they are simply held — with the vial centred and back
 * because it is the tallest, and the other two set forward at either side.
 */
const PLACES = [
  { position: [-0.72, 0.14, 0.34] as const, ring: 0.46, bob: 0.19 },
  { position: [0.02, -0.04, -0.28] as const, ring: 0.6, bob: 0.15 },
  { position: [0.7, -0.34, 0.3] as const, ring: 0.34, bob: 0.23 },
];

/**
 * SCENE 09 — THE FINAL PROTECTION.
 *
 * The resolution. All three forms held inside a completed lattice, each
 * carrying a still verification mark, the field stable, the whole assembly
 * turning at a rate barely above nothing.
 *
 * Deliberately the calmest chapter in the piece. Every earlier chapter earned
 * its motion — something was forming, dissolving, being scanned or being
 * refused — and the ending is the one moment where nothing is happening,
 * because nothing needs to. A climax built from more movement than the
 * transformations that preceded it would read as unresolved.
 *
 * The verification rings are still. In chapter 06 a counterfeit ring pulsed and
 * an authentic one held steady; that grammar is kept, so stillness here means
 * exactly what it meant there.
 */
export default function Scene09Final({ definition }: SceneComponentProps) {
  const slots = useRef<(Group | null)[]>([]);
  const rings = useRef<InstancedMesh>(null);
  const capsule = useRef<CapsuleHandle>(null);
  const vial = useRef<SerumBottleHandle>(null);

  const progress = useSceneProgress(definition.index);
  const budget = useQuality();

  const getGrow = useCallback(() => 1, []);
  const getField = useCallback(
    () => 0.55 + smoothstep(T.settleFrom, T.settleTo, progress.local()) * 0.45,
    [progress],
  );
  const motesReveal = useCallback(
    () => smoothstep(T.settleFrom, T.settleTo, progress.local()) * 0.7,
    [progress],
  );

  const ringGeometry = useMemo(() => new TorusGeometry(1, 0.008, 5, 72), []);
  const ringMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        ...emissive(accent.verified.base, 1.3),
        transparent: true,
        opacity: 0,
      }),
    [],
  );

  useEffect(
    () => () => {
      ringGeometry.dispose();
      ringMaterial.dispose();
    },
    [ringGeometry, ringMaterial],
  );

  useFrame((state) => {
    const t = progress.local();
    const time = state.clock.elapsedTime;
    const settle = smoothstep(T.settleFrom, T.settleTo, t);
    const verified = smoothstep(T.verifyFrom, T.verifyTo, t);

    PLACES.forEach((place, i) => {
      const node = slots.current[i];
      if (!node) return;

      // A single slow rise into place, then a drift so shallow it reads as
      // suspension rather than as movement.
      node.position.set(
        place.position[0],
        place.position[1] +
          (1 - settle) * -0.9 +
          Math.sin(time * place.bob + i * 2.1) * 0.03 * settle,
        place.position[2],
      );
      node.scale.setScalar(Math.max(settle, 0.0001));
      node.visible = settle > 0.004;
    });

    if (rings.current) {
      PLACES.forEach((place, i) => {
        dummy.position.set(
          place.position[0],
          place.position[1] + Math.sin(time * place.bob + i * 2.1) * 0.03,
          place.position[2],
        );
        // Held flat and still. No spin: a mark that keeps moving reads as a
        // process still running.
        dummy.rotation.set(Math.PI / 2, 0, 0);
        dummy.scale.setScalar(Math.max(place.ring * verified, 0.0001));
        dummy.updateMatrix();
        rings.current!.setMatrixAt(i, dummy.matrix);
      });
      rings.current.instanceMatrix.needsUpdate = true;
      (rings.current.material as MeshStandardMaterial).opacity = verified * 0.85;
      rings.current.visible = verified > 0.01;
    }

    capsule.current?.setSeparation(0);
    vial.current?.setFill(0.78);

  });

  return (
    <SceneAnchor definition={definition} scale={ASSEMBLY_SCALE} driftAmount={0.03} driftSpeed={0.16}>
        <group
          ref={(node) => {
            slots.current[0] = node;
          }}
        >
          <Capsule ref={capsule} scale={0.55} rotation={[0.12, 0.5, 0.32]} />
        </group>
        <group
          ref={(node) => {
            slots.current[1] = node;
          }}
        >
          <SerumBottle ref={vial} rotation={[0, -0.5, 0]} />
        </group>
        <group
          ref={(node) => {
            slots.current[2] = node;
          }}
        >
          <Tablet scale={0.35} rotation={[0.92, 0.3, 0.14]} />
        </group>

        {/* Verification marks — one instanced draw, and completely still. */}
        <instancedMesh
          ref={rings}
          args={[ringGeometry, ringMaterial, PLACES.length]}
          frustumCulled={false}
        />

        <CryptoLattice
          spacing={0.52}
          innerRadius={1.25}
          outerRadius={2.15}
          getGrow={getGrow}
          getField={getField}
          boundaryRadius={2.55}
          detail={budget.detail}
        />

        <LightPool
          position={[0, -1.5, 0]}
          size={4.4}
          color={accent.verified.light}
          intensity={0.2}
          falloff={3}
        />

        <Motes
          count={Math.round(budget.particles * (budget.tier === 'high' ? 0.09 : 0.045))}
          innerRadius={1.5}
          outerRadius={3.6}
          color={accent.verified.light}
          size={budget.tier === 'high' ? 0.24 : 0.2}
          spin={0.016}
          seed={47}
          getReveal={motesReveal}
        />

        <pointLight
          position={[-1.5, 1.4, 3]}
          color={accent.verified.light}
          intensity={7}
          distance={11}
          decay={2}
        />
    </SceneAnchor>
  );
}
