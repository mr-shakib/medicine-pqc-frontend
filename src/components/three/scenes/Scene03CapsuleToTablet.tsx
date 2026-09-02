'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import Capsule, { type CapsuleHandle } from '@/components/three/objects/Capsule';
import Tablet, { type TabletHandle } from '@/components/three/objects/Tablet';
import TransformParticles from '@/components/three/objects/TransformParticles';
import { useSceneProgress } from '@/hooks/useSceneProgress';
import { useQuality } from '@/components/three/QualityProvider';
import { alignByBearing, type SurfaceSample } from '@/lib/geometry/surfaceSampler';
import { range, smoothstep } from '@/lib/math';
import type { SceneComponentProps } from '@/types';

/**
 * The transformation timeline, in scene-local progress.
 *
 * Pushed late for the same reason chapter 02's is: this chapter's local window
 * opens halfway through the previous one, but its own copy is not pinned until
 * local 0.5. The opening rotation covers the overlap, and every beat that needs
 * explaining happens under this chapter's own line.
 */
const T = {
  /** Slow rotation carried over from the sealed capsule. */
  settleTo: 0.36,
  /** Rotation opens up while the camera closes in. */
  cinematicTo: 0.5,
  /** The shell begins to give way and particles lift off it. */
  dissolveFrom: 0.52,
  dissolveTo: 0.63,
  /** Free flight: the spiral peaks and fragments read as ciphertext. */
  cipherFrom: 0.57,
  cipherTo: 0.82,
  /** The cloud reorganises onto the new form. */
  reformFrom: 0.66,
  reformTo: 0.87,
  /** The tablet condenses out of the cloud. */
  solidifyFrom: 0.83,
  solidifyTo: 0.95,
} as const;

/** Scale applied to the whole assembly. Both objects are built at 1. */
const ASSEMBLY_SCALE = 2;

/**
 * SCENE 03 — CAPSULE TO TABLET.
 *
 * The capsule does not hide and the tablet does not appear. The capsule's
 * surface is sampled into a particle cloud, that cloud spirals out, a scattering
 * of it reads as ciphertext mid-flight, and it reorganises onto a sampled
 * tablet surface which then condenses into solid geometry.
 *
 * The whole morph is ONE draw call. Source and target positions live in vertex
 * attributes and the flight is evaluated on the GPU from a single uniform
 * driven by scroll — see `objects/TransformParticles`. Nothing is animated on
 * the CPU, and because position is a pure function of that uniform the sequence
 * reverses exactly.
 *
 * Source and target clouds are paired by bearing rather than by index, so each
 * particle keeps its side of the object through the flight and the swarm reads
 * as the same material reorganising rather than as noise that happens to
 * resolve.
 */
