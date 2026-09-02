'use client';

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { useFrame } from '@react-three/fiber';
import { Group, MeshPhysicalMaterial, type LatheGeometry } from 'three';
import { accent, neutral } from '@/lib/design/tokens';
import { gelatin } from '@/lib/design/materials';
import { attachDissolve, createDissolveUniforms } from '@/lib/design/dissolve';
import {
  CAPSULE_TESSELLATION,
  createCapsuleHalfGeometry,
} from '@/lib/geometry/capsuleProfile';
import {
  sampleSurface,
  surfaceArea,
  type SurfaceSample,
} from '@/lib/geometry/surfaceSampler';
import { clamp } from '@/lib/math';
import { useQuality } from '@/components/three/QualityProvider';

export type CapsuleHalfName = 'body' | 'cap';

/**
 * Imperative handle for per-frame animation.
 *
 * Animating through props would re-render React every frame, which the whole
 * architecture is built to avoid. Scenes grab this handle and drive the halves
 * directly from `useFrame` instead.
 */
export interface CapsuleHandle {
  /** The whole capsule. Transform this to move or rotate the assembly. */
  group: Group | null;
  /** The longer, narrower half. Independently transformable. */
  body: Group | null;
  /** The shorter, wider half that sleeves over the body. */
  cap: Group | null;
  /** Slide the halves apart. 0 = sealed, 1 = fully separated. */
  setSeparation: (value: number) => void;
  /** Burn a half away. 0 = intact, 1 = gone. */
  setDissolve: (value: number, half?: CapsuleHalfName) => void;
  /**
   * Resting local Y of each half when sealed, and the gap at full separation.
   *
   * Exposed so a scene can drive the halves through arbitrary paths -- a
   * formation that brings them in from off-axis, say -- and still know exactly
   * where they have to land to seal.
   */
  layout: { bodyY: number; capY: number; gap: number };
  /**
   * Sample points spread evenly over the sealed capsule's surface, in the
   * component's local space.
   *
   * The two halves are sampled in proportion to their AREA and returned in one
   * cloud with each half's rest transform already applied, so the result is
   * directly usable as the source of a morph. Splitting the budget evenly
   * instead would over-sample whichever half is smaller.
   */
  sampleSurface: (count: number, seed?: number) => SurfaceSample;
}

export interface CapsuleProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;

  /** Colour of the body half. Defaults to the pharmaceutical amber. */
  bodyColor?: string;
  /** Colour of the cap half. Defaults to bone white. */
  capColor?: string;

  /** Outer radius of the cap. The body is fractionally narrower. */
  radius?: number;
  /** Overall length of the sealed capsule. */
  length?: number;
  /** Fraction of the total length covered by the cap when sealed. */
  capRatio?: number;
  /** Shell wall thickness. */
  wallThickness?: number;

  /** Tessellation override. Defaults to the quality budget. */
  detail?: number;

  /** Static separation, 0 -> 1. For animation use the handle or `getSeparation`. */
  separation?: number;
  /** Per-frame separation, read without re-rendering. */
  getSeparation?: () => number;
  /** Per-frame dissolve per half, read without re-rendering. */
  getDissolve?: (half: CapsuleHalfName) => number;

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

/** Tessellation tier for a numeric detail level. */
const tessellationFor = (detail: number) =>
  detail <= 0
    ? CAPSULE_TESSELLATION.low
    : detail === 1
      ? CAPSULE_TESSELLATION.medium
      : CAPSULE_TESSELLATION.high;

/**
 * A pharmaceutical capsule, built procedurally as two independent shells.
 *
 * Geometry comes from `lib/geometry/capsuleProfile` — a lathed profile with
 * real wall thickness, a domed end and an open bullnose rim, so the halves are
 * genuinely hollow and read correctly the moment they are pulled apart.
 *
 * Proportions follow a real capsule: the cap is fractionally wider than the
 * body and telescopes over it, leaving the small visible step at the join that
 * makes the object believable rather than merely pill-shaped.
 *
 * Both halves are separate `Group`s exposed through `CapsuleHandle`, and both
 * materials carry dissolve support, so opening, closing and burning away are
 * all driven imperatively with zero React work per frame.
 */
