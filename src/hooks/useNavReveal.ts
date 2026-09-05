'use client';

import { useEffect, useState } from 'react';

/** Scroll depth below which the bar is always shown. */
const ALWAYS_AT = 72;
/** Downward travel that hides it, and upward travel that brings it back. */
const HIDE_AFTER = 6;
const REVEAL_AFTER = 10;

/**
 * Hides the bar as the reader goes down the page and brings it back as they
 * come up.
 *
 * The home page is a scroll-driven story, and a header pinned across it is a
 * strip of interface sitting on top of the thing it is meant to be introducing
 * -- so it goes. It does not go for good, though: a bar that only ever returns
 * at the very top of a sixteen-viewport story would mean scrolling all the way
 * back to reach the theme switch, so it answers an upward gesture the way
 * every reader now expects one to be answered.
 *
 * Polled on an animation frame rather than driven by a scroll listener, for the
 * same reason the rest of this project polls: the state it produces is a single
 * boolean that flips a handful of times per page, and a listener that fires on
 * every scroll event would re-render React for all the frames in between.
 */
export function useNavReveal(enabled: boolean): boolean {
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    let frame = 0;
    let anchor = window.scrollY;
    let current = false;

    const tick = () => {
      const y = window.scrollY;
      const travelled = y - anchor;
      let next = current;

      if (y <= ALWAYS_AT) {
        next = false;
      } else if (travelled > HIDE_AFTER) {
        next = true;
      } else if (travelled < -REVEAL_AFTER) {
        next = false;
      }

      // The anchor only follows the scroll once it has committed to a
      // direction, so a slow drag accumulates instead of resetting every frame
      // and never reaching either threshold.
      if (travelled > HIDE_AFTER || travelled < -REVEAL_AFTER) anchor = y;

      if (next !== current) {
        current = next;
        setHidden(next);
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [enabled]);

  // A page that does not hide its bar ignores whatever the last one left here.
  return enabled ? !hidden : true;
}
