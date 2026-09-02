'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  Color,
  DoubleSide,
  Group,
  InstancedMesh,
  Object3D,
  ShaderMaterial,
  type Mesh,
  type MeshBasicMaterial,
  type MeshPhysicalMaterial,
} from 'three';
import { accent, fog } from '@/lib/design/tokens';
import { hairline, hologram } from '@/lib/design/materials';
import { clamp, smoothstep } from '@/lib/math';
import { useQuality } from '@/components/three/QualityProvider';
import { coreShellFragment, coreShellVertex } from '@/shaders/medicineCore';
import Motes from '@/components/three/objects/Motes';

const dummy = new Object3D();

/** Number of measurement ticks around the equatorial instrument ring. */
const TICK_COUNT = 48;

export interface MedicineCoreProps {
  /**
   * Reveal amount, 0 -> 1, read every frame. Passed as a getter rather than a
   * value so the scroll timeline can drive it without re-rendering React.
   */
  getReveal?: () => number;
  /**
   * Retraction, 0 -> 1, read every frame.
   *
   * Withdraws the outer layers -- cage, instrumentation and motes -- leaving
   * only the nucleus and its glow. This is what allows a capsule to close
   * around the core: the measuring apparatus has to get out of the way first,
   * and having it visibly withdraw reads far better than having it vanish.
   */
  getRetract?: () => number;
  /** Number of suspended motes. Scaled by the quality budget by the caller. */
  motes?: number;
}

/**
 * THE MEDICINE CORE — the opening hero object.
 *
 * Six concentric layers, each revealed on its own stagger so the object
 * assembles out of darkness rather than fading in as a single flat image:
 *
 *   1. Nucleus      polished amber bead, faint internal emission
 *   2. Inner glow   additive fresnel shell, the light escaping the nucleus
 *   3. Crystal      custom-shaded shell: rim, interior glow, striations
 *   4. Cage         hairline structural wireframe, counter-rotating
 *   5. Instruments  two measurement rings and 48 ticks -- the holographic layer
 *   6. Motes        suspended particles on individually drifting paths
 *
 * Everything is a pure function of the reveal value, so scrolling backwards
 * reverses the assembly exactly.
 */
