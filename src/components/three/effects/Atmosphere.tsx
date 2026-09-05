'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  NormalBlending,
  type Points,
} from 'three';
import { accent, fog, mark, neutral } from '@/lib/design/tokens';
import { mote } from '@/lib/design/materials';
import { seededRandom } from '@/lib/math';
import { SCENES } from '@/lib/scenes';

export interface AtmosphereProps {
  /** Particle count, from the quality budget. */
  count: number;
}

/**
 * Airborne motes.
 *
 * The particle direction is sterile air in a laminar-flow cabinet: small, dim,
 * unsaturated and slow. They exist to give the empty chamber depth parallax --
 * you should register them as air, not notice them as particles. A small
 * fraction are brighter, standing in for motes that drift through the key light.
 *
 * One `Points` draw call spans all eight stations, so the cost is fixed however
 * far the camera has travelled.
 */
export default function Atmosphere({ count }: AtmosphereProps) {
  const points = useRef<Points>(null);

  // World depth is derived from the scene layout, so it never drifts out of sync.
  const depth = useMemo(() => {
    const zs = SCENES.map((s) => s.anchor[2]);
    return { near: Math.max(...zs) + 24, far: Math.min(...zs) - 34 };
  }, []);

  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const span = depth.near - depth.far;

    /*
      Read here rather than from a module constant, so the cloud is built from
      whichever palette is current. `n09` is a mid grey in BOTH ramps -- dim
      against the dark chamber, and equally dim against paper -- which is the
      whole point of addressing the ramp by role.
    */
    const dim = new Color(neutral.n09);
    const bright = new Color(accent.pharma.ink);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (seededRandom(i * 1.7) - 0.5) * 76;
      positions[i * 3 + 1] = (seededRandom(i * 3.3) - 0.5) * 46;
      positions[i * 3 + 2] = depth.far + seededRandom(i * 5.9) * span;

      // A small minority catch the key light and read warm.
      const isHighlight = seededRandom(i * 9.1) < mote.highlightRatio;
      const c = isHighlight ? bright : dim;
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(positions, 3));
    g.setAttribute('color', new BufferAttribute(colors, 3));
    return g;
  }, [count, depth]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((state, delta) => {
    if (!points.current) return;
    const dt = Math.min(delta, 1 / 20);
    // Barely-there drift; enough to keep the chamber from feeling like a still.
    points.current.rotation.y += dt * 0.005;
    points.current.position.y = Math.sin(state.clock.elapsedTime * 0.07) * 0.35;
  });

  return (
    <>
      {/*
        Atmospheric depth. R3F attaches this to the scene and removes it on
        unmount. It is doing compositional work as well as depth: without it,
        chapters the camera has not reached yet bleed into the frame of the one
        being viewed -- the opening core had chapter 02's capsule floating
        behind it before this was restored.
      */}
      <fogExp2 attach="fog" args={[fog.color, fog.density]} />

      <points ref={points} geometry={geometry} frustumCulled={false}>
        <pointsMaterial
          vertexColors
          size={mote.size}
          sizeAttenuation
          transparent
          opacity={mote.opacity}
          blending={mark.additive ? AdditiveBlending : NormalBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </points>
    </>
  );
}
