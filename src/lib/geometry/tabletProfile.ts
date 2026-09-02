import { LatheGeometry, Vector2 } from 'three';

/**
 * Procedural geometry for a biconvex pharmaceutical tablet.
 *
 * A tablet is a surface of revolution, so — like the capsule — it is lathed
 * from a single profile rather than assembled from primitives. The previous
 * approach (a cylinder with two flattened spheres pushed into its ends) leaves
 * visible seams exactly where the eye looks first: the shoulder where the face
 * meets the edge.
 *
 * The profile follows real tablet tooling:
 *
 *        ● pole
 *      ╱   cup — a shallow spherical cap
 *     │  ◜ fillet
 *     │  │ band — the straight cylindrical edge ("land")
 *     │  ◟ fillet
 *      ╲   cup
 *        ● pole
 *
 * The interesting part is the fillet. For the surface to shade without a crease
 * it must be tangent to BOTH the vertical band and the spherical cup, which
 * fixes its position rather than leaving it as a free parameter — see
 * `solveTabletProfile` for the derivation.
 */
export interface TabletOptions {
  /** Tablet radius. */
  radius: number;
  /** Height of the straight cylindrical edge. */
  bandHeight: number;
  /** Rise of each convex face above the band. */
  capHeight: number;
  /** Radius of the fillet between band and face. */
  bevel: number;
  /** Segments along each cup arc. */
  capSegments: number;
  /** Segments around each fillet. */
  filletSegments: number;
  /** Segments along the band. */
  bandSegments: number;
  /** Segments around the axis of revolution. */
  radialSegments: number;
}

export const DEFAULT_TABLET: TabletOptions = {
  radius: 0.62,
  bandHeight: 0.1,
  capHeight: 0.13,
  bevel: 0.03,
  capSegments: 10,
  filletSegments: 4,
  bandSegments: 1,
  radialSegments: 40,
};

export interface TabletSolution {
  /** Radius of the sphere the convex face is a cap of. */
  cupRadius: number;
  /** Centre height of that sphere, relative to the tablet's mid-plane. */
  cupCentreY: number;
  /** Half the band height — where band and fillet meet. */
  halfBand: number;
  /** Total thickness, pole to pole. */
  thickness: number;
}

/**
 * Solve the cup sphere that makes the fillet tangent to both surfaces.
 *
 * The fillet centre sits at `radius - bevel` (distance `bevel` from the vertical
 * band) and must also be `cupRadius - bevel` from the cup centre. Writing both
 * constraints and eliminating the fillet's height gives a closed form for the
 * cup radius, so the caller specifies the dimensions a tablet is actually
 * specified by — diameter, band, cup depth — and tangency falls out.
 */
export function solveTabletProfile(options: TabletOptions): TabletSolution {
  const { radius, bandHeight, capHeight } = options;
  // The fillet cannot exceed the features it is blending.
  const bevel = Math.min(options.bevel, capHeight * 0.9, radius * 0.4);

  const halfBand = bandHeight / 2;

  //  2·Rs·(b − h) = b² − (R − b)² − h²
  const numerator =
    bevel * bevel - (radius - bevel) * (radius - bevel) - capHeight * capHeight;
  const denominator = 2 * (bevel - capHeight);
  const cupRadius = numerator / denominator;

  return {
    cupRadius,
    cupCentreY: halfBand + capHeight - cupRadius,
    halfBand,
    thickness: bandHeight + capHeight * 2,
  };
}

/**
 * Build the lathe profile, running from the top pole, out over the face, around
 * the fillet, down the band, and back up to the bottom pole.
 */
