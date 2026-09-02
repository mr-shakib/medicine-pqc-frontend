'use client';

import { useEffect, useRef } from 'react';

/**
 * Tracks the normalised pointer position (-1 -> 1 on both axes) in a ref so the
 * render loop can read it without re-rendering. Inert on touch devices.
 */
export function usePointerParallax(enabled = true) {
  const pointer = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!enabled) {
      pointer.current.x = 0;
      pointer.current.y = 0;
      return;
    }

    const onMove = (event: PointerEvent) => {
      pointer.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (event.clientY / window.innerHeight) * 2 - 1;
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [enabled]);

  return pointer;
}
