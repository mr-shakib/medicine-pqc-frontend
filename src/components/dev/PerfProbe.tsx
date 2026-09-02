'use client';

import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';

export interface PerfStats {
  fps: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  programs: number;
}

/**
 * Reports live renderer statistics out of the canvas.
 *
 * Reads `gl.info`, which is the renderer's own accounting rather than an
 * estimate — draw calls and triangles are what was actually submitted this
 * frame, and the geometry/texture counts are what is resident on the GPU, so
 * this doubles as a leak check across remounts.
 *
 * Sampled at 4 Hz. Reporting per frame would re-render React 60 times a second
 * to display a number that cannot be read that fast anyway.
 */
export default function PerfProbe({
  onSample,
}: {
  onSample: (stats: PerfStats) => void;
}) {
  const gl = useThree((state) => state.gl);
  const frames = useRef(0);
  // Seeded on the first frame rather than at construction: reading the clock
  // during render is an impure call.
  const last = useRef(0);

  useFrame(() => {
    const now = performance.now();
    if (last.current === 0) {
      last.current = now;
      return;
    }

    frames.current++;
    const elapsed = now - last.current;

    if (elapsed >= 250) {
      onSample({
        fps: Math.round((frames.current / elapsed) * 1000),
        drawCalls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
        programs: gl.info.programs?.length ?? 0,
      });
      frames.current = 0;
      last.current = now;
    }
  });

  return null;
}
