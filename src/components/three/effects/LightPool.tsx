'use client';

import { useEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  Color,
  NormalBlending,
  ShaderMaterial,
  type Mesh,
} from 'three';
import { mark } from '@/lib/design/tokens';

const vertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragment = /* glsl */ `
  precision mediump float;
  uniform vec3 uColor;
  uniform float uIntensity;
  uniform float uFalloff;
  varying vec2 vUv;

  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float pool = pow(max(1.0 - d, 0.0), uFalloff);
    // Premultiplied, so the same quad is a pool of light under additive
    // blending and a soft contact shadow under normal blending.
    float a = pool * uIntensity;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

export interface LightPoolProps {
  position?: [number, number, number];
  /** Diameter of the pool. */
  size?: number;
  color?: string;
  intensity?: number;
  /** Higher concentrates the pool toward its centre. */
  falloff?: number;
}

/**
 * A soft pool beneath a subject — the plinth glow of a product shot.
 *
 * A deliberately cheap stand-in for a reflective floor. A true reflection needs
 * its own render pass of the whole scene, which for a soft, heavily blurred
 * highlight under an object is an enormous amount of work to arrive at
 * something the eye reads as "there is a surface down there". One quad with a
 * radial falloff reads the same and costs one draw.
 *
 * It changes meaning with the palette, and has to. Under a dark ground it is
 * additive and the caller's colour is a pale accent, so it reads as light
 * spilling onto the floor. On paper the same gesture is a CONTACT SHADOW --
 * light spilled onto white is nothing, and what actually says "there is a
 * surface down there" is the dark the object puts on it. Normal blending and
 * the deep ink step turn one into the other, and the shadow is carried harder
 * than the glow because a shadow at a glow's strength is invisible.
 */
export default function LightPool({
  position = [0, 0, 0],
  size = 8,
  color = '#ffffff',
  intensity = 0.35,
  falloff = 2.6,
}: LightPoolProps) {
  const mesh = useRef<Mesh>(null);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: vertex,
        fragmentShader: fragment,
        transparent: true,
        blending: mark.additive ? AdditiveBlending : NormalBlending,
        premultipliedAlpha: true,
        depthWrite: false,
        uniforms: {
          uColor: { value: new Color(color) },
          uIntensity: { value: intensity * (mark.additive ? 1 : 1.5) },
          uFalloff: { value: falloff },
        },
      }),
    [color, intensity, falloff],
  );

  useEffect(() => () => material.dispose(), [material]);

  return (
    <mesh
      ref={mesh}
      material={material}
      position={position}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <planeGeometry args={[size, size]} />
    </mesh>
  );
}
