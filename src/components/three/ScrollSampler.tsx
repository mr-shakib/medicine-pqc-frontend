'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { readScrollProgress, scrollStore } from '@/lib/scrollStore';
import { sceneAccent, sceneAt, progressToSection } from '@/lib/scenes';
import { updateLightRig } from '@/lib/lightRig';
import { damp, frameDelta } from '@/lib/math';

/*
  Two stages of smoothing, each with a short time constant.

  A single exponential smoother is continuous in POSITION but not in velocity:
  every wheel notch arrives as an instant step, and the smoothed value responds
  with a velocity spike that then decays -- the camera kicks on every notch.
  Passing the result through a second, identical stage makes the velocity
  itself continuous, so a notch becomes a swell rather than a kick, and the
  motion reads as inertia instead of steps.

  Each stage keeps this fraction of its distance after one second, which is a
  time constant of roughly 75ms; the pair together sit about 150ms behind the
  finger. That is the same overall delay a single-stage smoother would need to
  feel connected, with none of the kick.
*/
const STAGE_SMOOTHING = 2e-6;

/**
 * The single point where the scroll enters the render loop.
 *
 * Rendered as the FIRST leaf inside the canvas so its frame callback is
 * registered -- and therefore runs -- before every other one: React commits
 * layout effects in tree order, children before parents, so a leaf that comes
 * first in the tree subscribes first. Everything downstream then reads a
 * `scrollStore` that is already current for this frame.
 */
export default function ScrollSampler({
  reducedMotion,
}: {
  reducedMotion: boolean;
}) {
  const mid = useRef(0);
  const primed = useRef(false);

  useFrame((_, delta) => {
    const dt = frameDelta(delta);
    const progress = readScrollProgress();

    scrollStore.velocity = dt > 0 ? (progress - scrollStore.progress) / dt : 0;
    scrollStore.progress = progress;

    if (!primed.current || reducedMotion) {
      // First frame, or no smoothing wanted: land on the position outright.
      // A page restored mid-scroll must not fly in from the opening.
      mid.current = progress;
      scrollStore.smooth = progress;
      scrollStore.direct = progress;
      primed.current = true;
    } else {
      mid.current = damp(mid.current, progress, STAGE_SMOOTHING, dt);
      // The first stage is published as well: it has absorbed the notches but
      // not yet the second stage's delay. See `direct` on the store.
      scrollStore.direct = mid.current;
      scrollStore.smooth = damp(
        scrollStore.smooth,
        mid.current,
        STAGE_SMOOTHING,
        dt,
      );
    }

    // The DOM readout follows the raw position: the chapter rail and the
    // accent should answer the finger, not the lens.
    const scene = sceneAt(progress);
    if (scene !== scrollStore.scene) {
      scrollStore.scene = scene;
      document.documentElement.style.setProperty(
        '--scene-accent',
        sceneAccent(scene),
      );
    }
    scrollStore.sceneProgress = progressToSection(progress) - scene + 0.5;

    // The light pool follows the lens, like everything else in the world.
    updateLightRig(scrollStore.smooth);
  });

  return null;
}
