import { Vector3, type BufferGeometry } from 'three';
import { seededRandom } from '@/lib/math';

/**
 * Area-weighted point sampling over a mesh surface.
 *
 * This is the bridge between solid geometry and particle work: a morph or a
 * dissolve needs a cloud of points that actually lies on the object's surface,
 * distributed evenly over AREA rather than over vertices. Sampling vertices
 * directly would crowd wherever tessellation is dense — around a lathe's poles,
 * say — and leave the broad faces sparse.
 *
 * The result is deterministic for a given seed, so a transformation looks the
 * same on every run and can be reversed exactly.
 */

const a = new Vector3();
const b = new Vector3();
const c = new Vector3();

/** Cumulative triangle areas, for weighted selection. */
function buildAreaTable(geometry: BufferGeometry): {
  cumulative: Float32Array;
  triangles: number;
  total: number;
} {
  const position = geometry.attributes.position;
  const index = geometry.index;
  const triangles = index ? index.count / 3 : position.count / 3;

  const cumulative = new Float32Array(triangles);
  let total = 0;

  for (let i = 0; i < triangles; i++) {
    const i0 = index ? index.getX(i * 3) : i * 3;
    const i1 = index ? index.getX(i * 3 + 1) : i * 3 + 1;
    const i2 = index ? index.getX(i * 3 + 2) : i * 3 + 2;

    a.fromBufferAttribute(position, i0);
    b.fromBufferAttribute(position, i1);
    c.fromBufferAttribute(position, i2);

    b.sub(a);
    c.sub(a);
    total += b.cross(c).length() * 0.5;
    cumulative[i] = total;
  }

  return { cumulative, triangles, total };
}

/** Binary search for the triangle owning a cumulative-area value. */
function pickTriangle(cumulative: Float32Array, target: number): number {
  let low = 0;
  let high = cumulative.length - 1;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (cumulative[mid] < target) low = mid + 1;
    else high = mid;
  }
  return low;
}

export interface SurfaceSample {
  /** Flat xyz triples, length `count * 3`. */
  positions: Float32Array;
  /** Matching surface normals, length `count * 3`. */
  normals: Float32Array;
}

/**
 * Sample `count` points spread evenly over the surface of `geometry`.
 *
 * Triangles are chosen with probability proportional to area, then a point
 * inside the chosen triangle is picked with the standard square-root barycentric
 * mapping — the naive `(u, v, 1-u-v)` bunches samples toward one corner.
 */
export function sampleSurface(
  geometry: BufferGeometry,
  count: number,
  seed = 1,
): SurfaceSample {
  const position = geometry.attributes.position;
  const normal = geometry.attributes.normal;
  const index = geometry.index;

  const { cumulative, total } = buildAreaTable(geometry);

  const positions = new Float32Array(count * 3);
  const normals = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const k = (i + 1) * seed;

    const triangle = pickTriangle(cumulative, seededRandom(k * 1.7) * total);
    const i0 = index ? index.getX(triangle * 3) : triangle * 3;
    const i1 = index ? index.getX(triangle * 3 + 1) : triangle * 3 + 1;
    const i2 = index ? index.getX(triangle * 3 + 2) : triangle * 3 + 2;

    // Square root of the first coordinate keeps the distribution uniform.
    const r1 = Math.sqrt(seededRandom(k * 3.1));
    const r2 = seededRandom(k * 5.9);
    const w0 = 1 - r1;
    const w1 = r1 * (1 - r2);
    const w2 = r1 * r2;

    a.fromBufferAttribute(position, i0).multiplyScalar(w0);
    b.fromBufferAttribute(position, i1).multiplyScalar(w1);
    c.fromBufferAttribute(position, i2).multiplyScalar(w2);
    a.add(b).add(c);

    positions[i * 3] = a.x;
    positions[i * 3 + 1] = a.y;
    positions[i * 3 + 2] = a.z;

    if (normal) {
      a.fromBufferAttribute(normal, i0).multiplyScalar(w0);
      b.fromBufferAttribute(normal, i1).multiplyScalar(w1);
      c.fromBufferAttribute(normal, i2).multiplyScalar(w2);
      a.add(b).add(c).normalize();

      normals[i * 3] = a.x;
      normals[i * 3 + 1] = a.y;
      normals[i * 3 + 2] = a.z;
    }
  }

  return { positions, normals };
}

