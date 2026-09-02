'use client';

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import { useFrame } from '@react-three/fiber';
import {
  DoubleSide,
  FrontSide,
  Group,
  MeshPhysicalMaterial,
  type Mesh,
} from 'three';
import { accent, neutral } from '@/lib/design/tokens';
import { aluminium, glass } from '@/lib/design/materials';
import {
  attachDissolve,
  createDissolveUniforms,
  type DissolveUniforms,
} from '@/lib/design/dissolve';
import {
  VIAL_TESSELLATION,
  createVialCapProfile,
  createVialGlassProfile,
  createVialLiquidProfile,
  createVialStopperProfile,
  latheFrom,
  vialMetrics,
  type VialOptions,
} from '@/lib/geometry/vialProfile';
import { createVialLabelTexture } from '@/lib/textures/vialLabel';
import {
  sampleSurface,
  surfaceArea,
  type SurfaceSample,
} from '@/lib/geometry/surfaceSampler';
import { clamp } from '@/lib/math';
import { useQuality } from '@/components/three/QualityProvider';

export type VialPart = 'glass' | 'liquid' | 'stopper' | 'cap' | 'label';

/**
 * Imperative handle. Every part is individually addressable, so a scene can
 * animate the seal separately from the liquid, or dissolve the glass while the
 * contents remain.
 */
export interface SerumBottleHandle {
  group: Group | null;
  glass: Mesh | null;
  liquid: Mesh | null;
  stopper: Mesh | null;
  cap: Mesh | null;
  label: Mesh | null;
  /** Liquid level, 0 (empty) -> 1 (full). */
  setFill: (level: number) => void;
  /** Burn a part away, or all parts when no part is named. */
  setDissolve: (value: number, part?: VialPart) => void;
  /** Show or hide a part. */
  setVisible: (part: VialPart, visible: boolean) => void;
  /** Derived heights, for scenes that need to place things against the vial. */
  metrics: ReturnType<typeof vialMetrics>;
  /**
   * Sample points over the assembled vial, in the component's local space.
   *
   * Glass, stopper and cap are sampled in proportion to their AREA and returned
   * as one cloud with each part's own offset applied, so the result is directly
   * usable as the destination of a morph. The label is excluded: it is applied
   * stock rather than part of the object's form, and including it would put a
   * dense band of particles around the body that the silhouette does not have.
   */
  sampleSurface: (count: number, seed?: number) => SurfaceSample;
}

export interface SerumBottleProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;

  /** Colour of the liquid. */
  serumColor?: string;
  /** Colour of the rubber stopper. */
  stopperColor?: string;
  /** Colour of the crimp seal. */
  capColor?: string;

  /** Geometry overrides. */
  bodyRadius?: number;
  bodyHeight?: number;
  neckRadius?: number;
  wallThickness?: number;

  /** Static fill level, 0 -> 1. */
  fill?: number;
  /** Per-frame fill, read without re-rendering. */
  getFill?: () => number;

  /** Show the applied label. */
  label?: boolean;
  /** Label copy. */
  labelName?: string;
  labelStrength?: string;
  labelLot?: string;

  /** Tessellation override. Defaults to the quality budget. */
  detail?: number;

  /**
   * Compile dissolve support into the materials.
   *
   * Off by default, and deliberately so. Dissolve works by `discard`ing
   * fragments, and the mere PRESENCE of a discard in a shader disables the
   * GPU's early-depth rejection for that material — permanently, not just while
   * dissolving. This object has five materials, so leaving it on everywhere
   * costs five shaders their early-Z in every chapter that merely shows a vial.
   */
  dissolvable?: boolean;

  castShadow?: boolean;
  receiveShadow?: boolean;
}

const tessellationFor = (detail: number) =>
  detail <= 0
    ? VIAL_TESSELLATION.low
    : detail === 1
      ? VIAL_TESSELLATION.medium
      : VIAL_TESSELLATION.high;

/**
 * A premium injectable vial.
 *
 * Five parts, each one lathed surface: borosilicate shell, liquid, rubber
 * stopper, aluminium crimp seal and an applied label. Five draw calls and
 * roughly eight thousand triangles at the top tier — the believability comes
 * from the silhouette and the materials, not from geometric density.
 *
 * The details that do the work are cheap ones: a hollow glass shell so the
 * doubled edge reads as glass, an air gap between liquid and wall, a concave
 * meniscus, and a crimp seal left open at the centre so the stopper shows.
 */
