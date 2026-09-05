'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { BackSide, Color, ShaderMaterial, SphereGeometry, type Mesh } from 'three';
import { backdropFragment, backdropVertex } from '@/shaders/backdrop';
import { accent, backdrop as ground } from '@/lib/design/tokens';
import { SCENES, SCENE_COUNT, progressToSection } from '@/lib/scenes';
import { scrollStore } from '@/lib/scrollStore';
import { clamp } from '@/lib/math';

/** Scratch -- never construct a Color in the frame loop. */
const targetAccent = new Color();
const upperAccent = new Color();

/**
 * The chamber.
 *
 * An inverted sphere locked to the camera, painted with the backdrop gradient.
 * Because it follows the camera it covers the entire 360-unit corridor with a
 * single 2-triangle-per-face draw, and because it writes no depth it never
 * interferes with anything in front of it.
 */
export default function Backdrop() {
  const mesh = useRef<Mesh>(null);

  /*
    Resolved on mount rather than at module scope. This component is rebuilt
    for each palette, so building the table here is what makes the accents
    follow -- a module-level array would hold the colours of whichever palette
    was active when the file was first imported.
  */
  const sceneAccents = useMemo(
    () => SCENES.map((scene) => new Color(accent[scene.accent].base)),
    [],
  );

  const geometry = useMemo(() => new SphereGeometry(1, 32, 24), []);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: backdropVertex,
        fragmentShader: backdropFragment,
        side: BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uHorizon: { value: new Color(ground.horizon) },
          uFloor: { value: new Color(ground.floor) },
          uCeiling: { value: new Color(ground.ceiling) },
          uAccent: { value: new Color(accent.pharma.base) },
          uAccentAmount: { value: ground.accentAmount },
          uAccentMultiply: { value: ground.accentMultiply ? 1 : 0 },
          uTime: { value: 0 },
        },
      }),
    [],
  );

  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  useFrame((state) => {
    if (!mesh.current) return;

    // Lock to the camera so the gradient is stable however far we have flown.
    mesh.current.position.copy(state.camera.position);

    // Reached through the mesh rather than the memoised handle: uniforms are
    // mutated every frame, which belongs to the object, not to render output.
    const uniforms = (mesh.current.material as ShaderMaterial).uniforms;
    uniforms.uTime.value = state.clock.elapsedTime;

    // Cross-fade the accent pool between the two nearest chapters.
    const section = clamp(
      progressToSection(scrollStore.smooth),
      0,
      SCENE_COUNT - 1,
    );
    const lower = Math.floor(section);
    const upper = Math.min(lower + 1, SCENE_COUNT - 1);

    targetAccent.copy(sceneAccents[lower]);
    upperAccent.copy(sceneAccents[upper]);
    targetAccent.lerp(upperAccent, section - lower);

    (uniforms.uAccent.value as Color).lerp(targetAccent, 0.04);
  });

  return (
    <mesh
      ref={mesh}
      geometry={geometry}
      material={material}
      scale={140}
      renderOrder={-1000}
      frustumCulled={false}
    />
  );
}
