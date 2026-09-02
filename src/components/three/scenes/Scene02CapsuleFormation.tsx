'use client';

import { useCallback, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, type PointLight } from 'three';
import Capsule, { type CapsuleHandle } from '@/components/three/objects/Capsule';
import Motes from '@/components/three/objects/Motes';
import { useSceneProgress } from '@/hooks/useSceneProgress';
import { useQuality } from '@/components/three/QualityProvider';
import { accent } from '@/lib/design/tokens';
import { hologram } from '@/lib/design/materials';
import { damp, lerp, range, smoothstep } from '@/lib/math';
import type { SceneComponentProps } from '@/types';

/**
 * The formation timeline, in scene-local progress.
 *
 * Named rather than inlined because every phase has to be readable against the
 * beat list, and because the camera keys in `lib/scenes` are tuned against
 * these exact numbers.
 */
const T = {
  /** Halves fade in at their staging marks, off-axis and tumbling. */
  appearFrom: 0.4,
  appearTo: 0.55,
  /** They travel toward the axis. */
  convergeFrom: 0.55,
  convergeTo: 0.72,
  /** Rotation settles; alignment guides confirm the axis. */
  alignFrom: 0.72,
  alignTo: 0.84,
  /** The cap seats onto the body. */
  closeFrom: 0.84,
  closeTo: 0.92,
} as const;

/*
  The timeline is pushed late on purpose.

  This chapter's local window opens halfway through chapter 01, but its own
  copy is not pinned until local 0.5. Starting the assembly earlier would play
  the whole sequence against chapter 01's departing statement, where nothing
  explains it. Local 0.4 -> 0.92 puts the visible work under this chapter's own
  line, and leaves the tail for the finished capsule to hold and turn.
*/

/**
 * Where each half waits before it is drawn in. Off-axis on all three axes, so
 * the travel reads as a real approach rather than a slide along one line.
 *
 * These are in the CAPSULE'S OWN local space — the halves live inside the
 * component's scaled root, so anything written here is multiplied by
 * CAPSULE_SCALE before it reaches the world.
 */
const STAGING = {
  body: { position: [-0.34, -1.35, 0.26], rotation: [0.42, 0.9, -0.38] },
  cap: { position: [0.34, 1.35, -0.26], rotation: [-0.5, -0.72, 0.44] },
} as const;

/*
  Staging is mostly along the capsule's own axis, with only a small lateral
  offset. A wide horizontal spread reads well in isolation but throws the halves
  across the copy column once the compositional framing has pushed the subject
  to one side -- and the axial approach is the true motion anyway.
*/

/** Scale that lets the shell close around the retracted core. */
const CAPSULE_SCALE = 2.2;

/**
 * SCENE 02 — CAPSULE FORMATION.
 *
 * The core resolved in chapter 01 is still there, in the same world position —
 * this chapter shares chapter 01's anchor, so the camera orbits rather than
 * travels and the object never cuts. As the orbit begins, chapter 01's core
 * retracts its measuring apparatus (driven from `Scene01`, reading this
 * chapter's progress) and two capsule halves resolve out of the dark, off-axis
 * and tumbling.
 *
 * They are then drawn in, brought onto the axis, precisely aligned, and sealed.
 * The finished capsule holds and turns.
 *
 * Every value below is a pure function of scroll position, so the entire
 * assembly runs backwards exactly.
 */