/** Total surface area of a geometry, for splitting a budget across meshes. */
export function surfaceArea(geometry: BufferGeometry): number {
  return buildAreaTable(geometry).total;
}

/**
 * Reorder two matched point clouds so particle `i` starts and ends on a similar
 * bearing around the Y axis.
 *
 * Pairing source to target by raw index means every particle crosses the object
 * to an unrelated place: the cloud reads as noise that happens to resolve.
 * Sorting both by angle preserves each particle's bearing through the flight, so
 * the swarm reads as the SAME material reorganising — which is the whole point
 * of the beat. Height is the tiebreak, so the two ends of the object stay
 * roughly the two ends.
 */
export function alignByBearing(a: SurfaceSample, b: SurfaceSample): void {
  const order = (sample: SurfaceSample) => {
    const count = sample.positions.length / 3;
    const keys = new Float64Array(count);
    const index = new Uint32Array(count);

    for (let i = 0; i < count; i++) {
      const x = sample.positions[i * 3];
      const y = sample.positions[i * 3 + 1];
      const z = sample.positions[i * 3 + 2];
      // Angle dominates; height is a fine-grained tiebreak within a bearing.
      keys[i] = Math.atan2(z, x) * 1000 + y;
      index[i] = i;
    }

    const sorted = Array.from(index).sort((p, q) => keys[p] - keys[q]);
    const positions = new Float32Array(count * 3);
    const normals = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const from = sorted[i];
      positions[i * 3] = sample.positions[from * 3];
      positions[i * 3 + 1] = sample.positions[from * 3 + 1];
      positions[i * 3 + 2] = sample.positions[from * 3 + 2];
      normals[i * 3] = sample.normals[from * 3];
      normals[i * 3 + 1] = sample.normals[from * 3 + 1];
      normals[i * 3 + 2] = sample.normals[from * 3 + 2];
    }

    sample.positions.set(positions);
    sample.normals.set(normals);
  };

  order(a);
  order(b);
}

/**
 * A quantised cylindrical lattice for particles to pass through mid-flight.
 *
 * Used as the middle control point of the transformation path, so the cloud
 * visibly organises itself into a structured column before resolving onto its
 * destination. Quantisation is the whole point: continuous positions read as
 * dust, while discrete rings and sectors read as data.
 *
 * Bearing comes from the SOURCE and height from the TARGET, so every particle
 * arrives at the column already on the side it left from and at the level it is
 * heading for. The final settle is then short and reads as snapping into a
 * form, rather than as a second unrelated journey.
 */
export function buildColumnWaypoint(
  source: Float32Array,
  target: Float32Array,
  options: {
    radius: number;
    height: number;
    /** Discrete height levels. */
    rings: number;
    /** Discrete angular steps. */
    sectors: number;
  },
): Float32Array {
  const count = Math.min(source.length, target.length) / 3;
  const out = new Float32Array(count * 3);
  const step = (Math.PI * 2) / options.sectors;

  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < count; i++) {
    const y = target[i * 3 + 1];
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const span = maxY - minY || 1;

  for (let i = 0; i < count; i++) {
    const angle =
      Math.round(Math.atan2(source[i * 3 + 2], source[i * 3]) / step) * step;

    const normalised = (target[i * 3 + 1] - minY) / span;
    const level =
      Math.round(normalised * (options.rings - 1)) / (options.rings - 1);

    out[i * 3] = Math.cos(angle) * options.radius;
    out[i * 3 + 1] = -options.height / 2 + level * options.height;
    out[i * 3 + 2] = Math.sin(angle) * options.radius;
  }

  return out;
}
