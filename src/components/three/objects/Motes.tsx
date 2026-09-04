'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  ShaderMaterial,
  type Points,
} from 'three';
import { accent, fog } from '@/lib/design/tokens';
import { motesFragment, motesVertex } from '@/shaders/motes';
import { clamp, seededRandom } from '@/lib/math';

export interface MotesProps {
  /** Number of particles. Scale this by the quality budget at the call site. */
  count: number;
  /** Inner radius of the spherical shell they occupy. */
  innerRadius?: number;
  /** Outer radius of the shell. */
  outerRadius?: number;
  color?: string;
  /** Base point size, before per-particle scale and perspective. */
  size?: number;
  /** Multiplier on the per-particle drift. 0 freezes the cloud. */
  drift?: number;
  /** Rotation of the whole cloud, radians per second. */
  spin?: number;
  /** Read every frame: 0 hides the cloud, 1 shows it fully. */
  getReveal?: () => number;
  /** Read every frame: 0 rest positions, 1 collapsed toward the centre. */
  getConverge?: () => number;
  /** Changes the deterministic layout without changing its statistics. */
  seed?: number;
}

/**
 * A cloud of suspended motes.
 *
 * Points are distributed through a spherical SHELL rather than a ball: a solid
 * sphere of points bunches visibly at its centre and hides whatever it is meant
 * to be surrounding. Layout is seeded, so it is identical on every render and
 * across reloads.
 *
 * One draw call. Reveal and convergence are read per frame through getters, so
 * a scroll timeline can drive them with no React work.
 */
export default function Motes({
  count,
  innerRadius = 0.95,
  outerRadius = 2.45,
  color = accent.pharma.light,
  size = 0.3,
  drift = 1,
  spin = -0.035,
  getReveal,
  getConverge,
  seed = 1,
}: MotesProps) {
  const points = useRef<Points>(null);

  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const phases = new Float32Array(count);
    const scales = new Float32Array(count);
    const span = outerRadius - innerRadius;

    for (let i = 0; i < count; i++) {
      const k = (i + 1) * seed;
      const u = seededRandom(k * 1.31) * 2 - 1;
      const theta = seededRandom(k * 2.77) * Math.PI * 2;
      const radial = Math.sqrt(Math.max(0, 1 - u * u));
      // Cube root keeps the shell evenly dense rather than crowding the inside.
      const radius = innerRadius + Math.cbrt(seededRandom(k * 4.19)) * span;

      positions[i * 3] = Math.cos(theta) * radial * radius;
      positions[i * 3 + 1] = u * radius;
      positions[i * 3 + 2] = Math.sin(theta) * radial * radius;

      phases[i] = seededRandom(k * 5.53) * Math.PI * 2;
      // Biased small, so a few brighter motes stand out from a dim majority.
      scales[i] = 0.35 + Math.pow(seededRandom(k * 7.91), 2.2) * 0.9;
    }

    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(positions, 3));
    g.setAttribute('aPhase', new BufferAttribute(phases, 1));
    g.setAttribute('aScale', new BufferAttribute(scales, 1));
    return g;
  }, [count, innerRadius, outerRadius, seed]);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: motesVertex,
        fragmentShader: motesFragment,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        uniforms: {
          uColor: { value: new Color(color) },
          uTime: { value: 0 },
          uSize: { value: size },
          uPixelRatio: { value: 1 },
          uReveal: { value: getReveal ? 0 : 1 },
          uDrift: { value: drift },
          uConverge: { value: 0 },
          uFogDensity: { value: fog.density },
        },
      }),
    [color, size, drift, getReveal],
  );

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame((state, delta) => {
    if (!points.current) return;
    const dt = Math.min(delta, 1 / 20);

    // Reached through the object rather than the memoised handle: uniforms are
    // mutated every frame, which belongs to the scene graph, not render output.
    const uniforms = (points.current.material as ShaderMaterial).uniforms;
    uniforms.uTime.value = state.clock.elapsedTime;
    // Read per frame so a resolution step-down does not rebuild the material.
    uniforms.uPixelRatio.value = state.viewport.dpr;
    if (getReveal) uniforms.uReveal.value = clamp(getReveal());
    if (getConverge) uniforms.uConverge.value = clamp(getConverge());

    points.current.rotation.y += dt * spin;
  });

  return (
    <points
      ref={points}
      geometry={geometry}
      material={material}
      frustumCulled={false}
    />
  );
}
