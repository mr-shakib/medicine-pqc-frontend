'use client';

import { useEffect, useState } from 'react';
import { scrollStore } from '@/lib/scrollStore';

/**
 * Low-frequency React state for the current scene index.
 *
 * Deliberately polled on an animation frame rather than driven by the scroll
 * handler: this fires a re-render only when the integer index actually changes,
 * which happens 8 times across the whole page.
 */
export function useActiveScene(): number {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let frame = 0;
    let last = -1;

    const tick = () => {
      if (scrollStore.scene !== last) {
        last = scrollStore.scene;
        setIndex(last);
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return index;
}