const SerumBottle = forwardRef<SerumBottleHandle, SerumBottleProps>(
  function SerumBottle(
    {
      position = [0, 0, 0],
      rotation = [0, 0, 0],
      scale = 1,
      serumColor = accent.analysis.base,
      stopperColor = neutral.n07,
      capColor = aluminium.color,
      bodyRadius = 0.3,
      bodyHeight = 0.6,
      neckRadius = 0.17,
      wallThickness = 0.022,
      fill = 0.8,
      getFill,
      label = true,
      labelName,
      labelStrength,
      labelLot,
      detail,
      dissolvable = false,
      castShadow = true,
      receiveShadow = true,
    },
    ref,
  ) {
    const budget = useQuality();
    const level = detail ?? budget.detail;

    const group = useRef<Group>(null);
    const glassRef = useRef<Mesh>(null);
    const liquidRef = useRef<Mesh>(null);
    const stopperRef = useRef<Mesh>(null);
    const capRef = useRef<Mesh>(null);
    const labelRef = useRef<Mesh>(null);

    /* -------------------------------------------------------------------- */
    /* Geometry                                                             */
    /* -------------------------------------------------------------------- */

    const options = useMemo<VialOptions>(
      () => ({
        ...VIAL_TESSELLATION.medium,
        ...tessellationFor(level),
        bodyRadius,
        bodyHeight,
        shoulderHeight: 0.15,
        neckRadius,
        neckHeight: 0.1,
        lipRadius: neckRadius + 0.035,
        lipHeight: 0.06,
        wallThickness,
        heelRadius: 0.05,
      }),
      [level, bodyRadius, bodyHeight, neckRadius, wallThickness],
    );

    const metrics = useMemo(() => vialMetrics(options), [options]);

    const geometries = useMemo(() => {
      const r = options.radialSegments;
      return {
        glass: latheFrom(createVialGlassProfile(options), r),
        liquid: latheFrom(createVialLiquidProfile(options), r),
        stopper: latheFrom(createVialStopperProfile(options), r),
        cap: latheFrom(createVialCapProfile(options), r),
      };
    }, [options]);

    useEffect(
      () => () => {
        Object.values(geometries).forEach((g) => g.dispose());
      },
      [geometries],
    );

    /* -------------------------------------------------------------------- */
    /* Label                                                                */
    /* -------------------------------------------------------------------- */

    const labelTexture = useMemo(
      () =>
        label
          ? createVialLabelTexture({
              name: labelName,
              strength: labelStrength,
              lot: labelLot,
              width: budget.tier === 'low' ? 512 : 1024,
              height: budget.tier === 'low' ? 128 : 256,
            })
          : null,
      [label, labelName, labelStrength, labelLot, budget.tier],
    );

    useEffect(() => () => labelTexture?.dispose(), [labelTexture]);

    /* -------------------------------------------------------------------- */
    /* Materials                                                            */
    /* -------------------------------------------------------------------- */

    const materials = useMemo(() => {
      /**
       * Patch dissolve in only when the caller has asked for it — see the
       * `dissolvable` prop for why that is not the default.
       */
      const wrap = (material: MeshPhysicalMaterial, cacheKey: string) => {
        if (!dissolvable) {
          return { material, uniforms: null as DissolveUniforms | null };
        }
        const uniforms = createDissolveUniforms(accent.analysis.base);
        return {
          material: attachDissolve(material, uniforms, cacheKey),
          uniforms: uniforms as DissolveUniforms | null,
        };
      };

      return {
        /*
          FrontSide, not DoubleSide.

          The profile already lathes an outer wall AND an inner wall, so the
          shell is genuinely two-sided geometry. Rendering it DoubleSide draws
          four tinted layers between the eye and the contents instead of two,
          and the vial goes from borosilicate to smoked glass.
        */
        glass: wrap(
          new MeshPhysicalMaterial({
            ...glass(budget),
            side: FrontSide,
            /*
              The shared preset is tuned for a chunky solid. A vial wall is
              about two centimetres of nothing and a couple of millimetres of
              glass, so the attenuation distance has to come right down or the
              body reads as smoked rather than clear.
            */
            thickness: 0.12,
            attenuationDistance: 6,
          }),
          'vial-glass-dissolve',
        ),

        liquid: wrap(
          new MeshPhysicalMaterial({
            color: serumColor,
            roughness: 0.14,
            metalness: 0,
            /*
              Opaque, and deliberately not transmissive.

              Both choices are forced by how transmission works. Three renders
              transmissive materials by sampling a backbuffer that contains only
              the OPAQUE geometry drawn before them — so a transparent liquid
              inside a transmissive vial is simply absent from the glass's
              refraction, and the contents disappear. Making the liquid opaque
              puts it in that backbuffer, where it belongs.

              Giving it its own transmission would also cost a second full-scene
              pass to change almost nothing visible behind an already-refracting
              shell.
            */
            transparent: false,
            opacity: 1,
            clearcoat: 1,
            clearcoatRoughness: 0.08,
            envMapIntensity: 1.4,
          }),
          'vial-liquid-dissolve',
        ),

        stopper: wrap(
          new MeshPhysicalMaterial({
            color: stopperColor,
            roughness: 0.88,
            metalness: 0,
            // Butyl rubber has a faint waxy sheen; without it the stopper reads
            // as felt. High tier only — it is a second specular lobe.
            sheen: budget.tier === 'high' ? 0.3 : 0,
            sheenColor: '#6a6a72',
          }),
          'vial-stopper-dissolve',
        ),

        cap: wrap(
          new MeshPhysicalMaterial({
            ...aluminium,
            color: capColor,
            side: DoubleSide,
          }),
          'vial-cap-dissolve',
        ),

        label: wrap(
          new MeshPhysicalMaterial({
            color: '#ffffff',
            map: labelTexture,
            roughness: 0.78,
            metalness: 0,
            clearcoat: 0.12,
            side: DoubleSide,
          }),
          'vial-label-dissolve',
        ),
      };
    }, [
      budget,
      serumColor,
      stopperColor,
      capColor,
      labelTexture,
      dissolvable,
    ]);

    useEffect(
      () => () => {
        Object.values(materials).forEach((m) => m.material.dispose());
      },
      [materials],
    );

    /* -------------------------------------------------------------------- */
    /* Imperative API                                                       */
    /* -------------------------------------------------------------------- */

    const applyFill = useMemo(
      () => (levelValue: number) => {
        if (!liquidRef.current) return;
        const amount = clamp(levelValue);
        // The liquid is modelled at full height with its origin on the interior
        // floor, so level is a Y scale -- no geometry rebuild, and it animates
        // for free. The meniscus flattens slightly as it drops, which is a fair
        // trade for not respecifying a lathe every frame.
        liquidRef.current.scale.y = Math.max(amount, 0.0001);
        liquidRef.current.visible = amount > 0.004;
      },
      [],
    );

    const applyDissolve = useMemo(
      () => (value: number, part?: VialPart) => {
        const amount = clamp(value);
        if (part) {
          const uniforms = materials[part].uniforms;
          if (uniforms) uniforms.uDissolve.value = amount;
          return;
        }
        (Object.keys(materials) as VialPart[]).forEach((key) => {
          const uniforms = materials[key].uniforms;
          if (uniforms) uniforms.uDissolve.value = amount;
        });
      },
      [materials],
    );

    const setVisible = useMemo(
      () => (part: VialPart, visible: boolean) => {
        const node = {
          glass: glassRef,
          liquid: liquidRef,
          stopper: stopperRef,
          cap: capRef,
          label: labelRef,
        }[part].current;
        if (node) node.visible = visible;
      },
      [],
    );

    /* -------------------------------------------------------------------- */
    /* Surface sampling                                                     */
    /* -------------------------------------------------------------------- */

    const sampleCache = useRef(new Map<string, SurfaceSample>());

    useEffect(() => {
      sampleCache.current.clear();
    }, [geometries]);

    const centreOffsetValue = -metrics.lipTop / 2;
    const stopperOffset =
      metrics.lipTop - options.neckHeight * 0.72 + centreOffsetValue;

    const sampleVial = useMemo(
      () => (count: number, seed = 1): SurfaceSample => {
        const key = `${count}:${seed}`;
        const cached = sampleCache.current.get(key);
        if (cached) return cached;

        const parts = [
          { geometry: geometries.glass, offsetY: centreOffsetValue, seed },
          { geometry: geometries.stopper, offsetY: stopperOffset, seed: seed + 41 },
          { geometry: geometries.cap, offsetY: centreOffsetValue, seed: seed + 83 },
        ];

        const areas = parts.map((part) => surfaceArea(part.geometry));
        const total = areas.reduce((sum, a) => sum + a, 0);

        const positions = new Float32Array(count * 3);
        const normals = new Float32Array(count * 3);
        let written = 0;

        parts.forEach((part, index) => {
          const isLast = index === parts.length - 1;
          const share = isLast
            ? count - written
            : Math.max(1, Math.round((count * areas[index]) / total));
          if (share <= 0) return;

          const sample = sampleSurface(part.geometry, share, part.seed);
          for (let i = 0; i < share; i++) {
            const to = (written + i) * 3;
            positions[to] = sample.positions[i * 3];
            positions[to + 1] = sample.positions[i * 3 + 1] + part.offsetY;
            positions[to + 2] = sample.positions[i * 3 + 2];
            normals[to] = sample.normals[i * 3];
            normals[to + 1] = sample.normals[i * 3 + 1];
            normals[to + 2] = sample.normals[i * 3 + 2];
          }
          written += share;
        });

        const result: SurfaceSample = { positions, normals };
        sampleCache.current.set(key, result);
        return result;
      },
      [geometries, centreOffsetValue, stopperOffset],
    );

    useImperativeHandle(
      ref,
      (): SerumBottleHandle => ({
        get group() {
          return group.current;
        },
        get glass() {
          return glassRef.current;
        },
        get liquid() {
          return liquidRef.current;
        },
        get stopper() {
          return stopperRef.current;
        },
        get cap() {
          return capRef.current;
        },
        get label() {
          return labelRef.current;
        },
        setFill: applyFill,
        setDissolve: applyDissolve,
        setVisible,
        metrics,
        sampleSurface: sampleVial,
      }),
      [applyFill, applyDissolve, setVisible, metrics, sampleVial],
    );

    useEffect(() => {
      applyFill(fill);
    }, [applyFill, fill]);

    useFrame(() => {
      if (getFill) applyFill(getFill());
    });

    /* -------------------------------------------------------------------- */
    /* Render — the whole vial is centred on its own mid-height              */
    /* -------------------------------------------------------------------- */

    const centreOffset = centreOffsetValue;
    /*
      The label is short, sits low, and wraps only part of the way round.

      A full-height full-wrap label is what a real vial has and is exactly wrong
      here: it hides the contents, and "visible liquid inside" is the point of
      the object. A partial wrap leaves an inspection window -- which is itself
      real pharmaceutical practice, since the contents must be checked for
      particulates -- and the reduced height leaves a clear band of serum and
      its meniscus above the artwork.
    */
    const labelHeight = options.bodyHeight * 0.4;
    const labelWrap = 4.3;

    return (
      <group ref={group} position={position} rotation={rotation} scale={scale}>
        <group position={[0, centreOffset, 0]}>
          <mesh
            ref={glassRef}
            geometry={geometries.glass}
            material={materials.glass.material}
            castShadow={castShadow}
            receiveShadow={receiveShadow}
          />

          <mesh
            ref={liquidRef}
            geometry={geometries.liquid}
            material={materials.liquid.material}
            position={[0, metrics.floor, 0]}
          />

          <mesh
            ref={stopperRef}
            geometry={geometries.stopper}
            material={materials.stopper.material}
            position={[0, metrics.lipTop - options.neckHeight * 0.72, 0]}
            castShadow={castShadow}
          />

          <mesh
            ref={capRef}
            geometry={geometries.cap}
            material={materials.cap.material}
            castShadow={castShadow}
            receiveShadow={receiveShadow}
          />

          {label ? (
            <mesh
              ref={labelRef}
              material={materials.label.material}
              position={[0, options.bodyHeight * 0.27, 0]}
              receiveShadow={receiveShadow}
            >
              {/* Open-ended arc sitting just proud of the glass, so it reads as
                  applied stock rather than as printing on the wall. Centred on
                  +Z so the artwork faces the default camera. */}
              <cylinderGeometry
                args={[
                  options.bodyRadius + 0.004,
                  options.bodyRadius + 0.004,
                  labelHeight,
                  Math.max(Math.round(options.radialSegments * 0.7), 12),
                  1,
                  true,
                  -labelWrap / 2,
                  labelWrap,
                ]}
              />
            </mesh>
          ) : null}
        </group>
      </group>
    );
  },
);

export default SerumBottle;
