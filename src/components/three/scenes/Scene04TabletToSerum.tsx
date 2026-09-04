'use client';

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import Tablet, { type TabletHandle } from '@/components/three/objects/Tablet';
import SerumBottle, {
  type SerumBottleHandle,
} from '@/components/three/objects/SerumBottle';
import TransformParticles from '@/components/three/objects/TransformParticles';
import SceneAnchor from '@/components/three/SceneAnchor';
import { useSceneProgress } from '@/hooks/useSceneProgress';
import { useQuality } from '@/components/three/QualityProvider';
import {
  alignByBearing,
  buildColumnWaypoint,
  type SurfaceSample,
} from '@/lib/geometry/surfaceSampler';
import { range, smoothstep } from '@/lib/math';
import type { SceneComponentProps } from '@/types';

/**
 * The transformation timeline, in scene-local progress.
 *
 * Deliberately the same shape as chapter 03's, and pushed equally late for the
 * same reason: the chapter's own copy is not pinned until local 0.5, so the
 * opening rotation covers the overlap with the previous chapter and every beat
 * that needs explaining happens under this chapter's line.
 */
const T = {
  settleTo: 0.36,
  cinematicTo: 0.5,
  dissolveFrom: 0.52,
  dissolveTo: 0.63,
  /** Ciphertext is briefer here than in chapter 03 — it is a reprise. */
  cipherFrom: 0.6,
  cipherTo: 0.78,
  reformFrom: 0.66,
  reformTo: 0.88,
  /** Glass condenses first, then the vial fills. */
  glassFrom: 0.84,
  glassTo: 0.95,
  fillFrom: 0.88,
  fillTo: 1,
} as const;

const ASSEMBLY_SCALE = 2;
const FULL_FILL = 0.78;

/**
 * SCENE 04 — TABLET TO SERUM.
 *
 * The counterpart to chapter 03, and deliberately not a repeat of it. A tablet
 * is flat and wide; a vial is tall and narrow, so the natural motion between
 * them is vertical rather than a spiral.
 *
 * The cloud is therefore routed through a quantised cylindrical lattice at
 * mid-flight — see `buildColumnWaypoint` — which does three of the brief's
 * beats at once: the particles reorganise vertically, they become visibly
 * structured rather than organic, and a regular grid is the natural place for
 * the ciphertext fragments to read as a data matrix instead of as noise.
 *
 * Swirl is turned right down for the same reason. Chapter 03 spirals; repeating
 * that here would make the two transformations interchangeable.
 *
 * The vial then arrives in two stages — glass first, then liquid rising into it
 * — so "the bottle forms" and "glass and liquid become visible" are separate
 * moments rather than one fade.
 */
