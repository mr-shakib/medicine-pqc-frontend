'use client';

import { useRef } from 'react';
import { Color, type DirectionalLight } from 'three';
import { useFrame } from '@react-three/fiber';
import { accent, light, neutral } from '@/lib/design/tokens';
import { scrollStore } from '@/lib/scrollStore';
import { SCENES, SCENE_COUNT, progressToSection } from '@/lib/scenes';
import { clamp } from '@/lib/math';

/** Pre-resolved colours -- the frame loop must never allocate. */
const SCENE_ACCENTS = SCENES.map((s) => new Color(accent[s.accent].base));

const currentRim = new Color(accent.pharma.base);
const targetColor = new Color();
const upperColor = new Color();

export interface LightingProps {
  /** Shadow casting is a high-tier privilege. */
  shadows: boolean;
}

/**
 * Studio rig.
 *
 * This is lit like a product photograph, not like a game level:
 *
 *   KEY    a large warm source, high and camera-right, doing most of the work
 *   FILL   a cool source opposite at roughly a quarter power, opening the
 *          shadows without flattening them. Warm key against cool fill is what
 *          gives a dark product shot its sense of volume.
 *   RIM    behind and above, carrying the current chapter's accent. This is the
 *          light that separates the subject from the ground.
 *   BOUNCE a dim upward fill standing in for light returning off the chamber
 *          floor, so undersides are never crushed to black.
 *
 * The whole rig travels with the scroll position, so eight stations spread over
 * 360 world units stay lit by four lights instead of thirty-two.
 */
export default function Lighting({ shadows }: LightingProps) {
  const rim = useRef<DirectionalLight>(null);

  useFrame(() => {
    // Blend the accent between the two nearest chapters.
    const section = clamp(
      progressToSection(scrollStore.smooth),
      0,
      SCENE_COUNT - 1,
    );
    const lower = Math.floor(section);
    const upper = Math.min(lower + 1, SCENE_COUNT - 1);
    const mix = section - lower;

    targetColor.copy(SCENE_ACCENTS[lower]);
    upperColor.copy(SCENE_ACCENTS[upper]);
    targetColor.lerp(upperColor, mix);
    currentRim.lerp(targetColor, 0.05);

    if (rim.current) rim.current.color.copy(currentRim);
  });

  return (
    <>
      {/* KEY — large, warm, high and camera-right. */}
      <directionalLight
        position={[5.5, 8, 6]}
        intensity={2.1}
        color={light.key}
        castShadow={shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={1}
        shadow-camera-far={45}
        shadow-bias={-0.0008}
        shadow-normalBias={0.02}
      />

      {/* FILL — cool, opposite the key, roughly a quarter of its power. */}
      <directionalLight
        position={[-7, 2.5, 4]}
        intensity={0.52}
        color={light.fill}
      />

      {/* RIM — behind and above, carries the chapter accent. */}
      <directionalLight
        ref={rim}
        position={[-3, 5, -9]}
        intensity={1.5}
        color={accent.pharma.base}
      />

      {/*
        BOUNCE — dim upward return from the imagined chamber floor, and the
        scene's ambient floor in one light.

        Four sources total, and that ceiling is a performance decision as much
        as a lighting one: every light is evaluated by every material on every
        pixel it covers, so on a fragment-bound scene carrying a dozen physical
        surfaces the light count multiplies the most expensive thing in the
        frame. A separate ambient term was doing what this already does with
        no directionality, and the close accent light was doing what the rim
        does with less reach.
      */}
      <hemisphereLight
        args={[neutral.n06, light.bounce, 0.85]}
        position={[0, -4, 0]}
      />

    </>
  );
}
