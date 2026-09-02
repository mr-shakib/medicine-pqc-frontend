import { LatheGeometry, Vector2 } from 'three';

/**
 * Procedural geometry for one half of a pharmaceutical capsule.
 *
 * Three's built-in `CapsuleGeometry` is a rounded cylinder — domed at BOTH
 * ends and solid. That is the wrong primitive here: two of them pulled apart
 * read as two sealed pills, not as a capsule that has been opened. A real half
 * is a thin shell, domed at one end and OPEN at the other, and the moment you
 * separate the halves the open rim and the hollow interior are the whole point.
 *
 * So each half is a surface of revolution generated from a 2D profile that runs
 * up the outside, around the rim, and back down the inside:
 *
 *        rim (bullnose)
 *         ╭──╮   ← y = length
 *         │  │
 *   outer │  │ inner
 *    wall │  │ wall
 *         │  │
 *        ╱    ╲
 *       │  ▁▁  │  ← inner dome
 *        ╲▁▁▁▁╱   ← outer dome, y = 0
 *
 * The profile is deliberately G1 continuous at every junction — the dome meets
 * the wall vertically, and the rim bullnose meets both walls vertically — so
 * the lathe's averaged vertex normals are correct everywhere and the surface
 * shades without a single seam or facet artefact. A hard 90° rim would need
 * split vertices to avoid smearing the normal across the corner; rounding it
 * is both cheaper and closer to how a real moulded capsule looks.
 */
export interface CapsuleHalfOptions {
  /** Outer radius of the shell. */
  radius: number;
  /** Total height of the half, from dome pole to rim. */
  length: number;
  /** Shell wall thickness. The rim is a bullnose of half this. */
  wallThickness: number;
  /** Segments along the dome's quarter-arc. */
  domeSegments: number;
  /** Segments along each straight wall. */
  wallSegments: number;
  /** Segments around the rim bullnose. */
  rimSegments: number;
  /** Segments around the axis of revolution. */
  radialSegments: number;
}

export const DEFAULT_CAPSULE_HALF: CapsuleHalfOptions = {
  radius: 0.3,
  length: 0.62,
  wallThickness: 0.024,
  domeSegments: 12,
  wallSegments: 3,
  rimSegments: 6,
  radialSegments: 40,
};

/**
 * Build the lathe profile for one half.
 *
 * Points run from the dome pole on the axis, up the outer surface, over the
 * rim, and back down the inner surface to the axis again — so the resulting
 * surface of revolution is closed and watertight at both poles.
 */
export function createCapsuleHalfProfile(
  options: CapsuleHalfOptions,
): Vector2[] {
  const {
    radius,
    wallThickness,
    domeSegments,
    wallSegments,
    rimSegments,
  } = options;

  // The wall must be long enough to exist at all once the dome and the rim
  // bullnose have taken their share, or the profile folds back on itself.
  const chamfer = wallThickness * 0.5;
  const length = Math.max(options.length, radius + chamfer * 2 + 0.01);

  const innerRadius = Math.max(radius - wallThickness, 0.001);
  const wallTop = length - chamfer;

  const points: Vector2[] = [];

  // 1 — Outer dome, from the pole up to the equator.
  for (let i = 0; i <= domeSegments; i++) {
    const theta = (i / domeSegments) * (Math.PI / 2);
    points.push(
      new Vector2(radius * Math.sin(theta), radius - radius * Math.cos(theta)),
    );
  }

  // 2 — Outer wall, straight up to where the rim begins.
  for (let i = 1; i <= wallSegments; i++) {
    points.push(
      new Vector2(radius, radius + (wallTop - radius) * (i / wallSegments)),
    );
  }

  // 3 — Rim bullnose: a half-round sweeping from the outer wall to the inner.
  for (let i = 1; i <= rimSegments; i++) {
    const angle = (i / rimSegments) * Math.PI;
    points.push(
      new Vector2(
        radius - chamfer + chamfer * Math.cos(angle),
        wallTop + chamfer * Math.sin(angle),
      ),
    );
  }

  // 4 — Inner wall, back down to the top of the inner dome.
  for (let i = 1; i <= wallSegments; i++) {
    points.push(
      new Vector2(
        innerRadius,
        wallTop + (radius - wallTop) * (i / wallSegments),
      ),
    );
  }

  // 5 — Inner dome, returning to the axis.
  for (let i = 1; i <= domeSegments; i++) {
    const theta = (1 - i / domeSegments) * (Math.PI / 2);
    points.push(
      new Vector2(
        innerRadius * Math.sin(theta),
        radius - innerRadius * Math.cos(theta),
      ),
    );
  }

  return points;
}

/** Build the lathe geometry for one half, domed at y = 0 and open at y = length. */
export function createCapsuleHalfGeometry(
  options: CapsuleHalfOptions,
): LatheGeometry {
  const geometry = new LatheGeometry(
    createCapsuleHalfProfile(options),
    options.radialSegments,
  );
  geometry.computeBoundingSphere();
  return geometry;
}

/** Segment counts per quality tier. */
export const CAPSULE_TESSELLATION = {
  low: { domeSegments: 8, wallSegments: 2, rimSegments: 4, radialSegments: 24 },
  medium: { domeSegments: 12, wallSegments: 3, rimSegments: 6, radialSegments: 40 },
  high: { domeSegments: 16, wallSegments: 4, rimSegments: 8, radialSegments: 56 },
} as const;
