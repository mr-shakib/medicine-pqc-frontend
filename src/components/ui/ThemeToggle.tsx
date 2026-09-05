'use client';

import { useSyncExternalStore } from 'react';
import {
  getServerTheme,
  getTheme,
  subscribeTheme,
  toggleTheme,
} from '@/lib/theme';

/**
 * Switches the piece between its two palettes.
 *
 * Deliberately a single button rather than a segmented light/dark control:
 * there are two states, the current one is visible in every pixel of the page
 * behind it, and a second permanently-dim segment would be one more piece of
 * chrome in a header that is trying to disappear.
 *
 * The glyph shows what the page IS, not what the button does, and the
 * accessible name says what it does -- which is the pairing that stops the
 * usual "does the sun mean I am in light mode or that I will be" confusion.
 */
export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeTheme, getTheme, getServerTheme);
  const dark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={dark ? 'Switch to light theme' : 'Switch to dark theme'}
      className="pointer-events-auto -m-2 rounded-sm p-2 text-n09 transition-colors duration-300 hover:text-n12"
    >
      <svg
        viewBox="0 0 16 16"
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinecap="round"
        aria-hidden="true"
        className="block"
      >
        {dark ? (
          // A crescent: the page is dark.
          <path d="M13 9.6A5.6 5.6 0 0 1 6.4 3a5.6 5.6 0 1 0 6.6 6.6Z" />
        ) : (
          // A sun: the page is light.
          <>
            <circle cx="8" cy="8" r="3.1" />
            <path d="M8 1.4v1.5M8 13.1v1.5M14.6 8h-1.5M2.9 8H1.4M12.66 3.34l-1.06 1.06M4.4 11.6l-1.06 1.06M12.66 12.66 11.6 11.6M4.4 4.4 3.34 3.34" />
          </>
        )}
      </svg>
    </button>
  );
}