const Capsule = forwardRef<CapsuleHandle, CapsuleProps>(function Capsule(
  {
    position = [0, 0, 0],
    rotation = [0, 0, 0],
    scale = 1,
    bodyColor = accent.pharma.base,
    capColor = neutral.n11,
    radius = 0.3,
    length = 1,
    capRatio = 0.46,
    wallThickness = 0.024,
    detail,
    separation = 0,
    getSeparation,
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
  const bodyGroup = useRef<Group>(null);
  const capGroup = useRef<Group>(null);

  /* ---------------------------------------------------------------------- */
  /* Geometry                                                               */
  /* ---------------------------------------------------------------------- */

  const { bodyGeometry, capGeometry, layout } = useMemo(() => {
    const tess = tessellationFor(level);

    // The cap is the wider half; the body must clear it to telescope inside.
    const capRadius = radius;
    const bodyRadius = radius - Math.max(wallThickness * 0.55, 0.004);

    const capLength = length * capRatio;
    // The body runs longer than the remainder so the two overlap at the join.
    const bodyLength = length - capLength + length * 0.08;

    return {
      capGeometry: createCapsuleHalfGeometry({
        ...tess,
        radius: capRadius,
        length: capLength,
        wallThickness,
      }),
      bodyGeometry: createCapsuleHalfGeometry({
        ...tess,
        radius: bodyRadius,
        length: bodyLength,
        wallThickness,
      }),
      layout: {
        // Each half is modelled with its dome at y = 0 opening toward +y, so
        // the cap is simply flipped and parked at the far end.
        bodyY: -length / 2,
        capY: length / 2,
        /** Full-separation gap, comfortably clear of the join. */
        gap: length * 0.85,
      },
    };
  }, [level, radius, length, capRatio, wallThickness]);

  /* ---------------------------------------------------------------------- */
  /* Materials                                                              */
  /* ---------------------------------------------------------------------- */

  const { bodyMaterial, capMaterial, bodyDissolve, capDissolve } =
    useMemo(() => {
      const body = new MeshPhysicalMaterial(gelatin(bodyColor, budget));
      const cap = new MeshPhysicalMaterial(gelatin(capColor, budget));

      if (!dissolvable) {
        return {
          bodyMaterial: body,
          capMaterial: cap,
          bodyDissolve: null,
          capDissolve: null,
        };
      }

      const bodyUniforms = createDissolveUniforms(accent.pharma.base);
      const capUniforms = createDissolveUniforms(accent.pharma.base);

      return {
        bodyMaterial: attachDissolve(body, bodyUniforms, 'capsule-body-dissolve'),
        capMaterial: attachDissolve(cap, capUniforms, 'capsule-cap-dissolve'),
        bodyDissolve: bodyUniforms,
        capDissolve: capUniforms,
      };
    }, [bodyColor, capColor, budget, dissolvable]);

  /* ---------------------------------------------------------------------- */
  /* Disposal — lathe geometries and patched materials are ours to release   */
  /* ---------------------------------------------------------------------- */

  useEffect(
    () => () => {
      (bodyGeometry as LatheGeometry).dispose();
      (capGeometry as LatheGeometry).dispose();
    },
    [bodyGeometry, capGeometry],
  );

  useEffect(
    () => () => {
      bodyMaterial.dispose();
      capMaterial.dispose();
    },
    [bodyMaterial, capMaterial],
  );

  /* ---------------------------------------------------------------------- */
  /* Imperative API                                                         */
  /* ---------------------------------------------------------------------- */

  const applySeparation = useMemo(() => {
    return (value: number) => {
      const amount = clamp(value) * layout.gap;
      // The cap does most of the travelling and the body eases the other way,
      // so the join opens around a stable centre instead of the whole object
      // appearing to drift off its mark.
      if (capGroup.current) {
        capGroup.current.position.y = layout.capY + amount * 0.72;
      }
      if (bodyGroup.current) {
        bodyGroup.current.position.y = layout.bodyY - amount * 0.28;
      }
    };
  }, [layout]);

  const applyDissolve = useMemo(() => {
    return (value: number, half?: CapsuleHalfName) => {
      if (!bodyDissolve || !capDissolve) return;
      const amount = clamp(value);
      if (half !== 'cap') bodyDissolve.uDissolve.value = amount;
      if (half !== 'body') capDissolve.uDissolve.value = amount;
    };
  }, [bodyDissolve, capDissolve]);

  /** Memoised so repeated requests for the same cloud are free. */
  const sampleCache = useRef(new Map<string, SurfaceSample>());

  useEffect(() => {
    sampleCache.current.clear();
  }, [bodyGeometry, capGeometry]);

  const sampleBoth = useMemo(
    () => (count: number, seed = 1): SurfaceSample => {
      const key = `${count}:${seed}`;
      const cached = sampleCache.current.get(key);
      if (cached) return cached;

      const bodyArea = surfaceArea(bodyGeometry);
      const capArea = surfaceArea(capGeometry);
      const bodyCount = Math.max(
        1,
        Math.round((count * bodyArea) / (bodyArea + capArea)),
      );
      const capCount = Math.max(1, count - bodyCount);

      const body = sampleSurface(bodyGeometry, bodyCount, seed);
      const cap = sampleSurface(capGeometry, capCount, seed + 101);

      const positions = new Float32Array(count * 3);
      const normals = new Float32Array(count * 3);

      // Body: modelled dome-down, translated to its rest height.
      for (let i = 0; i < bodyCount; i++) {
        positions[i * 3] = body.positions[i * 3];
        positions[i * 3 + 1] = body.positions[i * 3 + 1] + layout.bodyY;
        positions[i * 3 + 2] = body.positions[i * 3 + 2];
        normals[i * 3] = body.normals[i * 3];
        normals[i * 3 + 1] = body.normals[i * 3 + 1];
        normals[i * 3 + 2] = body.normals[i * 3 + 2];
      }

      // Cap: the same shell rotated PI about X, then translated.
      for (let i = 0; i < capCount; i++) {
        const to = (bodyCount + i) * 3;
        positions[to] = cap.positions[i * 3];
        positions[to + 1] = -cap.positions[i * 3 + 1] + layout.capY;
        positions[to + 2] = -cap.positions[i * 3 + 2];
        normals[to] = cap.normals[i * 3];
        normals[to + 1] = -cap.normals[i * 3 + 1];
        normals[to + 2] = -cap.normals[i * 3 + 2];
      }

      const result: SurfaceSample = { positions, normals };
      sampleCache.current.set(key, result);
      return result;
    },
    [bodyGeometry, capGeometry, layout],
  );

  useImperativeHandle(
    ref,
    (): CapsuleHandle => ({
      get group() {
        return group.current;
      },
      get body() {
        return bodyGroup.current;
      },
      get cap() {
        return capGroup.current;
      },
      setSeparation: applySeparation,
      setDissolve: applyDissolve,
      sampleSurface: sampleBoth,
      layout,
    }),
    [applySeparation, applyDissolve, sampleBoth, layout],
  );

  /* ---------------------------------------------------------------------- */
  /* Frame                                                                  */
  /* ---------------------------------------------------------------------- */

  // Seed the resting pose once, before the first paint.
  useEffect(() => {
    applySeparation(separation);
  }, [applySeparation, separation]);

  useFrame(() => {
    if (getSeparation) applySeparation(getSeparation());
    if (getDissolve && bodyDissolve && capDissolve) {
      bodyDissolve.uDissolve.value = clamp(getDissolve('body'));
      capDissolve.uDissolve.value = clamp(getDissolve('cap'));
    }
  });

  return (
    <group ref={group} position={position} rotation={rotation} scale={scale}>
      {/* Body — domed end down, rim opening upward. */}
      <group ref={bodyGroup} position={[0, layout.bodyY, 0]}>
        <mesh
          geometry={bodyGeometry}
          material={bodyMaterial}
          castShadow={castShadow}
          receiveShadow={receiveShadow}
        />
      </group>

      {/* Cap — the same shell flipped, domed end up. */}
      <group
        ref={capGroup}
        position={[0, layout.capY, 0]}
        rotation={[Math.PI, 0, 0]}
      >
        <mesh
          geometry={capGeometry}
          material={capMaterial}
          castShadow={castShadow}
          receiveShadow={receiveShadow}
        />
      </group>
    </group>
  );
});

export default Capsule;