export default function Scene04TabletToSerum({
  definition,
}: SceneComponentProps) {
  /** Animation lives here, never on the anchored node — see chapter 03. */
  const tablet = useRef<TabletHandle>(null);
  const vial = useRef<SerumBottleHandle>(null);
  const progress = useSceneProgress(definition.index);
  const budget = useQuality();

  const particleCount = useMemo(
    () => Math.round(budget.particles * (budget.tier === 'high' ? 0.85 : 0.5)),
    [budget.particles, budget.tier],
  );

  const particleSize =
    budget.tier === 'high' ? 0.4 : budget.tier === 'medium' ? 0.3 : 0.26;

  const [clouds, setClouds] = useState<{
    source: SurfaceSample;
    target: SurfaceSample;
    waypoint: Float32Array;
  } | null>(null);

  useLayoutEffect(() => {
    const tabletHandle = tablet.current;
    const vialHandle = vial.current;
    if (!tabletHandle || !vialHandle) return;

    const rawSource = tabletHandle.sampleSurface(particleCount, 5);
    const rawTarget = vialHandle.sampleSurface(particleCount, 17);

    // Sampling returns cached arrays; copy before reordering so the caches are
    // not mutated underneath their owners.
    const source = {
      positions: rawSource.positions.slice(),
      normals: rawSource.normals.slice(),
    };
    const target = {
      positions: rawTarget.positions.slice(),
      normals: rawTarget.normals.slice(),
    };

    alignByBearing(source, target);

    const metrics = vialHandle.metrics;
    const waypoint = buildColumnWaypoint(source.positions, target.positions, {
      radius: 0.3,
      height: metrics.lipTop * 1.05,
      rings: 16,
      sectors: 22,
    });

    setClouds({ source, target, waypoint });
  }, [particleCount]);

  /* ---------------------------------------------------------------------- */
  /* Timeline getters — read per frame, never re-rendered                    */
  /* ---------------------------------------------------------------------- */

  const getMorph = useCallback(
    () => smoothstep(T.dissolveFrom, T.reformTo, progress.local()),
    [progress],
  );

  const getParticleOpacity = useCallback(() => {
    const t = progress.local();
    return (
      smoothstep(T.dissolveFrom - 0.04, T.dissolveTo, t) *
      (1 - smoothstep(T.glassFrom, T.glassTo + 0.02, t))
    );
  }, [progress]);

  const getCipher = useCallback(() => {
    const t = progress.local();
    return (
      smoothstep(T.cipherFrom, T.cipherFrom + 0.06, t) *
      (1 - smoothstep(T.cipherTo - 0.08, T.cipherTo, t))
    );
  }, [progress]);

  /* ---------------------------------------------------------------------- */
  /* Frame                                                                  */
  /* ---------------------------------------------------------------------- */

  const spin = useRef(0);

  useFrame((_state, delta) => {
    const dt = Math.min(delta, 1 / 20);
    const t = progress.local();

    const tabletHandle = tablet.current;
    const vialHandle = vial.current;

    // Scroll drives the rate; the angle accumulates, so the object never snaps
    // when the rate changes.
    const rate = 0.18 + smoothstep(T.settleTo, T.cinematicTo, t) * 0.46;
    spin.current += dt * rate;

    const tabletDissolve = range(t, T.dissolveFrom, T.dissolveTo);
    const glassDissolve = 1 - range(t, T.glassFrom, T.glassTo);
    const fill = range(t, T.fillFrom, T.fillTo) * FULL_FILL;

    if (tabletHandle) {
      tabletHandle.setDissolve(tabletDissolve);
      const solid = tabletHandle.group;
      if (solid) {
        // Skipped once fully dissolved: every fragment is discarded, but the
        // draw call and vertex pass would still be paid.
        solid.visible = tabletDissolve < 0.999;
        solid.rotation.y = spin.current;
        solid.rotation.x =
          0.34 + smoothstep(T.settleTo, T.cinematicTo, t) * 0.5;
      }
    }

    if (vialHandle) {
      vialHandle.setDissolve(glassDissolve);
      vialHandle.setFill(fill);
      const solid = vialHandle.group;
      if (solid) {
        solid.visible = glassDissolve < 0.999;
        // Inherits the tablet's momentum, decaying to a slow turn.
        solid.rotation.y = spin.current * 0.42;
      }
    }

  });

  return (
    <SceneAnchor definition={definition} scale={ASSEMBLY_SCALE} driftAmount={0.05} driftSpeed={0.3}>
        {/* Both objects are built at scale 1 so the sampled clouds, the meshes
            and the particles share one coordinate space. */}
        <Tablet ref={tablet} dissolvable />
        <SerumBottle ref={vial} fill={0} dissolvable />

        {clouds ? (
          <TransformParticles
            source={clouds.source}
            target={clouds.target}
            waypoint={clouds.waypoint}
            getProgress={getMorph}
            getOpacity={getParticleOpacity}
            getCipher={getCipher}
            size={particleSize}
            // Near-zero swirl: the structure comes from the column, not from a
            // spiral. Chapter 03 already owns that motion.
            swirlStrength={0.35}
            bulgeRange={[0.02, 0.12]}
            cipherRatio={0.34}
            /*
              A tight stagger, unlike chapter 03's.

              Every particle passes through the lattice at ITS OWN mid-flight,
              so a wide stagger means they reach it at different moments and the
              structure never exists on screen at once. Narrow enough for the
              column to resolve, wide enough that the cloud does not move as one
              rigid body.
            */
            spread={0.16}
            // Well under the lattice's ring spacing, or it smears the pattern.
            drift={0.012}
            seed={9}
          />
        ) : null}
    </SceneAnchor>
  );
}
