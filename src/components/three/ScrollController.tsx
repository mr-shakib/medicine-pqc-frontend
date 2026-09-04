'use client';

import { useIsomorphicLayoutEffect } from '@/hooks/useIsomorphicLayoutEffect';
import { scrollStore, resetScrollStore } from '@/lib/scrollStore';

/**
 * Measures the scroll spine into the store, and keeps the measurement current.
 *
 * That is all it does. The scroll POSITION is not read here -- it is read once
 * per frame, inside the render loop, by `ScrollSampler` -- so there is no
 * scroll-event plumbing, no library ticker to fall out of step with the frame,
 * and native scrolling is left entirely to the browser. On touch devices in
 * particular, anything that intercepts the gesture to drive scroll itself
 * changes the feel of the inertia; this leaves it alone.
 *
 * Renders nothing.
 */
export default function ScrollController() {
  useIsomorphicLayoutEffect(() => {
    resetScrollStore();

    // Anchor to the scroll spine, NOT the document: anything after it (the
    // closing section, the footer) must not compress the progress range, or
    // every scene would drift out of alignment with its camera keyframe.
    const spine = document.querySelector<HTMLElement>('[data-scroll-spine]');
    if (!spine) return;

    const coarse = window.matchMedia('(pointer: coarse)').matches;
    let width = window.innerWidth;

    const measure = () => {
      const rect = spine.getBoundingClientRect();
      scrollStore.spineTop = rect.top + window.scrollY;
      scrollStore.spineSpan = Math.max(spine.offsetHeight - window.innerHeight, 1);
    };

    measure();

    // Real layout changes -- orientation, a font swap, a late mount below.
    const observer = new ResizeObserver(measure);
    observer.observe(spine);

    let timer = 0;
    const onResize = () => {
      /*
        On touch devices the address bar collapsing fires `resize` with no
        change in width. The spine is sized in `vh`, which does not move with
        the bar, so re-measuring would only shift the mapping by the bar's
        height every time it toggles.
      */
      if (coarse && window.innerWidth === width) return;
      width = window.innerWidth;
      window.clearTimeout(timer);
      timer = window.setTimeout(measure, 120);
    };
    window.addEventListener('resize', onResize);

    // Content below the fold settles after hydration; measure once more then.
    const settle = window.setTimeout(measure, 300);

    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(settle);
      window.removeEventListener('resize', onResize);
      observer.disconnect();
    };
  }, []);

  return null;
}
