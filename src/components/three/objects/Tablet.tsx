'use client';

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, MeshPhysicalMaterial, type Mesh } from 'three';
import { CERAMIC_COLOR, ceramic } from '@/lib/design/materials';
import { attachDissolve, createDissolveUniforms } from '@/lib/design/dissolve';
import { accent } from '@/lib/design/tokens';
import {
  TABLET_TESSELLATION,
  createTabletGeometry,
  solveTabletProfile,
  type TabletOptions,
} from '@/lib/geometry/tabletProfile';
import { createTabletMarkingTexture } from '@/lib/textures/tabletMarking';
import { sampleSurface, type SurfaceSample } from '@/lib/geometry/surfaceSampler';
import { clamp } from '@/lib/math';
import { useQuality } from '@/components/three/QualityProvider';

/**
 * Imperative handle for per-frame animation and particle work.
 *
 * As with the capsule, animating through props would re-render React every
 * frame; scenes take this handle and drive the object from `useFrame`.
 */
export interface TabletHandle {
  /** The tablet's transform node. Rotate, move and scale this. */
  group: Group | null;
  /** The mesh itself, for material or geometry access. */
  mesh: Mesh | null;
  /** Burn the tablet away. 0 = intact, 1 = gone. */
  setDissolve: (value: number) => void;
  /**
   * Sample points spread evenly over the tablet's surface, in local space.
   *
   * This is the integration point for particle transformations: a morph needs
   * targets that lie on the destination form, distributed by area rather than
   * by vertex. Results are memoised per (count, seed) so a scene can call this
   * during setup without rebuilding the area table each time.
   */
  sampleSurface: (count: number, seed?: number) => SurfaceSample;
  /** Solved dimensions — thickness, cup radius — for scenes that need them. */
  dimensions: ReturnType<typeof solveTabletProfile>;
}

export interface TabletProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;

  color?: string;
  /** Tablet radius. */
  radius?: number;
  /** Height of the straight cylindrical edge. */
  bandHeight?: number;
  /** Rise of each convex face. */
  capHeight?: number;
  /** Fillet radius between band and face. */
  bevel?: number;

  /** Tessellation override. Defaults to the quality budget. */
  detail?: number;

  /** Deboss a bisecting score line. */
  score?: boolean;
  /** Characters engraved on the face. Empty string for none. */
  marking?: string;
  /**
   * Strength of the debossed relief.
   *
   * This is Three's `bumpScale` — a dimensionless multiplier on the height
   * field, where 1 is full strength. It is NOT a depth in world units; passing
   * a plausible-looking millimetre figure here produces no visible relief at
   * all.
   */
  reliefDepth?: number;

  /** Static dissolve. For animation use the handle or `getDissolve`. */
  dissolve?: number;
  /** Per-frame dissolve, read without re-rendering. */
  getDissolve?: () => number;

  /**
   * Compile dissolve support into the materials.
   *
   * Off by default, and deliberately so. Dissolve works by `discard`ing
   * fragments, and the mere PRESENCE of a discard in a shader disables the
   * GPU's early-depth rejection for that material — permanently, not just while
   * dissolving. A chapter that only ever displays the object pays that cost for
   * nothing. Opt in from the chapters that actually transform it.
   */
  dissolvable?: boolean;

  castShadow?: boolean;
  receiveShadow?: boolean;
}

const tessellationFor = (detail: number) =>
  detail <= 0
    ? TABLET_TESSELLATION.low
    : detail === 1
      ? TABLET_TESSELLATION.medium
      : TABLET_TESSELLATION.high;

/**
 * A biconvex, film-coated pharmaceutical tablet.
 *
 * Built as one lathed surface of revolution — see `lib/geometry/tabletProfile`
 * — so the shoulder between face and edge is genuinely tangent rather than two
 * primitives meeting at a seam. One geometry, one material, one draw call.
 *
 * The score line and engraving are a relief map generated on a canvas at load,
 * projected onto the faces with planar UVs. They are not geometry: a score line
 * is not rotationally symmetric, so it cannot come off the lathe, and adding it
 * as separate meshes would cost draw calls on an object whose whole point is
 * that it is one.
 *
 * Materially it is the counterpart to the capsule: where the capsule is glossy
 * gelatin with a full clearcoat, this is matte mineral with a faint film-coat
 * sheen, lit by the same studio rig and carrying the same dissolve support.
 */
