import { clamp } from '@/lib/math';

/**
 * Non-reactive, mutable scroll state.
 *
 * This is deliberately NOT React state. `ScrollController` measures the spine
 * into it; `ScrollSampler` reads the scroll position into it once per frame;
 * everything in the render loop reads it inside `useFrame`. Scrolling the page
 * therefore triggers zero React re-renders -- only WebGL draw calls.
 */
export interface ScrollState {
  /** Raw scroll progress across the whole spine, 0 -> 1. */
  progress: number;
  /** Smoothed `progress`, written once per frame by `ScrollSampler`. */
  smooth: number;
  /**
   * `progress` through ONE stage of smoothing instead of two -- roughly half
   * the delay behind the finger.
   *
   * `smooth` is the right channel for the camera: two stages make its velocity
   * continuous, so a wheel notch arrives as a swell rather than a kick, and
   * the ~150ms it costs reads as the weight of a lens. It is the wrong channel
   * for a subject the scroll manipulates DIRECTLY -- the team registry's
   * turntable is under the viewer's finger, not being flown past, and at 150ms
   * a small rotation answering that late reads as lag rather than as inertia.
   * One stage still absorbs the notches; it just answers sooner.
   */
  direct: number;
  /** Signed progress delta per second; useful for velocity-driven effects. */
  velocity: number;
  /** Index of the scene the viewport is currently centred on. */
  scene: number;
  /** Progress within the current scene, 0 -> 1. */
  sceneProgress: number;
  /** True once the scene has been compiled and the first frame drawn. */
  ready: boolean;
  /** Document offset of the top of the scroll spine, in pixels. */
  spineTop: number;
  /** Scrollable length of the spine, in pixels: its height less one viewport. */
  spineSpan: number;
}

export const scrollStore: ScrollState = {
  progress: 0,
  smooth: 0,
  direct: 0,
  velocity: 0,
  scene: 0,
  sceneProgress: 0,
  ready: false,
  spineTop: 0,
  spineSpan: 0,
};

/** Reset between hot reloads so stale values never leak into a fresh mount. */
export function resetScrollStore(): void {
  scrollStore.progress = 0;
  scrollStore.smooth = 0;
  scrollStore.direct = 0;
  scrollStore.velocity = 0;
  scrollStore.scene = 0;
  scrollStore.sceneProgress = 0;
  scrollStore.ready = false;
  scrollStore.spineTop = 0;
  scrollStore.spineSpan = 0;
}

/**
 * The live scroll progress, straight from the document.
 *
 * Read inside the frame loop rather than from a scroll event so the value the
 * frame renders is the position the browser is about to paint -- there is no
 * event-to-frame latency and nothing to fall out of step with.
 */
export function readScrollProgress(): number {
  const span = scrollStore.spineSpan;
  if (span <= 0) return 0;
  return clamp((window.scrollY - scrollStore.spineTop) / span);
}
