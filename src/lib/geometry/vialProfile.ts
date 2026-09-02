import { LatheGeometry, Vector2 } from 'three';

/**
 * Procedural geometry for an injectable vial.
 *
 * Four lathed profiles — glass, liquid, stopper, crimp cap — rather than a
 * stack of cylinders. A vial is a surface of revolution, and the features that
 * actually make one recognisable are all in its silhouette: the rounded heel,
 * the shoulder curve, the narrow neck and the pronounced lip flange. Butting
 * primitives together gets the proportions but loses every one of those
 * transitions to a seam.
 *
 * The glass is a genuine hollow shell — up the outside, over the lip, back down
 * the inside. That wall thickness is not pedantry: with a transmissive or
 * reflective material it is the only thing that reads as glass rather than as
 * tinted plastic, because the eye reads the doubled edge, not the face.
 */
export interface VialOptions {
  /** Outer radius of the body. */
  bodyRadius: number;
  /** Height of the straight body wall, from the base. */
  bodyHeight: number;
  /** Height of the shoulder curve above the body. */
  shoulderHeight: number;
  /** Outer radius of the neck. */
  neckRadius: number;
  /** Height of the straight neck. */
  neckHeight: number;
  /** Outer radius of the lip flange. */
  lipRadius: number;
  /** Height of the lip flange. */
  lipHeight: number;
  /** Glass wall thickness. */
  wallThickness: number;
  /** Radius of the rounded heel between base and wall. */
  heelRadius: number;

  /** Segments along the heel arc. */
  heelSegments: number;
  /** Segments along the shoulder curve. */
  shoulderSegments: number;
  /** Segments around the axis of revolution. */
  radialSegments: number;
}

export const DEFAULT_VIAL: VialOptions = {
  bodyRadius: 0.3,
  bodyHeight: 0.6,
  shoulderHeight: 0.15,
  neckRadius: 0.17,
  neckHeight: 0.1,
  lipRadius: 0.205,
  lipHeight: 0.06,
  wallThickness: 0.022,
  heelRadius: 0.05,
  heelSegments: 5,
  shoulderSegments: 10,
  radialSegments: 40,
};

/** Key heights derived from the options, shared by every part. */
export function vialMetrics(o: VialOptions) {
  const shoulderTop = o.bodyHeight + o.shoulderHeight;
  const neckTop = shoulderTop + o.neckHeight;
  const lipTop = neckTop + o.lipHeight;
  return {
    shoulderTop,
    neckTop,
    lipTop,
    /** Inner radii, i.e. the cavity the liquid occupies. */
    bodyInner: o.bodyRadius - o.wallThickness,
    neckInner: o.neckRadius - o.wallThickness,
    /** Interior floor height. */
    floor: o.wallThickness,
  };
}

/**
 * The shoulder blend.
 *
 * `smoothstep` on the radius against a linear rise gives zero radial gradient
 * at both ends, so the curve leaves the body wall vertically and meets the neck
 * vertically. That tangency is what stops the shoulder reading as a cone.
 */
function shoulderCurve(
  fromRadius: number,
  toRadius: number,
  fromY: number,
  toY: number,
  segments: number,
  out: Vector2[],
  skipFirst = true,
): void {
  for (let i = skipFirst ? 1 : 0; i <= segments; i++) {
    const u = i / segments;
    const eased = u * u * (3 - 2 * u);
    out.push(
      new Vector2(
        fromRadius + (toRadius - fromRadius) * eased,
        fromY + (toY - fromY) * u,
      ),
    );
  }
}

/** Quarter arc, used for the heel. */
function arc(
  centreX: number,
  centreY: number,
  radius: number,
  fromAngle: number,
  toAngle: number,
  segments: number,
  out: Vector2[],
  skipFirst = true,
): void {
  for (let i = skipFirst ? 1 : 0; i <= segments; i++) {
    const angle = fromAngle + (toAngle - fromAngle) * (i / segments);
    out.push(
      new Vector2(
        centreX + radius * Math.cos(angle),
        centreY + radius * Math.sin(angle),
      ),
    );
  }
}

/** The glass shell: base, heel, wall, shoulder, neck, lip, and back down inside. */
export function createVialGlassProfile(o: VialOptions): Vector2[] {
  const m = vialMetrics(o);
  const points: Vector2[] = [];
  const heel = Math.min(o.heelRadius, o.bodyRadius * 0.5);

  // Outer: base out to the heel.
  points.push(new Vector2(0, 0));
  points.push(new Vector2(o.bodyRadius - heel, 0));
  arc(o.bodyRadius - heel, heel, heel, -Math.PI / 2, 0, o.heelSegments, points);

  // Outer wall.
  points.push(new Vector2(o.bodyRadius, o.bodyHeight));

  // Shoulder and neck.
  shoulderCurve(
    o.bodyRadius, o.neckRadius,
    o.bodyHeight, m.shoulderTop,
    o.shoulderSegments, points,
  );
  points.push(new Vector2(o.neckRadius, m.neckTop));

  // Lip flange: flares out, runs up, then chamfers onto the sealing face.
  const chamfer = o.lipHeight * 0.22;
  points.push(new Vector2(o.lipRadius, m.neckTop + o.lipHeight * 0.34));
  points.push(new Vector2(o.lipRadius, m.lipTop - chamfer));
  points.push(new Vector2(o.lipRadius - chamfer, m.lipTop));

  // Sealing face, then back down the inside.
  points.push(new Vector2(m.neckInner, m.lipTop));
  points.push(new Vector2(m.neckInner, m.shoulderTop));
  shoulderCurve(
    m.neckInner, m.bodyInner,
    m.shoulderTop, o.bodyHeight,
    o.shoulderSegments, points,
  );

  // Inner wall down to the interior floor.
  const innerHeel = Math.max(heel - o.wallThickness, 0.005);
  points.push(new Vector2(m.bodyInner, m.floor + innerHeel));
  arc(
    m.bodyInner - innerHeel, m.floor + innerHeel, innerHeel,
    0, -Math.PI / 2, o.heelSegments, points,
  );
  points.push(new Vector2(0, m.floor));

  return points;
}

