import type { BufferGeometry, Texture } from 'three';

/**
 * Process-wide cache for procedural geometry and runtime-generated textures.
 *
 * Every object in this piece builds itself from scratch — lathed profiles,
 * canvas-drawn relief maps and labels. That is cheap once and ruinous nine
 * times: the capsule appears in seven chapters, the tablet in seven, the vial
 * in six, and each chapter was rebuilding all of it on mount. Mounting happens
 * mid-scroll, so the work landed as a stall exactly when the page was moving.
 * Chapter 05, which mounts all three objects at once, was blocking for most of
 * a second.
 *
 * Keys encode every parameter that affects the result, so a chapter asking for
 * a capsule of a given size and tessellation gets the one that already exists.
 *
 * Cached resources are deliberately NOT disposed when a component unmounts —
 * they are shared, and the whole point is that they outlive any one chapter.
 * The set is small and bounded by the handful of parameter combinations the
 * piece actually uses; the cap below exists only for the development
 * inspectors, whose sliders can generate a new combination per frame.
 */

type Disposable = { dispose: () => void };

const store = new Map<string, Disposable>();

/** Beyond this, the oldest entry is disposed. Sized well above real usage. */
const MAX_ENTRIES = 64;

export function cachedResource<T extends Disposable>(
  key: string,
  create: () => T,
): T {
  const existing = store.get(key);
  if (existing) {
    // Refresh recency: re-inserting moves it to the end of the iteration order.
    store.delete(key);
    store.set(key, existing);
    return existing as T;
  }

  const created = create();
  store.set(key, created);

  if (store.size > MAX_ENTRIES) {
    const oldestKey = store.keys().next().value;
    if (oldestKey !== undefined) {
      const oldest = store.get(oldestKey);
      store.delete(oldestKey);
      oldest?.dispose();
    }
  }

  return created;
}

export const cachedGeometry = <T extends BufferGeometry>(
  key: string,
  create: () => T,
): T => cachedResource(key, create);

export const cachedTexture = (key: string, create: () => Texture): Texture =>
  cachedResource(key, create);

/** Test and inspector helper. */
export function clearResourceCache(): void {
  store.forEach((entry) => entry.dispose());
  store.clear();
}

export const resourceCacheSize = (): number => store.size;
