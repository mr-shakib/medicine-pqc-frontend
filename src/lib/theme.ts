import { DEFAULT_THEME, type Theme } from '@/lib/design/palette';
import { setPaletteTheme } from '@/lib/design/tokens';

export type { Theme };

/** Where the choice is kept between visits. */
export const THEME_STORAGE_KEY = 'medsecure-theme';
/** Set on the root element, and the only thing the CSS switches on. */
export const THEME_ATTRIBUTE = 'data-theme';

/**
 * The active theme, for both layers.
 *
 * The value is READ BACK off the root element rather than recomputed, because
 * something has already decided it: the blocking script in the document head
 * (see `themeScript`) resolves the stored choice before the first paint. If
 * this module resolved it again on import it would be a second source of
 * truth, and any disagreement between them shows up as a flash of the wrong
 * palette on every load.
 */
function readTheme(): Theme {
  if (typeof document === 'undefined') return DEFAULT_THEME;
  return document.documentElement.getAttribute(THEME_ATTRIBUTE) === 'dark'
    ? 'dark'
    : 'light';
}

let current: Theme = readTheme();

// The palette must be pointed at the right values before ANYTHING builds a
// material or reads a token, which on the client is the moment this module is
// first imported.
setPaletteTheme(current);

/** Class carrying the DOM colour crossfade, and how long it stays on. */
const THEME_SHIFT_CLASS = 'theme-shift';
export const THEME_SHIFT_MS = 340;
let shiftTimer = 0;

const listeners = new Set<() => void>();

export const subscribeTheme = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const getTheme = (): Theme => current;
/**
 * The server has no way to know the visitor's stored choice, so it renders the
 * default and the client corrects it. Returning anything else here would make
 * hydration disagree with the markup the blocking script has already fixed up.
 */
export const getServerTheme = (): Theme => DEFAULT_THEME;

export function setTheme(theme: Theme): void {
  if (theme === current) return;
  current = theme;

  // Order matters: the palette first, so a subscriber that rebuilds the 3D
  // scene on notification finds the tokens already pointing at the new values.
  setPaletteTheme(theme);

  const root = document.documentElement;
  // Crossfade the DOM's colours for the length of the swap, then stop, so the
  // page is not left carrying a global colour transition forever.
  root.classList.add(THEME_SHIFT_CLASS);
  window.clearTimeout(shiftTimer);
  shiftTimer = window.setTimeout(
    () => root.classList.remove(THEME_SHIFT_CLASS),
    THEME_SHIFT_MS,
  );

  root.setAttribute(THEME_ATTRIBUTE, theme);
  root.style.colorScheme = theme;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // Private mode, or storage disabled. The choice simply does not persist.
  }

  for (const listener of listeners) listener();
}

export const toggleTheme = (): void =>
  setTheme(current === 'dark' ? 'light' : 'dark');

/**
 * The blocking script, inlined into the document head.
 *
 * It has to run before the first paint and before any bundle: a theme applied
 * from a React effect arrives a frame or two after the page has already been
 * painted in the other one, which is the flash every themed site is judged on.
 * Deliberately does NOT consult `prefers-color-scheme` -- the piece defaults to
 * light for everyone, and only a choice the visitor actually made moves it.
 */
export const themeScript = `(function(){try{var t=localStorage.getItem(${JSON.stringify(
  THEME_STORAGE_KEY,
)});if(t!=="dark"&&t!=="light")t=${JSON.stringify(
  DEFAULT_THEME,
)};document.documentElement.setAttribute(${JSON.stringify(
  THEME_ATTRIBUTE,
)},t);document.documentElement.style.colorScheme=t;}catch(e){}})();`;