export default function Scene02CapsuleFormation({
  definition,
}: SceneComponentProps) {
  const group = useRef<Group>(null);
  const capsule = useRef<CapsuleHandle>(null);
  const guides = useRef<Group>(null);
  const guideRings = useRef<(Group | null)[]>([]);
  const seam = useRef<PointLight>(null);
  const progress = useSceneProgress(definition.index);
  const budget = useQuality();

  /** Damped flash at the seam, so a fast scrub cannot skip the peak entirely. */
  const settle = useRef(0);
  /**
   * Accumulated spin of the finished capsule.
   *
   * Accumulated rather than derived from `time * sealed`: that product jumps
   * whenever `sealed` changes, so scrubbing would tear the rotation. Advancing
   * an accumulator only while sealed keeps it continuous in both directions.
   */
  const spin = useRef(0);

  const motesReveal = useCallback(
    () => smoothstep(T.appearFrom - 0.1, T.convergeTo, progress.local()),
    [progress],
  );

  // The cloud is drawn inward as the capsule assembles: the same material
  // gathering into the object, rather than an unrelated decorative field.
  const motesConverge = useCallback(
    () => smoothstep(T.convergeFrom, T.closeTo, progress.local()),
    [progress],
  );

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 20);
    const t = progress.local();
    const time = state.clock.elapsedTime;

    const handle = capsule.current;
    if (!handle) return;

    const appear = range(t, T.appearFrom, T.appearTo);
    const converge = smoothstep(T.convergeFrom, T.convergeTo, t);
    const align = smoothstep(T.alignFrom, T.alignTo, t);
    const close = smoothstep(T.closeFrom, T.closeTo, t);
    const sealed = smoothstep(T.closeTo, 1, t);

    const { body, cap, layout } = handle;

    /* --- Presence: the halves scale in at their staging marks ------------- */
    const scale = appear * (0.82 + converge * 0.18);

    /* --- Travel ---------------------------------------------------------- */
    // Converge brings them onto the axis; align closes the last of the gap.
    // Keeping the two separate is what makes the approach read as a machine
    // placing a part rather than two objects drifting together.
    const gap = (1 - align) * layout.gap * 0.55;

    if (body) {
      body.scale.setScalar(Math.max(scale, 0.0001));
      body.visible = scale > 0.002;
      body.position.set(
        lerp(STAGING.body.position[0], 0, converge),
        lerp(STAGING.body.position[1], layout.bodyY - gap * 0.28, converge),
        lerp(STAGING.body.position[2], 0, converge),
      );
      body.rotation.set(
        lerp(STAGING.body.rotation[0], 0, align),
        lerp(STAGING.body.rotation[1], 0, converge * 0.7 + align * 0.3),
        lerp(STAGING.body.rotation[2], 0, align),
      );
    }

    if (cap) {
      cap.scale.setScalar(Math.max(scale, 0.0001));
      cap.visible = scale > 0.002;
      cap.position.set(
        lerp(STAGING.cap.position[0], 0, converge),
        lerp(STAGING.cap.position[1], layout.capY + gap * 0.72, converge),
        lerp(STAGING.cap.position[2], 0, converge),
      );
      // The cap is modelled flipped; its resting X rotation is PI.
      cap.rotation.set(
        lerp(STAGING.cap.rotation[0], Math.PI, align),
        lerp(STAGING.cap.rotation[1], 0, converge * 0.7 + align * 0.3),
        lerp(STAGING.cap.rotation[2], 0, align),
      );
    }

    /* --- Alignment guides ------------------------------------------------ */
    // Present only while the halves are being brought onto the axis, then gone
    // the moment the seal completes -- an instrument reading, not decoration.
    if (guides.current) {
      const shown = smoothstep(T.convergeFrom, T.alignFrom, t) * (1 - close);
      guides.current.visible = shown > 0.01;
      guides.current.traverse((child) => {
        const mesh = child as import('three').Mesh;
        const material = mesh.material as { opacity?: number } | undefined;
        if (material && typeof material.opacity === 'number') {
          material.opacity = shown * 0.3;
        }
      });
      guides.current.rotation.y = time * 0.18;

      // The rings close on the seam as the halves align: a caliper reading,
      // not a decoration that merely fades.
      const ringY = lerp(0.95, 0.16, align);
      guideRings.current[0]?.position.setY(-ringY);
      guideRings.current[1]?.position.setY(ringY);
    }

    /* --- Seal: a brief specular reaction at the join ---------------------- */
    if (seam.current) {
      // A narrow Gaussian centred on the moment of closure. Damped so a fast
      // scrub cannot skip past the peak without the light registering at all.
      const x = (t - T.closeTo) / 0.045;
      const flash = Math.exp(-x * x);
      settle.current = damp(settle.current, flash, 0.002, dt);
      seam.current.intensity = settle.current * 26;
      seam.current.visible = settle.current > 0.005;
    }

    /* --- Completed capsule: a slow, steady turn --------------------------- */
    spin.current += dt * 0.34 * sealed;
    if (group.current) {
      // Before the seal the assembly is nearly still, so the halves' own
      // motion reads clearly. Afterwards the finished object turns.
      //
      // No vertical drift here: the capsule has to stay concentric with the
      // core it is closing around, and the core carries its own slow bob.
      group.current.rotation.y = converge * 0.18 + sealed * 0.6 + spin.current;
    }

    // The shell stays sealed once closed; separation is driven above.
    handle.setDissolve(0);
  });

  return (
    <group
      ref={group}
      position={definition.anchor as unknown as [number, number, number]}
    >
      {/*
        The halves are driven directly through the handle rather than through
        `setSeparation`, because formation needs full control of position and
        rotation, not just the gap along the axis.
      */}
      <Capsule ref={capsule} scale={CAPSULE_SCALE} />

      {/* Alignment guides: the axis and two convergence rings. */}
      <group ref={guides} visible={false}>
        <mesh>
          <cylinderGeometry args={[0.004, 0.004, 3.6, 6]} />
          <meshBasicMaterial {...hologram(accent.pharma.light, 0)} />
        </mesh>
        {[0, 1].map((index) => (
          <group
            key={index}
            ref={(node) => {
              guideRings.current[index] = node;
            }}
          >
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.82, 0.0035, 4, 96]} />
              <meshBasicMaterial {...hologram(accent.pharma.base, 0)} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Light reaction at the seam. */}
      <pointLight
        ref={seam}
        position={[0, 0, 0]}
        color={accent.pharma.glow}
        intensity={0}
        distance={9}
        decay={2}
        visible={false}
      />

      {/* Formation motes, drawn inward as the shell assembles. */}
      <Motes
        count={Math.round(budget.particles * 0.05)}
        innerRadius={1.4}
        outerRadius={4.2}
        size={0.26}
        spin={0.028}
        seed={7}
        getReveal={motesReveal}
        getConverge={motesConverge}
      />
    </group>
  );
}