export default function MedicineCore({
  getReveal = () => 1,
  getRetract,
  motes = 420,
}: MedicineCoreProps) {
  const budget = useQuality();

  const root = useRef<Group>(null);
  const nucleus = useRef<Mesh>(null);
  const innerGlow = useRef<Mesh>(null);
  const crystal = useRef<Mesh>(null);
  const cage = useRef<Group>(null);
  const instruments = useRef<Group>(null);
  const ticks = useRef<InstancedMesh>(null);

  const detail = budget.detail;

  /**
   * The motes are a child component, so their reveal is handed over as a
   * getter backed by a ref. Written once per frame here, read once per frame
   * there -- no prop churn, no re-render.
   */
  const motesRevealValue = useRef(0);
  const motesReveal = useCallback(() => motesRevealValue.current, []);

  /* ---------------------------------------------------------------------- */
  /* Materials                                                              */
  /* ---------------------------------------------------------------------- */

  const shellMaterial = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: coreShellVertex,
        fragmentShader: coreShellFragment,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
        uniforms: {
          uRimColor: { value: new Color(accent.pharma.light) },
          uGlowColor: { value: new Color(accent.pharma.base) },
          uTime: { value: 0 },
          uReveal: { value: 0 },
          uRimPower: { value: 2.6 },
          uFogDensity: { value: fog.density },
        },
      }),
    [],
  );

  const glowMaterial = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: coreShellVertex,
        fragmentShader: coreShellFragment,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        side: DoubleSide,
        uniforms: {
          uRimColor: { value: new Color(accent.pharma.glow) },
          uGlowColor: { value: new Color(accent.pharma.light) },
          uTime: { value: 0 },
          uReveal: { value: 0 },
          // A softer falloff than the crystal, so this layer reads as haze.
          uRimPower: { value: 2.0 },
          uFogDensity: { value: fog.density },
        },
      }),
    [],
  );

  /* ---------------------------------------------------------------------- */
  /* Instrument tick placement (written once)                               */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (!ticks.current) return;
    for (let i = 0; i < TICK_COUNT; i++) {
      const angle = (i / TICK_COUNT) * Math.PI * 2;
      // Every fourth tick is a major graduation, as on a real instrument dial.
      const major = i % 4 === 0;
      dummy.position.set(Math.cos(angle) * 1.34, 0, Math.sin(angle) * 1.34);
      dummy.rotation.set(0, -angle, 0);
      dummy.scale.set(major ? 0.075 : 0.038, 0.004, 0.004);
      dummy.updateMatrix();
      ticks.current.setMatrixAt(i, dummy.matrix);
    }
    ticks.current.instanceMatrix.needsUpdate = true;
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Disposal                                                               */
  /* ---------------------------------------------------------------------- */

  useEffect(
    () => () => {
      shellMaterial.dispose();
      glowMaterial.dispose();
    },
    [shellMaterial, glowMaterial],
  );

  /* ---------------------------------------------------------------------- */
  /* Frame                                                                  */
  /* ---------------------------------------------------------------------- */

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 20);
    const time = state.clock.elapsedTime;
    const reveal = clamp(getReveal());
    // Retraction withdraws the outer layers so something else can occupy the
    // space -- see the capsule closing around the core in chapter 02.
    const retract = getRetract ? clamp(getRetract()) : 0;
    const present = 1 - retract;

    // Staggered emergence. Each layer has its own window, so the object
    // assembles inward-out instead of appearing all at once.
    const revealNucleus = smoothstep(0.0, 0.3, reveal);
    const revealShell = smoothstep(0.06, 0.42, reveal);
    const revealMotes = smoothstep(0.2, 0.62, reveal) * present;
    // The cage and instrumentation withdraw first and fastest: they are the
    // measuring apparatus, and they leave before the shell does.
    const revealCage = smoothstep(0.4, 0.76, reveal) * present;
    const revealInstruments =
      smoothstep(0.58, 0.94, reveal) * Math.max(0, 1 - retract * 1.6);

    motesRevealValue.current = revealMotes;

    // --- Slow natural movement -------------------------------------------
    if (root.current) {
      root.current.rotation.y += dt * 0.085;
      // Two out-of-phase sines: the drift never visibly repeats.
      root.current.position.y =
        Math.sin(time * 0.31) * 0.055 + Math.sin(time * 0.17) * 0.035;
      root.current.rotation.x = Math.sin(time * 0.13) * 0.06;
    }

    if (cage.current) {
      cage.current.rotation.y -= dt * 0.14;
      cage.current.rotation.z = Math.sin(time * 0.09) * 0.12;
      // Draws inward as it fades, so it reads as withdrawing rather than
      // simply switching off.
      cage.current.scale.setScalar((0.9 + revealCage * 0.1) * (1 - retract * 0.45));
    }

    if (instruments.current) {
      instruments.current.rotation.y += dt * 0.05;
      instruments.current.scale.setScalar(1 - retract * 0.5);
    }

    // --- Reveal -----------------------------------------------------------
    if (nucleus.current) {
      const material = nucleus.current.material as MeshPhysicalMaterial;
      material.emissiveIntensity = revealNucleus * 0.5;
      nucleus.current.scale.setScalar(0.55 + revealNucleus * 0.45);
    }

    // Uniforms are reached through the object refs rather than the memoised
    // handles: they are mutated every frame, which belongs to the scene graph,
    // not to render output.
    if (crystal.current) {
      const uniforms = (crystal.current.material as ShaderMaterial).uniforms;
      uniforms.uTime.value = time;
      uniforms.uReveal.value = revealShell * (1 - retract * 0.75);
      crystal.current.scale.setScalar(
        (0.82 + revealShell * 0.18) * (1 - retract * 0.62),
      );
    }

    if (innerGlow.current) {
      const uniforms = (innerGlow.current.material as ShaderMaterial).uniforms;
      uniforms.uTime.value = time;
      uniforms.uReveal.value = revealShell * 0.3 * (1 - retract * 0.4);
      // A slow breath, so the internal light feels alive rather than static.
      const breath = 1 + Math.sin(time * 0.55) * 0.035;
      innerGlow.current.scale.setScalar((0.7 + revealShell * 0.3) * breath);
    }

    if (cage.current) {
      const material = (cage.current.children[0] as Mesh)
        .material as MeshBasicMaterial;
      material.opacity = revealCage * 0.13;
    }

    if (instruments.current) {
      instruments.current.traverse((child) => {
        const mesh = child as Mesh;
        if (!mesh.material) return;
        const material = mesh.material as MeshBasicMaterial;
        if (material.transparent) material.opacity = revealInstruments * 0.28;
      });
      if (ticks.current) {
        (ticks.current.material as MeshBasicMaterial).opacity =
          revealInstruments * 0.4;
      }
    }
  });

  return (
    <group ref={root}>
      {/* 1 — Nucleus: a polished bead, lit rather than luminous. */}
      <mesh ref={nucleus} castShadow receiveShadow>
        <icosahedronGeometry args={[0.3, detail + 2]} />
        <meshPhysicalMaterial
          color={accent.pharma.base}
          roughness={0.16}
          metalness={0}
          clearcoat={1}
          clearcoatRoughness={0.06}
          emissive={accent.pharma.deep}
          emissiveIntensity={0}
          envMapIntensity={1.2}
        />
      </mesh>

      {/* 2 — Inner glow: the light escaping the nucleus. */}
      <mesh ref={innerGlow} material={glowMaterial}>
        <icosahedronGeometry args={[0.46, detail + 2]} />
      </mesh>

      {/* 3 — Crystalline shell. */}
      {/* Detail is pushed up here: these shells ARE the object's silhouette,
          and faceting on an outline reads immediately as low-poly. */}
      <mesh ref={crystal} material={shellMaterial}>
        <icosahedronGeometry args={[0.88, detail + 2]} />
      </mesh>

      {/* 4 — Structural cage. */}
      <group ref={cage}>
        <mesh>
          <icosahedronGeometry args={[1.12, detail + 1]} />
          <meshBasicMaterial {...hairline(accent.pharma.base, 0)} />
        </mesh>
      </group>

      {/* 5 — Holographic instrumentation: measurement rings and graduations. */}
      <group ref={instruments}>
        {/* Equatorial ring */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.34, 0.0035, 4, 128]} />
          <meshBasicMaterial {...hologram(accent.pharma.light, 0)} />
        </mesh>

        {/* Inclined ring — reads as a second measurement axis. */}
        <mesh rotation={[Math.PI / 2 - 0.42, 0, 0.3]}>
          <torusGeometry args={[1.62, 0.003, 4, 128]} />
          <meshBasicMaterial {...hologram(accent.pharma.base, 0)} />
        </mesh>

        {/* Graduations around the equator — one instanced draw call. */}
        <instancedMesh
          ref={ticks}
          args={[undefined, undefined, TICK_COUNT]}
          frustumCulled={false}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial {...hologram(accent.pharma.light, 0)} />
        </instancedMesh>
      </group>

      {/* 6 — Suspended motes. */}
      <Motes count={motes} getReveal={motesReveal} seed={1} />
    </group>
  );
}
