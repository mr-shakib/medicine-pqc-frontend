'use client';

import { useCallback } from 'react';
import { scrollStore } from '@/lib/scrollStore';
import { sceneDistance, sceneLocalRaw } from '@/lib/scenes';
import { clamp, envelope } from '@/lib/math';

export interface SceneProgress {
  /** Local progress through this scene, 0 -> 1, clamped. */
  local: () => number;
  /** Local progress, unclamped, so a scene can react to being approached. */
  localRaw: () => number;
  /** 0 -> 1 -> 0 fade envelope for entering and leaving. */
  fade: (fadeAmount?: number) => number;
  /** Signed distance from this scene, measured in sections. */
  distance: () => number;
  /** True when the scene is within `margin` sections of the viewport. */
  nearby: (margin?: number) => boolean;
}

/**
 * Remaps global scroll progress into a scene-local 0 -> 1.
 *
 * Returns getters rather than values: these are called inside `useFrame`, so
 * they must read the live store without triggering a re-render.
 */
export function useSceneProgress(index: number): SceneProgress {
  const localRaw = useCallback(
    () => sceneLocalRaw(scrollStore.smooth, index),
    [index],
  );

  const local = useCallback(() => clamp(localRaw()), [localRaw]);

  const fade = useCallback(
    (fadeAmount = 0.25) => envelope(localRaw(), 0, 1, fadeAmount),
    [localRaw],
  );

  const distance = useCallback(
    () => sceneDistance(scrollStore.smooth, index),
    [index],
  );

  const nearby = useCallback(
    (margin = 1) => Math.abs(distance()) < margin,
    [distance],
  );

  return { local, localRaw, fade, distance, nearby };
}
