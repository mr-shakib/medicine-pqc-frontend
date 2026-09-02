'use client';

import { useCallback, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import Capsule, { type CapsuleHandle } from '@/components/three/objects/Capsule';
import Tablet, { type TabletHandle } from '@/components/three/objects/Tablet';
import SerumBottle, {
  type SerumBottleHandle,
} from '@/components/three/objects/SerumBottle';
import AnalysisField, {
  type AnalysisItem,
} from '@/components/three/objects/AnalysisField';
import SceneAnchor from '@/components/three/SceneAnchor';
import { useSceneProgress } from '@/hooks/useSceneProgress';
import { accent } from '@/lib/design/tokens';
import { lerp, range, smoothstep } from '@/lib/math';
import type { SceneComponentProps } from '@/types';

const T = {
  /** The population resolves around the three known-good products. */
  populationFrom: 0.3,
  populationTo: 0.5,
  /** The sweep starts below the field and rises through it. */
  scanFrom: 0.5,
  scanTo: 0.86,
} as const;

const ASSEMBLY_SCALE = 1.9;
/** Half-height of the scanned volume. */
const EXTENT = 2.3;

/**
 * The population under inspection.
 *
 * A formal three-by-three arrangement, because a grid is what makes comparison
 * legible: every product occupies an equivalent position, so the only thing
 * distinguishing one from another is the verdict. The three hero forms hold the
 * middle row; the rest are proxies.
 *
 * Two of the nine are counterfeit, placed apart from each other so the result
 * reads as detection rather than as a marked-out block.
 */
const ROW_Y = [-1.15, 0, 1.15];
const COL_X = [-1.25, 0, 1.25];

const ITEMS: AnalysisItem[] = [
  // Bottom row.
  { position: [COL_X[0], ROW_Y[0], -0.15], authentic: false, proxy: true, scale: 1 },
  { position: [COL_X[1], ROW_Y[0], 0.1], authentic: true, proxy: true, scale: 1 },
  { position: [COL_X[2], ROW_Y[0], -0.1], authentic: true, proxy: true, scale: 1 },
  // Middle row — the hero objects.
  { position: [COL_X[0], ROW_Y[1], 0.2], authentic: true, scale: 1 },
  { position: [COL_X[1], ROW_Y[1], 0], authentic: true, scale: 1.15 },
  { position: [COL_X[2], ROW_Y[1], 0.15], authentic: true, scale: 0.8 },
  // Top row.
  { position: [COL_X[0], ROW_Y[2], -0.1], authentic: true, proxy: true, scale: 1 },
  { position: [COL_X[1], ROW_Y[2], 0.05], authentic: true, proxy: true, scale: 1 },
  { position: [COL_X[2], ROW_Y[2], -0.2], authentic: false, proxy: true, scale: 1 },
];

/**
 * SCENE 06 — AI DETECTION.
 *
 * The three forms the piece has established sit among a population of visually
 * identical products. A sweep rises through the field, and as it passes each
 * one a verdict resolves: a ring, a tint, and a signature trace.
 *
 * The trace is what carries the meaning. Authentic products produce a steady,
 * continuous signal; counterfeits produce the same measurement, failing —
 * unstable amplitude, a wandering baseline, dropouts. No numbers, no readouts,
 * no interface. The difference is legible before it is read.
 *
 * Nothing is marked before it is scanned. Colouring the counterfeits up front
 * would answer the question the scan exists to ask.
 */
export default function Scene06AIDetection({
  definition,
}: SceneComponentProps) {
  const capsule = useRef<CapsuleHandle>(null);
  const tablet = useRef<TabletHandle>(null);
  const vial = useRef<SerumBottleHandle>(null);
  const progress = useSceneProgress(definition.index);

  const heroes = useMemo(
    () => ITEMS.filter((item) => !item.proxy),
    [],
  );

  const getScanY = useCallback(() => {
    const t = progress.local();
    // Starts below the field and travels past the top, so the last row is
    // genuinely swept rather than judged as the sweep expires.
    return lerp(-EXTENT, EXTENT * 1.1, range(t, T.scanFrom, T.scanTo));
  }, [progress]);

  const getReveal = useCallback(
    () => smoothstep(T.scanFrom - 0.06, T.scanFrom + 0.04, progress.local()),
    [progress],
  );

  const getPopulation = useCallback(
    () => smoothstep(T.populationFrom, T.populationTo, progress.local()),
    [progress],
  );

  useFrame(() => {

    // Nothing here transforms; clear any residue from the chapters that do.
    capsule.current?.setSeparation(0);
    vial.current?.setFill(0.78);

  });

  return (
    <SceneAnchor definition={definition} scale={ASSEMBLY_SCALE} driftAmount={0.035} driftSpeed={0.22} swayAmount={0.04}>
        {/* The three known-good products, in the middle row. */}
        <group position={heroes[0].position} scale={heroes[0].scale}>
          <Capsule ref={capsule} scale={0.62} rotation={[0.2, 0.5, 0.3]} />
        </group>
        <group position={heroes[1].position} scale={heroes[1].scale}>
          <SerumBottle ref={vial} rotation={[0, -0.5, 0]} />
        </group>
        <group position={heroes[2].position} scale={heroes[2].scale}>
          <Tablet ref={tablet} scale={0.42} rotation={[0.9, 0.3, 0.15]} />
        </group>

        <AnalysisField
          items={ITEMS}
          getScanY={getScanY}
          getReveal={getReveal}
          getPopulation={getPopulation}
          extent={EXTENT}
        />

        {/* One cool source, so the analysis reads as a different kind of light
            from the warm product rig that precedes it. */}
        <pointLight
          position={[-1.4, 0.6, 3.2]}
          color={accent.analysis.light}
          intensity={9}
          distance={12}
          decay={2}
        />
    </SceneAnchor>
  );
}
