import { seededRandom } from '@/lib/math';

/**
 * A cubic point lattice, restricted to a spherical shell.
 *
 * This is not decoration standing in for cryptography — it is the object the
 * cryptography is built on. ML-KEM and ML-DSA rest on the hardness of finding
 * short vectors in a high-dimensional lattice, so a regular grid of points with
 * its connecting edges is the honest picture, and it happens to look like
 * nothing else on the page.
 *
 * A shell rather than a solid ball: the interior is where the medicines sit,
 * and points inside would be both invisible and in the way.
 */
export interface LatticeOptions {
  /** Distance between adjacent nodes. */
  spacing: number;
  /** Nodes closer to the centre than this are omitted. */
  innerRadius: number;
  /** Nodes further out than this are omitted. */
  outerRadius: number;
  /** Fraction of edges drawn brighter, to give the structure emphasis. */
  highlightRatio?: number;
}

export interface LatticeData {
  /** Node positions, flat xyz triples. */
  nodes: Float32Array;
  /** Distance of each node from the centre. */
  nodeRadius: Float32Array;
  nodeCount: number;
  /** Edge endpoints, flat xyz triples — two vertices per edge. */
  edges: Float32Array;
  /** Per-vertex distance of the EDGE's midpoint from the centre. */
  edgeRadius: Float32Array;
  /** Per-vertex highlight flag, 0 or 1. */
  edgeHighlight: Float32Array;
  edgeCount: number;
  /** Radius of the outermost node, for normalising growth. */
  maxRadius: number;
}

export function buildLattice({
  spacing,
  innerRadius,
  outerRadius,
  highlightRatio = 0.08,
}: LatticeOptions): LatticeData {
  const extent = Math.ceil(outerRadius / spacing);

  const positions: number[] = [];
  const radii: number[] = [];
  /** Integer coordinate -> node index, for finding neighbours cheaply. */
  const index = new Map<string, number>();

  for (let x = -extent; x <= extent; x++) {
    for (let y = -extent; y <= extent; y++) {
      for (let z = -extent; z <= extent; z++) {
        const px = x * spacing;
        const py = y * spacing;
        const pz = z * spacing;
        const r = Math.sqrt(px * px + py * py + pz * pz);
        if (r > outerRadius || r < innerRadius) continue;

        index.set(`${x},${y},${z}`, positions.length / 3);
        positions.push(px, py, pz);
        radii.push(r);
      }
    }
  }

  /*
    Edges follow the lattice's own basis — the six axis-aligned neighbours.
    Only the positive directions are walked, so each edge is emitted once.
  */
  const edgePoints: number[] = [];
  const edgeRadii: number[] = [];
  const edgeHighlights: number[] = [];
  const steps: [number, number, number][] = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];

  let edgeCount = 0;
  for (const [key, from] of index) {
    const [x, y, z] = key.split(',').map(Number);
    for (const [dx, dy, dz] of steps) {
      const to = index.get(`${x + dx},${y + dy},${z + dz}`);
      if (to === undefined) continue;

      const ax = positions[from * 3];
      const ay = positions[from * 3 + 1];
      const az = positions[from * 3 + 2];
      const bx = positions[to * 3];
      const by = positions[to * 3 + 1];
      const bz = positions[to * 3 + 2];

      edgePoints.push(ax, ay, az, bx, by, bz);

      // Growth is driven from the midpoint, so an edge appears as a whole
      // rather than growing out of one of its endpoints.
      const mx = (ax + bx) / 2;
      const my = (ay + by) / 2;
      const mz = (az + bz) / 2;
      const mr = Math.sqrt(mx * mx + my * my + mz * mz);
      edgeRadii.push(mr, mr);

      const highlight =
        seededRandom(edgeCount * 7.13) < highlightRatio ? 1 : 0;
      edgeHighlights.push(highlight, highlight);
      edgeCount++;
    }
  }

  return {
    nodes: new Float32Array(positions),
    nodeRadius: new Float32Array(radii),
    nodeCount: radii.length,
    edges: new Float32Array(edgePoints),
    edgeRadius: new Float32Array(edgeRadii),
    edgeHighlight: new Float32Array(edgeHighlights),
    edgeCount,
    maxRadius: outerRadius,
  };
}
