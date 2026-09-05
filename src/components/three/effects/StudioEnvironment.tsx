'use client';

import { Environment, Lightformer } from '@react-three/drei';
import { accent, light, mark, neutral } from '@/lib/design/tokens';
import type { QualityBudget } from '@/lib/quality';

export interface StudioEnvironmentProps {
  budget: QualityBudget;
}

/**
 * The reflection environment — built procedurally, never downloaded.
 *
 * This is the single most important element in making glass and metal read as
 * premium. Specular materials show you a reflection of their surroundings; in
 * an empty dark scene there is nothing to reflect, so glass renders as dark
 * plastic and aluminium renders as flat grey no matter how the roughness is
 * tuned.
 *
 * Rather than load an HDR (an external asset, and a large one), this bakes a
 * small cubemap from emissive planes arranged like a real photographic studio:
 * a broad overhead softbox, two tall side strips for the vertical edge
 * highlights that define a cylinder, and a dim warm bounce behind. It is
 * rendered ONCE (`frames={1}`) into a 128-256px cubemap, so the runtime cost is
 * a single offscreen pass at startup and nothing thereafter.
 */
export default function StudioEnvironment({ budget }: StudioEnvironmentProps) {
  const resolution = budget.tier === 'high' ? 256 : 128;

  return (
    <Environment resolution={resolution} frames={1} background={false}>
      {/* Overhead softbox — the dominant reflection, broad and soft. */}
      <Lightformer
        form="rect"
        intensity={1.9}
        color={light.key}
        position={[0, 6, 1]}
        rotation={[Math.PI / 2, 0, 0]}
        scale={[12, 8, 1]}
      />

      {/* Tall side strips. These produce the vertical specular lines that make
          a cylinder read as a cylinder — the classic bottle-photography trick. */}
      <Lightformer
        form="rect"
        intensity={1.5}
        color={light.fill}
        position={[-5, 0.5, 2]}
        rotation={[0, Math.PI / 2, 0]}
        scale={[6, 5, 1]}
      />
      <Lightformer
        form="rect"
        intensity={1.1}
        color={light.key}
        position={[5, 0.5, 2]}
        rotation={[0, -Math.PI / 2, 0]}
        scale={[5, 5, 1]}
      />

      {/* Warm bounce behind the subject, giving edges a faint amber lift. */}
      <Lightformer
        form="ring"
        intensity={mark.additive ? 0.7 : 0.35}
        color={accent.pharma.light}
        position={[0, 1, -7]}
        scale={[7, 7, 1]}
      />

      {/*
        The surround reflections fall off to.

        Darker than the ground in BOTH palettes, and on the light one that is
        the whole trick: a white cyclorama shoot puts black flags either side
        of clear glass, because an edge is only visible when there is something
        dark for it to reflect. Take them away and the glass reads as a faint
        smudge of the paper behind it -- which is exactly what happened when
        this followed the ramp to `n02` and turned pale.
      */}
      <mesh scale={40}>
        <sphereGeometry args={[1, 16, 12]} />
        <meshBasicMaterial color={mark.additive ? neutral.n02 : '#6E7885'} side={1} />
      </mesh>
    </Environment>
  );
}
