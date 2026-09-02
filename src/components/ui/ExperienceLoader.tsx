'use client';

import dynamic from 'next/dynamic';
import { useSyncExternalStore } from 'react';
import StaticFallback from '@/components/ui/StaticFallback';
import { supportsWebGL } from '@/lib/quality';

/**
 * The 3D layer is client-only: it touches `window` at module scope (GSAP plugin
 * registration) and has no meaningful server rendering.
 */
const ThreeExperience = dynamic(
  () => import('@/components/three/ThreeExperience'),
  { ssr: false },
);

/**
 * Capability detection is expensive (it creates a probe canvas) and must run
 * only once, so the result is memoised at module scope. `useSyncExternalStore`
 * requires a stable snapshot -- returning a fresh probe each call would loop.
 */
let webglSupport: boolean | undefined;
const getClientSnapshot = (): boolean => {
  webglSupport ??= supportsWebGL();
  return webglSupport;
};
const getServerSnapshot = (): boolean => false;
const subscribe = (): (() => void) => () => {};

/**
 * Decides between the WebGL experience and the static fallback.
 *
 * The fallback paints underneath either way, so there is never a flash of empty
 * void while the canvas boots.
 */
export default function ExperienceLoader() {
  const webgl = useSyncExternalStore(
    subscribe,
    getClientSnapshot,
    getServerSnapshot,
  );

  return (
    <>
      <StaticFallback />
      {webgl ? <ThreeExperience /> : null}
    </>
  );
}
