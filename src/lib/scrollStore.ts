/**
 * Non-reactive, mutable scroll state.
 *
 * This is deliberately NOT React state. `ScrollController` writes to it from a
 * GSAP ScrollTrigger; the render loop reads it inside `useFrame`. Scrolling the
 * page therefore triggers zero React re-renders -- only WebGL draw calls.
 */
export interface ScrollState {
  /** Raw scroll progress across the whole page, 0 -> 1. */
  progress: number;
  /** Exponentially damped `progress`, written once per frame by SceneManager. */
  smooth: number;
  /** Signed progress delta per second; useful for velocity-driven effects. */
  velocity: number;
  /** Index of the scene the viewport is currently centred on. */
  scene: number;
  /** Progress within the current scene, 0 -> 1. */
  sceneProgress: number;
  /** True once the first frame has been rendered. */
  ready: boolean;
}

export const scrollStore: ScrollState = {
  progress: 0,
  smooth: 0,
  velocity: 0,
  scene: 0,
  sceneProgress: 0,
  ready: false,
};

/** Reset between hot reloads so stale values never leak into a fresh mount. */
export function resetScrollStore(): void {
  scrollStore.progress = 0;
  scrollStore.smooth = 0;
  scrollStore.velocity = 0;
  scrollStore.scene = 0;
  scrollStore.sceneProgress = 0;
  scrollStore.ready = false;
}
