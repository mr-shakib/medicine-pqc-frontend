'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { readScrollProgress, scrollStore } from '@/lib/scrollStore';
import { dossierStore } from '@/lib/dossierStore';
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
  /*
    Local rather than compared against the store, so that a REBUILD forces the
    accent to be written again. The scene index has not changed when the theme
    swaps, but every accent hex behind it has, and a comparison against the
    store would leave the page carrying the other palette's accent until the
    reader happened to scroll into the next chapter.
  */
  const lastScene = useRef(-1);

  useFrame((_, delta) => {
    /*
      An open dossier holds the world where it is.

      The panel swallows wheel and touch so the page should not move at all
      while a record is up -- but "should not" is not a guarantee. A keyboard,
      a trackpad gesture the compositor started before the listener ran, a
      browser restoring position: any of them would fly the camera out of the
      chapter the open panel is describing. This makes it impossible rather
      than unlikely. The dossier puts the scroll back where it found it on the
      way out, so there is nothing to catch up to when this resumes.
    */
    if (dossierStore.target === 1) return;

    const dt = frameDelta(delta);
    const progress = readScrollProgress();

    scrollStore.velocity = dt > 0 ? (progress - scrollStore.progress) / dt : 0;
    scrollStore.progress = progress;

    if (!primed.current || reducedMotion || scrollStore.resync) {
      // First frame, a jump asking to be landed on, or no smoothing wanted:
      // take the position outright. A page restored mid-scroll must not fly in
      // from the opening, and neither must a link into a chapter.
      scrollStore.resync = false;
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
    if (scene !== lastScene.current) {
      lastScene.current = scene;
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