/**
 * The liquid.
 *
 * Inset from the glass wall by a small gap so there is real air between them.
 * Without that gap the two surfaces are coincident, and the vial renders as a
 * solid coloured cylinder rather than as liquid inside glass.
 *
 * Built at full height with its origin on the interior floor, so fill level is
 * a Y scale rather than a geometry rebuild.
 */
export function createVialLiquidProfile(o: VialOptions): Vector2[] {
  const m = vialMetrics(o);
  const gap = 0.006;
  const radius = m.bodyInner - gap;
  const height = o.bodyHeight - m.floor - gap;
  const heel = Math.max(o.heelRadius - o.wallThickness - gap, 0.004);
  const points: Vector2[] = [];

  points.push(new Vector2(0, 0));
  points.push(new Vector2(radius - heel, 0));
  arc(radius - heel, heel, heel, -Math.PI / 2, 0, o.heelSegments, points);
  points.push(new Vector2(radius, height));

  // Concave meniscus: liquid wets the glass, so it rides higher at the wall
  // than at the centre. A flat top instantly reads as a solid.
  const dip = radius * 0.16;
  const segments = 6;
  for (let i = 1; i <= segments; i++) {
    const u = i / segments;
    points.push(
      new Vector2(radius * (1 - u), height - dip * (u * u * (3 - 2 * u))),
    );
  }

  return points;
}

/** The rubber stopper: a plug that enters the neck under a seating flange. */
export function createVialStopperProfile(o: VialOptions): Vector2[] {
  const m = vialMetrics(o);
  const plugRadius = m.neckInner - 0.004;
  const plugHeight = o.neckHeight * 0.85;
  const flangeRadius = o.lipRadius - 0.004;
  const flangeHeight = o.lipHeight * 0.62;
  const fillet = 0.012;
  const points: Vector2[] = [];

  points.push(new Vector2(0, 0));
  points.push(new Vector2(plugRadius - fillet, 0));
  arc(plugRadius - fillet, fillet, fillet, -Math.PI / 2, 0, 3, points);
  points.push(new Vector2(plugRadius, plugHeight));
  points.push(new Vector2(flangeRadius, plugHeight));
  points.push(new Vector2(flangeRadius, plugHeight + flangeHeight - fillet));
  arc(
    flangeRadius - fillet, plugHeight + flangeHeight - fillet, fillet,
    0, Math.PI / 2, 3, points,
  );
  points.push(new Vector2(0, plugHeight + flangeHeight));

  return points;
}

/**
 * The aluminium crimp seal: a thin shell over the flange, open at the centre so
 * the stopper stays visible — the detail that identifies a crimped vial.
 */
export function createVialCapProfile(o: VialOptions): Vector2[] {
  const m = vialMetrics(o);
  const outer = o.lipRadius + 0.012;
  const hole = o.lipRadius * 0.62;
  const thickness = 0.01;
  const top = m.lipTop + o.lipHeight * 0.62 + thickness;
  const skirtBottom = m.neckTop - o.neckHeight * 0.45;
  const points: Vector2[] = [];

  points.push(new Vector2(hole, top));
  points.push(new Vector2(outer - thickness, top));
  arc(outer - thickness, top - thickness, thickness, Math.PI / 2, 0, 3, points);
  points.push(new Vector2(outer, skirtBottom + 0.02));
  // The crimp: the skirt tucks under the flange.
  points.push(new Vector2(outer - 0.022, skirtBottom));
  points.push(new Vector2(outer - 0.022 - thickness, skirtBottom + 0.004));
  points.push(new Vector2(outer - thickness * 2, skirtBottom + 0.028));
  points.push(new Vector2(outer - thickness * 2, top - thickness));
  points.push(new Vector2(hole, top - thickness));

  return points;
}

export function latheFrom(
  points: Vector2[],
  radialSegments: number,
): LatheGeometry {
  const geometry = new LatheGeometry(points, radialSegments);
  geometry.computeBoundingSphere();
  return geometry;
}

/** Segment counts per quality tier. */
export const VIAL_TESSELLATION = {
  low: { heelSegments: 3, shoulderSegments: 5, radialSegments: 24 },
  medium: { heelSegments: 5, shoulderSegments: 8, radialSegments: 40 },
  high: { heelSegments: 7, shoulderSegments: 12, radialSegments: 56 },
} as const;