export function createTabletProfile(options: TabletOptions): Vector2[] {
  const { radius, capSegments, filletSegments, bandSegments } = options;
  const bevel = Math.min(options.bevel, options.capHeight * 0.9, radius * 0.4);
  const { cupRadius, cupCentreY, halfBand } = solveTabletProfile(options);

  const filletCentre = new Vector2(radius - bevel, halfBand);

  // Where the fillet touches the cup: along the line from cup centre through
  // the fillet centre, at the cup's own radius.
  const toFillet = new Vector2(
    filletCentre.x - 0,
    filletCentre.y - cupCentreY,
  );
  const toFilletLength = toFillet.length();
  const cupTouch = new Vector2(
    (toFillet.x / toFilletLength) * cupRadius,
    cupCentreY + (toFillet.y / toFilletLength) * cupRadius,
  );

  const cupTouchAngle = Math.atan2(cupTouch.y - cupCentreY, cupTouch.x);
  const filletTouchAngle = Math.atan2(
    cupTouch.y - filletCentre.y,
    cupTouch.x - filletCentre.x,
  );

  const points: Vector2[] = [];

  /** One quadrant: pole -> cup -> fillet -> band edge, at the given sign. */
  const addHalf = (sign: 1 | -1, fromPole: boolean) => {
    const cup: Vector2[] = [];
    for (let i = 0; i <= capSegments; i++) {
      const angle =
        Math.PI / 2 + (cupTouchAngle - Math.PI / 2) * (i / capSegments);
      cup.push(
        new Vector2(
          cupRadius * Math.cos(angle),
          sign * (cupCentreY + cupRadius * Math.sin(angle)),
        ),
      );
    }

    const fillet: Vector2[] = [];
    for (let i = 1; i <= filletSegments; i++) {
      const angle = filletTouchAngle * (1 - i / filletSegments);
      fillet.push(
        new Vector2(
          filletCentre.x + bevel * Math.cos(angle),
          sign * (filletCentre.y + bevel * Math.sin(angle)),
        ),
      );
    }

    const segment = [...cup, ...fillet];
    points.push(...(fromPole ? segment : segment.reverse()));
  };

  // Top: pole down to the band.
  addHalf(1, true);

  // Band — the straight cylindrical edge between the two fillets.
  for (let i = 1; i < bandSegments; i++) {
    points.push(
      new Vector2(radius, halfBand - options.bandHeight * (i / bandSegments)),
    );
  }

  // Bottom: band back up to the pole.
  addHalf(-1, false);

  return points;
}

/**
 * Planar top-down UVs.
 *
 * A lathe's default UVs run around the axis, which is a cylindrical mapping —
 * useless for a face marking, which needs to be projected onto the face the way
 * a punch stamps it. Projecting from XZ puts the marking square on both faces
 * and lets it fade out naturally around the band.
 */
function applyPlanarUVs(geometry: LatheGeometry, radius: number): void {
  const position = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  const span = radius * 2;

  for (let i = 0; i < position.count; i++) {
    /*
      A straight XZ projection, which is upright on the upper face given the
      relief map is uploaded with `flipY` disabled.

      The lower face necessarily reads mirrored: one planar projection cannot be
      upright from both sides. That matches real tooling closely enough — a
      tablet is punched with different faces on each side — and the alternative,
      splitting the mesh into two material groups, would double the draw calls
      on an object whose whole point is that it is one.
    */
    uv.setXY(
      i,
      position.getX(i) / span + 0.5,
      position.getZ(i) / span + 0.5,
    );
  }
  uv.needsUpdate = true;
}

export function createTabletGeometry(options: TabletOptions): LatheGeometry {
  const geometry = new LatheGeometry(
    createTabletProfile(options),
    options.radialSegments,
  );
  applyPlanarUVs(geometry, options.radius);
  geometry.computeBoundingSphere();
  return geometry;
}

/** Segment counts per quality tier. */
export const TABLET_TESSELLATION = {
  low: { capSegments: 6, filletSegments: 3, bandSegments: 1, radialSegments: 24 },
  medium: { capSegments: 10, filletSegments: 4, bandSegments: 1, radialSegments: 40 },
  high: { capSegments: 14, filletSegments: 6, bandSegments: 2, radialSegments: 64 },
} as const;