export default function Scene03CapsuleToTablet({
  definition,
}: SceneComponentProps) {
  const group = useRef<Group>(null);
  /**
   * Animation happens on an inner node, never on the anchored one.
   *
   * Writing `group.position.y` directly would overwrite the anchor's own y and
   * silently drop the whole assembly out of the camera's aim — which is exactly
   * what it did before this split: the chapter sits at y = 1, the drift wrote
   * ±0.05, and the object rendered a full world unit below where the camera was
   * looking.
   */
  const drift = useRef<Group>(null);
  const capsule = useRef<CapsuleHandle>(null);
  const tablet = useRef<TabletHandle>(null);
  const progress = useSceneProgress(definition.index);
  const budget = useQuality();

  /*
    Density, not just count, is the thing to control.
    
    The cloud is additive, so brightness accumulates wherever particles overlap.
    A count tuned on a 1440px viewport lands the same particles in roughly a
    quarter of the area on a phone, and the middle of the cloud burns out to
    flat white. Lower tiers -- which is what a phone resolves to -- get both
    fewer and smaller particles.
  */
  const particleCount = useMemo(
    () => Math.round(budget.particles * (budget.tier === 'high' ? 0.85 : 0.5)),
    [budget.particles, budget.tier],
  );

  const particleSize =
    budget.tier === 'high' ? 0.42 : budget.tier === 'medium' ? 0.32 : 0.28;

  /**
   * Both clouds, sampled once from the two handles.
   *
   * Held in state rather than a memo because the handles are refs and are only
   * populated after the children have mounted; the effect below runs on the
   * commit that first makes them available.
   */
  const [clouds, setClouds] = useState<{
    source: SurfaceSample;
    target: SurfaceSample;
  } | null>(null);

  useEffect(() => {
    const capsuleHandle = capsule.current;
    const tabletHandle = tablet.current;
    if (!capsuleHandle || !tabletHandle) return;

    const source = capsuleHandle.sampleSurface(particleCount, 3);
    const target = tabletHandle.sampleSurface(particleCount, 11);

    // Sampling returns cached arrays; copy before reordering so the caches are
    // not mutated underneath their owners.
    const pair = {
      source: {
        positions: source.positions.slice(),
        normals: source.normals.slice(),
      },
      target: {
        positions: target.positions.slice(),
        normals: target.normals.slice(),
      },
    };

    alignByBearing(pair.source, pair.target);
    setClouds(pair);
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
    // Rises with the dissolve, falls as the tablet takes over.
    return (
      smoothstep(T.dissolveFrom - 0.04, T.dissolveTo, t) *
      (1 - smoothstep(T.solidifyFrom, T.solidifyTo + 0.03, t))
    );
  }, [progress]);

  const getCipher = useCallback(() => {
    const t = progress.local();
    return (
      smoothstep(T.cipherFrom, T.cipherFrom + 0.1, t) *
      (1 - smoothstep(T.cipherTo - 0.12, T.cipherTo, t))
    );
  }, [progress]);

  /* ---------------------------------------------------------------------- */
  /* Frame                                                                  */
  /* ---------------------------------------------------------------------- */

  const spin = useRef(0);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 20);
    const t = progress.local();
    const time = state.clock.elapsedTime;

    const capsuleHandle = capsule.current;
    const tabletHandle = tablet.current;

    /* --- 1-2: slow rotation, opening into something more cinematic ------- */
    // Rate is scroll-driven but the angle accumulates, so the object never
    // snaps when the rate changes.
    const rate = 0.16 + smoothstep(T.settleTo, T.cinematicTo, t) * 0.5;
    spin.current += dt * rate;

    /* --- 4: the shell gives way ------------------------------------------ */
    const shellDissolve = range(t, T.dissolveFrom, T.dissolveTo);

    /* --- 9: the tablet condenses ----------------------------------------- */
    const tabletDissolve = 1 - range(t, T.solidifyFrom, T.solidifyTo);

    if (capsuleHandle) {
      capsuleHandle.setDissolve(shellDissolve);
      const shell = capsuleHandle.group;
      if (shell) {
        // Skipped entirely once fully dissolved: every fragment would be
        // discarded, but the draw call and vertex pass would still be paid.
        shell.visible = shellDissolve < 0.999;
        shell.rotation.y = spin.current;
        shell.rotation.z = smoothstep(T.settleTo, T.cinematicTo, t) * 0.34;
      }
    }

    if (tabletHandle) {
      tabletHandle.setDissolve(tabletDissolve);
      const solid = tabletHandle.group;
      if (solid) {
        solid.visible = tabletDissolve < 0.999;
        // Picks up the rotation the capsule was carrying, so the new form
        // inherits the old one's momentum instead of starting from rest.
        solid.rotation.y = spin.current * 0.55;
        solid.rotation.x =
          (1 - smoothstep(T.solidifyFrom, 1, t)) * 0.5 +
          Math.sin(time * 0.3) * 0.05;
      }
    }

    /* --- 11: the assembly itself drifts slowly --------------------------- */
    if (drift.current) {
      drift.current.position.y = Math.sin(time * 0.32) * 0.05;
    }
  });

  return (
    <group
      ref={group}
      position={definition.anchor as unknown as [number, number, number]}
      scale={ASSEMBLY_SCALE}
    >
      <group ref={drift}>
        {/* Both objects are built at scale 1 so the sampled clouds, the meshes
            and the particles all share one coordinate space. */}
        <Capsule ref={capsule} dissolvable />
        <Tablet ref={tablet} dissolvable />

        {clouds ? (
          <TransformParticles
            source={clouds.source}
            target={clouds.target}
            getProgress={getMorph}
            getOpacity={getParticleOpacity}
            getCipher={getCipher}
              size={particleSize}
          />
        ) : null}
      </group>
    </group>
  );
}
