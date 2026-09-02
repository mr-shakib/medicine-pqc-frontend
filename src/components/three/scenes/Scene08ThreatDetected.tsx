'use client';

import { useCallback, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import type { Mesh, MeshBasicMaterial, PointLight } from 'three';
import Capsule, { type CapsuleHandle } from '@/components/three/objects/Capsule';
import Tablet from '@/components/three/objects/Tablet';
import SerumBottle, {
  type SerumBottleHandle,
} from '@/components/three/objects/SerumBottle';
import CryptoLattice from '@/components/three/objects/CryptoLattice';
import AnalysisField, {
  type AnalysisItem,
} from '@/components/three/objects/AnalysisField';
import SceneAnchor from '@/components/three/SceneAnchor';
import { useSceneProgress } from '@/hooks/useSceneProgress';
import { useQuality } from '@/components/three/QualityProvider';
import { accent } from '@/lib/design/tokens';
import { hologram } from '@/lib/design/materials';
import { lerp, range, smoothstep } from '@/lib/math';
import type { SceneComponentProps } from '@/types';

const T = {
  /** The duplicate drifts in from outside the protected volume. */
  approachFrom: 0.28,
  approachTo: 0.5,
  /** The scan passes over the comparison. */
  scanFrom: 0.5,
  scanTo: 0.68,
  /** The mismatch resolves and the boundary refuses it. */
  rejectFrom: 0.68,
  rejectTo: 0.8,
  /** It is moved aside and held. */
  isolateFrom: 0.78,
  isolateTo: 0.94,
} as const;

/*
  Smaller than chapter 07's identical structure, on purpose.

  There the boundary was the subject and could fill the frame. Here the subject
  is a relationship — something outside it, staying outside — and that needs
  visible space around the boundary for the duplicate to occupy.
*/
const ASSEMBLY_SCALE = 1.35;

/**
 * The comparison readout.
 *
 * Two specimens, side by side, in the visual language chapter 06 already
 * established: the reference on the left with a steady trace, the submitted
 * duplicate on the right with the same measurement failing. Reusing that
 * language rather than inventing a second one is the point — the viewer has
 * already been taught to read it, so the mismatch needs no explanation.
 */
const COMPARISON: AnalysisItem[] = [
  { position: [-0.8, -2.05, 0.5], authentic: true, scale: 0.9 },
  { position: [0.8, -2.05, 0.5], authentic: false, scale: 0.9 },
];

/**
 * SCENE 08 — COUNTERFEIT DETECTED.
 *
 * A duplicate approaches the protected ecosystem. It is deliberately identical
 * to the authentic capsule inside — a counterfeit that looked wrong would make
 * the whole system unnecessary. The scan compares its identity against the
 * reference, the signature fails, and the boundary refuses it.
 *
 * The refusal is a refusal, not a battle: the duplicate is stopped, turned
 * aside and held. Nothing shatters, nothing alarms, and the protected products
 * never move. A system that has to fight is a system that nearly lost.
 */
export default function Scene08ThreatDetected({
  definition,
}: SceneComponentProps) {
  const intruder = useRef<Group>(null);
  const containment = useRef<Mesh>(null);
  const flare = useRef<PointLight>(null);
  const capsule = useRef<CapsuleHandle>(null);
  const vial = useRef<SerumBottleHandle>(null);

  const progress = useSceneProgress(definition.index);
  const budget = useQuality();

  /** The protective structure is already built when this chapter opens. */
  const getGrow = useCallback(() => 1, []);
  const getField = useCallback(
    () => 0.7 + smoothstep(T.rejectFrom, T.rejectTo, progress.local()) * 0.3,
    [progress],
  );

  const getScanY = useCallback(() => {
    const t = progress.local();
    // Sweeps across the comparison panel only, not the whole volume.
    return lerp(-2.9, -1.3, range(t, T.scanFrom, T.scanTo));
  }, [progress]);

  const getAnalysisReveal = useCallback(
    () => smoothstep(T.scanFrom - 0.05, T.scanFrom + 0.03, progress.local()),
    [progress],
  );

  const noPopulation = useCallback(() => 0, []);

  const comparison = useMemo(() => COMPARISON, []);

  useFrame((state) => {
    const t = progress.local();
    const time = state.clock.elapsedTime;

    const approach = smoothstep(T.approachFrom, T.approachTo, t);
    const reject = smoothstep(T.rejectFrom, T.rejectTo, t);
    const isolate = smoothstep(T.isolateFrom, T.isolateTo, t);

    if (intruder.current) {
      /*
        In, stopped, then aside.

        It never crosses the boundary. The boundary sits at radius 2.55, and the
        duplicate's closest approach is 2.95 — outside it, by a margin the eye
        can see. A counterfeit that gets inside and is then removed tells a
        different and much worse story than one that is never admitted.
      */
      const inbound = approach * (1 - reject * 0.28);
      /*
        Held UP and out, not down.

        The compositional framing already pushes the subject to the right of
        frame, so anything outside the boundary on that side is close to the
        edge; and below is where the comparison readout sits. The empty upper
        right is the only place the isolated duplicate can be held where it is
        both clearly outside and clearly visible.
      */
      const x = lerp(4.3, 2.85, inbound) + isolate * 0.05;
      const y = lerp(1.1, 0.2, inbound) + isolate * 1.35;
      const z = lerp(1.6, 0.5, inbound) + isolate * 0.4;

      intruder.current.position.set(x, y, z);
      intruder.current.rotation.set(
        0.2 + isolate * 0.3,
        time * (0.25 + reject * 0.5),
        0.3 - isolate * 0.5,
      );
      intruder.current.scale.setScalar(Math.max(approach, 0.0001));
      intruder.current.visible = approach > 0.004;
    }

    if (containment.current) {
      // A holding ring, not a cage. It appears only once the verdict is in.
      containment.current.visible = isolate > 0.01;
      containment.current.scale.setScalar(0.55 + (1 - isolate) * 0.5);
      containment.current.rotation.z = time * 0.5;
      containment.current.rotation.x = Math.PI / 2;
      const material = containment.current.material as MeshBasicMaterial;
      material.opacity = isolate * 0.5;
      if (intruder.current) {
        containment.current.position.copy(intruder.current.position);
      }
    }

    if (flare.current) {
      // A single pulse at the moment of refusal, decaying immediately.
      const x = (t - T.rejectFrom) / 0.05;
      flare.current.intensity = Math.exp(-x * x) * 22;
      flare.current.visible = flare.current.intensity > 0.05;
    }

    capsule.current?.setSeparation(0);
    vial.current?.setFill(0.78);

  });

  return (
    <SceneAnchor definition={definition} scale={ASSEMBLY_SCALE} driftAmount={0.035} driftSpeed={0.2}>
        {/* The protected ecosystem, carried over intact from chapter 07. */}
        <group position={[-0.52, 0.16, 0.26]}>
          <Capsule ref={capsule} scale={0.55} rotation={[0.14, 0.5, 0.34]} />
        </group>
        <group position={[0.04, -0.06, -0.3]}>
          <SerumBottle ref={vial} rotation={[0, -0.55, 0]} />
        </group>
        <group position={[0.48, -0.4, 0.28]}>
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

        {/* The duplicate. Identical to the capsule it is imitating — a
            counterfeit that looked wrong would need no system to catch it. */}
        <group ref={intruder}>
          <Capsule scale={0.55} />
        </group>

        <mesh ref={containment} visible={false}>
          <torusGeometry args={[1, 0.012, 6, 64]} />
          <meshBasicMaterial {...hologram(accent.alert.base, 0)} />
        </mesh>

        <AnalysisField
          items={comparison}
          getScanY={getScanY}
          getReveal={getAnalysisReveal}
          getPopulation={noPopulation}
          extent={1.6}
        />

        <pointLight
          ref={flare}
          position={[2.6, 0.3, 0.9]}
          color={accent.alert.light}
          intensity={0}
          distance={10}
          decay={2}
          visible={false}
        />
    </SceneAnchor>
  );
}
