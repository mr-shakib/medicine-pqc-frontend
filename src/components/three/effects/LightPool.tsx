'use client';

import { useEffect, useMemo, useRef } from 'react';
import { AdditiveBlending, Color, ShaderMaterial, type Mesh } from 'three';

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
    gl_FragColor = vec4(uColor * pool * uIntensity, 1.0);
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
 * A soft pool of light beneath a subject — the plinth glow of a product shot.
 *
 * A deliberately cheap stand-in for a reflective floor. A true reflection needs
 * its own render pass of the whole scene, which for a soft, heavily blurred
 * highlight under an object is an enormous amount of work to arrive at
 * something the eye reads as "there is a surface down there". One additive
 * quad with a radial falloff reads the same and costs one draw.
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
        blending: AdditiveBlending,
        depthWrite: false,
        uniforms: {
          uColor: { value: new Color(color) },
          uIntensity: { value: intensity },
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