const Tablet = forwardRef<TabletHandle, TabletProps>(function Tablet(
  {
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = 1,
    color = CERAMIC_COLOR,
    radius = 0.62,
    bandHeight = 0.1,
    capHeight = 0.13,
    bevel = 0.03,
    detail,
    score = true,
    marking = 'MSP',
    reliefDepth = 0.45,
    dissolve = 0,
    getDissolve,
    dissolvable = false,
    castShadow = true,
    receiveShadow = true,
  },
  ref,
) {
  const budget = useQuality();
  const level = detail ?? budget.detail;

  const group = useRef<Group>(null);
  const mesh = useRef<Mesh>(null);

  /* ---------------------------------------------------------------------- */
  /* Geometry                                                               */
  /* ---------------------------------------------------------------------- */

  const options = useMemo<TabletOptions>(
    () => ({
      ...tessellationFor(level),
      radius,
      bandHeight,
      capHeight,
      bevel,
    }),
    [level, radius, bandHeight, capHeight, bevel],
  );

  const geometry = useMemo(() => createTabletGeometry(options), [options]);
  const dimensions = useMemo(() => solveTabletProfile(options), [options]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  /* ---------------------------------------------------------------------- */
  /* Relief map                                                             */
  /* ---------------------------------------------------------------------- */

  const relief = useMemo(
    () =>
      score || marking
        ? createTabletMarkingTexture({
            score,
            marking,
            // Low tier gets a smaller map: it is a bump map on a small object,
            // and the resolution is invisible well before the memory is.
            size: budget.tier === 'low' ? 256 : 512,
          })
        : null,
    [score, marking, budget.tier],
  );

  useEffect(() => () => relief?.dispose(), [relief]);

  /* ---------------------------------------------------------------------- */
  /* Material                                                               */
  /* ---------------------------------------------------------------------- */

  const { material, dissolveUniforms } = useMemo(() => {
    const physical = new MeshPhysicalMaterial({
      ...ceramic(budget),
      color,
      bumpMap: relief,
      bumpScale: relief ? reliefDepth : 0,
    });

    if (!dissolvable) {
      return { material: physical, dissolveUniforms: null };
    }

    const uniforms = createDissolveUniforms(accent.pharma.base);
    return {
      material: attachDissolve(physical, uniforms, 'tablet-dissolve'),
      dissolveUniforms: uniforms,
    };
  }, [budget, color, relief, reliefDepth, dissolvable]);

  useEffect(() => () => material.dispose(), [material]);

  /* ---------------------------------------------------------------------- */
  /* Imperative API                                                         */
  /* ---------------------------------------------------------------------- */

  const applyDissolve = useMemo(
    () => (value: number) => {
      if (dissolveUniforms) dissolveUniforms.uDissolve.value = clamp(value);
    },
    [dissolveUniforms],
  );

  /** Memoised so repeated requests for the same cloud are free. */
  const sampleCache = useRef(new Map<string, SurfaceSample>());

  useEffect(() => {
    const cache = sampleCache.current;
    cache.clear();
  }, [geometry]);

  const sample = useMemo(
    () => (count: number, seed = 1) => {
      const key = `${count}:${seed}`;
      const cached = sampleCache.current.get(key);
      if (cached) return cached;

      const result = sampleSurface(geometry, count, seed);
      sampleCache.current.set(key, result);
      return result;
    },
    [geometry],
  );

  useImperativeHandle(
    ref,
    (): TabletHandle => ({
      get group() {
        return group.current;
      },
      get mesh() {
        return mesh.current;
      },
      setDissolve: applyDissolve,
      sampleSurface: sample,
      dimensions,
    }),
    [applyDissolve, sample, dimensions],
  );

  /* ---------------------------------------------------------------------- */
  /* Frame                                                                  */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    applyDissolve(dissolve);
  }, [applyDissolve, dissolve]);

  useFrame(() => {
    if (getDissolve) applyDissolve(getDissolve());
  });

  return (
    <group ref={group} position={position} rotation={rotation} scale={scale}>
      <mesh
        ref={mesh}
        geometry={geometry}
        material={material}
        castShadow={castShadow}
        receiveShadow={receiveShadow}
      />
    </group>
  );
});

export default Tablet;
