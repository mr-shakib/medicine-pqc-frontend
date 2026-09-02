'use client';

import { useEffect, useState } from 'react';

export interface ViewportFlags {
  /** Portrait or narrow viewport -- drives camera framing and layout. */
  isMobile: boolean;
  /** Touch-first device -- disables pointer parallax and hover affordances. */
  isTouch: boolean;
  /** User has asked for reduced motion. */
  reducedMotion: boolean;
}

const QUERY_MOBILE = '(max-width: 767px), (max-aspect-ratio: 3/4)';
const QUERY_TOUCH = '(pointer: coarse)';
const QUERY_REDUCED = '(prefers-reduced-motion: reduce)';

/** Live media-query flags, updated on change (e.g. device rotation). */
export function useViewportFlags(): ViewportFlags {
  const [flags, setFlags] = useState<ViewportFlags>({
    isMobile: false,
    isTouch: false,
    reducedMotion: false,
  });

  useEffect(() => {
    const mobile = window.matchMedia(QUERY_MOBILE);
    const touch = window.matchMedia(QUERY_TOUCH);
    const reduced = window.matchMedia(QUERY_REDUCED);

    const update = () =>
      setFlags({
        isMobile: mobile.matches,
        isTouch: touch.matches,
        reducedMotion: reduced.matches,
      });

    update();
    mobile.addEventListener('change', update);
    touch.addEventListener('change', update);
    reduced.addEventListener('change', update);

    return () => {
      mobile.removeEventListener('change', update);
      touch.removeEventListener('change', update);
      reduced.removeEventListener('change', update);
    };
  }, []);

  return flags;
}
