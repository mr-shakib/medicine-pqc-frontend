'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  NormalBlending,
  ShaderMaterial,
  Sphere,
  Vector3,
  type Points,
} from 'three';
import { accent, fog, mark } from '@/lib/design/tokens';
import { transformFragment, transformVertex } from '@/shaders/transform';
import { clamp, seededRandom } from '@/lib/math';
import type { SurfaceSample } from '@/lib/geometry/surfaceSampler';

export interface TransformParticlesProps {
  /** Where particles begin. Length must match `target`. */
  source: SurfaceSample;
  /** Where particles end. */
  target: SurfaceSample;
  /**
   * Optional structured pose the cloud passes through at mid-flight.
   *
   * Omit for a direct morph: the attribute is then filled with the plain
   * midpoint, which collapses the path's Bezier back to a straight line.
   */
  waypoint?: Float32Array;
  /** 0 = fully at source, 1 = fully at target. Read every frame. */
  getProgress: () => number;
  /** Overall visibility, 0 -> 1. Read every frame. */
  getOpacity: () => number;
  /** How strongly particles read as ciphertext. Read every frame. */
  getCipher: () => number;

  color?: string;
  cipherColor?: string;
  size?: number;
  /** Fraction of the timeline given over to per-particle stagger. */
  spread?: number;
  /** Radians of spiral at mid-flight, before the per-particle multiplier. */
  swirlStrength?: number;
  /** [min, max] radial expansion at mid-flight, per particle. */
  bulgeRange?: [number, number];
  /** Fraction of particles that read as ciphertext in flight. */
  cipherRatio?: number;
  /**
   * Per-particle wander at mid-flight, in local units.
   *
   * Keep it well below the spacing of any structured waypoint, or the drift
   * erases the structure.
   */
  drift?: number;
  seed?: number;
}

/**
 * The morph cloud.
 *
 * A single draw call that carries an object apart and reassembles it as
 * another. Source and target positions live in attributes; the flight is
 * evaluated per-vertex on the GPU from one uniform, so the cost is independent
 * of particle count in any way the CPU can feel, and the whole sequence is a
 * pure function of scroll.
 */
export default function TransformParticles({
  source,
  target,
  waypoint,
  getProgress,
  getOpacity,
  getCipher,
  color = accent.pharma.light,
  cipherColor = accent.analysis.light,
  size = 0.42,
  spread = 0.38,
  swirlStrength = 2.2,
  bulgeRange = [0.1, 0.44],
  cipherRatio = 0.28,
  drift = 0.05,
  seed = 1,
}: TransformParticlesProps) {
  const points = useRef<Points>(null);

  const count = Math.min(
    source.positions.length,
    target.positions.length,
  ) / 3;

  const geometry = useMemo(() => {
    const g = new BufferGeometry();

    g.setAttribute(
      'position',
      new BufferAttribute(source.positions.slice(0, count * 3), 3),
    );
    g.setAttribute(
      'aTarget',
      new BufferAttribute(target.positions.slice(0, count * 3), 3),
    );

    // Absent a supplied waypoint, the straight midpoint degenerates the path's
    // Bezier into a plain interpolation.
    const via = new Float32Array(count * 3);
    for (let i = 0; i < count * 3; i++) {
      via[i] = waypoint
        ? waypoint[i]
        : (source.positions[i] + target.positions[i]) * 0.5;
    }
    g.setAttribute('aWaypoint', new BufferAttribute(via, 3));

    const seeds = new Float32Array(count);
    const delays = new Float32Array(count);
    const swirls = new Float32Array(count);
    const bulges = new Float32Array(count);
    const ciphers = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const k = (i + 1) * seed;
      seeds[i] = seededRandom(k * 1.7);
      delays[i] = seededRandom(k * 3.3);
      // Signed, so the cloud counter-rotates against itself rather than
      // spinning as one rigid mass.
      swirls[i] = seededRandom(k * 5.1) * 2 - 1;
      bulges[i] =
        bulgeRange[0] + seededRandom(k * 7.9) * (bulgeRange[1] - bulgeRange[0]);
      // A minority become ciphertext. All of them would read as a wall of
      // noise; a scattering reads as fragments within the material.
      ciphers[i] = seededRandom(k * 11.3) < cipherRatio ? 1 : 0;
    }

    g.setAttribute('aSeed', new BufferAttribute(seeds, 1));
    g.setAttribute('aDelay', new BufferAttribute(delays, 1));
    g.setAttribute('aSwirl', new BufferAttribute(swirls, 1));
    g.setAttribute('aBulge', new BufferAttribute(bulges, 1));
    g.setAttribute('aCipher', new BufferAttribute(ciphers, 1));

    // Particles leave the source volume during the spiral, so the bounding
    // sphere is set generously rather than computed from the rest positions --
    // otherwise the whole cloud is culled at exactly the moment it opens out.
    g.boundingSphere = new Sphere(new Vector3(0, 0, 0), 6);

    return g;
  }, [source, target, waypoint, count, seed, bulgeRange, cipherRatio]);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: transformVertex,
        fragmentShader: transformFragment,
        transparent: true,
        /*
          Additive on a dark ground, normal on a light one -- and premultiplied
          either way, so the same program composites correctly under both. See
          `hologram` in `lib/design/materials` for why a mark cannot simply be
          added to paper.
        */
        blending: mark.additive ? AdditiveBlending : NormalBlending,
        premultipliedAlpha: true,
        depthWrite: false,
        uniforms: {
          uProgress: { value: 0 },
          uSize: { value: size },
          uPixelRatio: { value: 1 },
          uOpacity: { value: 0 },
          uCipherAmount: { value: 0 },
          uSpread: { value: spread },
          uSwirlStrength: { value: swirlStrength },
          uDriftAmount: { value: drift },
          uTime: { value: 0 },
          uColor: { value: new Color(color) },
          uCipherColor: { value: new Color(cipherColor) },
          uFogDensity: { value: fog.density },
        },
      }),
    [size, spread, swirlStrength, drift, color, cipherColor],
  );

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame((state) => {
    const node = points.current;
    if (!node) return;

    const uniforms = (node.material as ShaderMaterial).uniforms;
    const opacity = clamp(getOpacity());

    // Skip the draw entirely while the cloud is invisible: for most of the
    // chapter these particles contribute nothing, and a hidden Points object
    // still costs a draw call and a full vertex pass.
    node.visible = opacity > 0.002;
    if (!node.visible) return;

    uniforms.uProgress.value = clamp(getProgress());
    uniforms.uOpacity.value = opacity * mark.density;
    uniforms.uCipherAmount.value = clamp(getCipher());
    uniforms.uTime.value = state.clock.elapsedTime;
    uniforms.uPixelRatio.value = state.viewport.dpr;
  });

  return (
    <points
      ref={points}
      geometry={geometry}
      material={material}
      frustumCulled={false}
      visible={false}
    />
  );
}
