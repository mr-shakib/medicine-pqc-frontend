export type QualityTier = 'low' | 'medium' | 'high';

export interface QualityBudget {
  tier: QualityTier;
  /** [min, max] device pixel ratio handed to the renderer. */
  dpr: [number, number];
  /** Instance count for large procedural fields. */
  particles: number;
  /** Subdivision level for procedural geometry. */
  detail: number;
  /** Whether the post-processing stack may run. */
  postProcessing: boolean;
  /** Whether expensive transmission/refraction materials may be used. */
  transmission: boolean;
  /** Whether a shadow-casting light is permitted. */
  shadows: boolean;
  /** MSAA sample count. */
  samples: number;
}

export const BUDGETS: Record<QualityTier, QualityBudget> = {
  low: {
    tier: 'low',
    dpr: [1, 1],
    particles: 1200,
    detail: 0,
    postProcessing: false,
    transmission: false,
    shadows: false,
    samples: 0,
  },
  medium: {
    tier: 'medium',
    dpr: [1, 1.5],
    particles: 4000,
    detail: 1,
    postProcessing: true,
    transmission: false,
    shadows: false,
    samples: 0,
  },
  high: {
    tier: 'high',
    /*
      Capped at 1.25.

      On a high-DPI display, 2.0 means four times the fragments of 1.0 — and
      this piece is fragment-bound, not vertex-bound: dark, soft, physically
      shaded surfaces over a full screen, with no fine detail or small text in
      the canvas to resolve. Against 2.0 that is a 61% cut in fragments for a
      difference the content cannot show.

      It is a fixed ceiling rather than an adaptive one on purpose. Scaling
      resolution during scroll is cheaper still, and it makes the frame
      visibly pop every time it changes.
    */
    dpr: [1, 1.25],
    particles: 6000,
    detail: 2,
    postProcessing: true,
    /*
      Off, on every tier.

      A transmissive material makes the renderer draw the WHOLE SCENE again
      into a backbuffer so the surface has something to refract. The vial has
      transmissive glass, so every chapter containing one paid a second full
      render — and during a chapter transition, with two vials mounted, it paid
      a third. That is the single most expensive thing in the piece and it
      bought a refraction visible only on close inspection of one object; the
      non-transmissive glass keeps the silhouette, the edge and the specular,
      which is what actually reads as glass.
    */
    transmission: false,
    /*
      Off. The objects float in an unlit void with no surface to receive a
      shadow, so the shadow map was rendering every frame to be sampled by
      almost nothing.
    */
    shadows: false,
    samples: 4,
  },
};

/**
 * Best-effort device tiering, run once on the client. Deliberately conservative:
 * drei's PerformanceMonitor adjusts DPR live, so a wrong guess self-corrects.
 */
export function detectQualityTier(): QualityTier {
  if (typeof window === 'undefined') return 'medium';

  const cores = navigator.hardwareConcurrency ?? 4;
  const memory =
    (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const smallViewport = Math.min(window.innerWidth, window.innerHeight) < 700;

  if (coarsePointer && (cores <= 4 || memory <= 3)) return 'low';
  if (coarsePointer || smallViewport || cores <= 4 || memory <= 4) {
    return 'medium';
  }
  if (cores >= 8 && memory >= 8) return 'high';
  return 'medium';
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function supportsWebGL(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      canvas.getContext('webgl2') ?? canvas.getContext('webgl'),
    );
  } catch {
    return false;
  }
}
