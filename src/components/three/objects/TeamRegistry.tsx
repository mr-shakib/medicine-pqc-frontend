'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  AdditiveBlending,
  Color,
  MeshBasicMaterial,
  Object3D,
  PlaneGeometry,
  SRGBColorSpace,
  TextureLoader,
  TorusGeometry,
  type Group,
  type InstancedMesh,
  type Mesh,
} from 'three';
import { createNamePlateTexture } from '@/lib/textures/namePlate';
import { accent } from '@/lib/design/tokens';
import { clamp, smoothstep } from '@/lib/math';
import type { TeamMember } from '@/lib/team';

/* -------------------------------------------------------------------------- */
/* Station layout, in local units                                              */
/* -------------------------------------------------------------------------- */

/**
 * One record: a figure, a rule, a seal on the rule, a name.
 *
 * The vertical order is the DOM's chapter marker turned upright -- subject,
 * hairline, label -- so a record reads as annotation in the same voice the
 * copy layer uses, rather than as a badge.
 */
const PORTRAIT = { width: 1.7, height: 2.125, y: 0.42 } as const;
const PLATE = { width: 2.2, height: 0.66, y: -1.16 } as const;
const RULE_Y = -0.8;
const RULE_THICKNESS = 0.0075;
const RULE_MIN = 0.22;
const RULE_MAX = 1.62;
const SEAL_RADIUS = 0.058;

/** How far the focused record steps out of the ring toward the camera. */
const FOCUS_PUSH = 0.45;
/** Angular reach of the focus, in stations. Just under one, so no two share it. */
const FOCUS_SPAN = 0.86;
/**
 * Brightness of a record that is present but not being introduced.
 *
 * Low on purpose. The compositional offset that keeps the subject clear of the
 * copy column puts the record BEHIND the copy, and the one after it near the
 * frame edge; at anything brighter they compete with the headline and read as
 * two people cropped in half rather than as the rest of a ring.
 */
const DIM = 0.22;

/** Rise on entry, in local units, and how the rise is staggered around the ring. */
const RISE = 1.7;
const REVEAL_STAGGER = 0.04;
const REVEAL_RISE = 0.5;

/** Scratch objects -- the frame loop must never allocate. */
const dummy = new Object3D();
const tint = new Color();

export interface TeamRegistryProps {
  members: readonly TeamMember[];
  /** Radius of the turntable. */
  radius?: number;
  /**
   * Read every frame: which record is facing the camera, as a continuous
   * index. Fractional values are mid-turn between two records.
   */
  getCursor: () => number;
  /** Read every frame: 0 the ring is empty, 1 every record has risen. */
  getReveal: () => number;
  /** Rule, seal and role-line colour. Pass an accent family's `light` step. */
  color?: string;
}

/**
 * The team, as a turntable of signed identity records.
 *
 * The chapter it belongs to is about people, but it sits at the end of a piece
 * about verifying identity -- so the people are introduced in exactly the
 * grammar the products were: a subject held in the dark, a hairline beneath
 * it, a seal that completes when the record has been read. The rule drawing
 * itself outward is the same "this one has been checked" beat the scan in
 * chapter 05 and the still rings in chapter 07 use.
 *
 * Ten records, one draw call each for the figure and the name and two
 * instanced draws for every rule and seal in the ring. The whole chapter is
 * twenty-two draws and one frame callback; scrolling writes transforms,
 * opacities and instance colours, and nothing else.
 *
 * Records on the far side of the turntable are hidden rather than drawn
 * backwards: a plane has no back, and fading them out as they pass ninety
 * degrees costs nothing and avoids ten figures winking out at once.
 */
export default function TeamRegistry({
  members,
  radius = 4.6,
  getCursor,
  getReveal,
  color = accent.pharma.light,
}: TeamRegistryProps) {
  const turntable = useRef<Group>(null);
  const stations = useRef<(Group | null)[]>([]);
  /*
    Materials are reached through their meshes rather than through the
    memoised arrays that created them. What changes every frame is the state of
    an object in the scene graph, not a value this component rendered -- the
    same reasoning the backdrop and the mote cloud use for their uniforms.
  */
  const figures = useRef<(Mesh | null)[]>([]);
  const captions = useRef<(Mesh | null)[]>([]);
  const rules = useRef<InstancedMesh>(null);
  const seals = useRef<InstancedMesh>(null);

  const gl = useThree((state) => state.gl);

  const count = members.length;
  const step = (Math.PI * 2) / count;

  /** Ring trigonometry, resolved once: it never changes, the rotation does. */
  const ring = useMemo(
    () =>
      members.map((_, i) => ({
        angle: i * step,
        sin: Math.sin(i * step),
        cos: Math.cos(i * step),
      })),
    [members, step],
  );

  /*
    Portraits are loaded imperatively rather than through a suspending hook.
    The canvas has no Suspense boundary of its own -- deliberately, since the
    whole world is compiled up front by `Precompile` and then never blocks --
    and a chapter that suspends on its tenth image would tear that down. The
    loader hands back a Texture immediately and fills it in later; the material
    is valid the whole time.
  */
  const portraits = useMemo(() => {
    const loader = new TextureLoader();
    return members.map((member) => {
      const texture = loader.load(member.portrait, (loaded) => {
        // Upload on arrival, not on first draw. Otherwise ten 512x640 uploads
        // all land on the frame the chapter first becomes visible -- which is
        // mid-scroll, at the transition into it.
        gl.initTexture(loaded);
      });
      texture.colorSpace = SRGBColorSpace;
      texture.anisotropy = 8;
      return texture;
    });
  }, [members, gl]);

  const plates = useMemo(
    () =>
      members.map((member) =>
        createNamePlateTexture({
          name: member.name,
          role: member.role,
          accentColor: color,
        }),
      ),
    [members, color],
  );

  /*
    A figure is a photograph: it arrives with its own lighting already in it,
    graded to this rig. Shading it again would light it twice and flatten the
    modelling that makes it read as a person. Basic, and tone-mapped like
    everything else so it sits inside the same grade.
  */
  const portraitMaterials = useMemo(
    () =>
      portraits.map(
        (map) =>
          new MeshBasicMaterial({
            map,
            transparent: true,
            depthWrite: false,
            color: 0x000000,
            opacity: 0,
          }),
      ),
    [portraits],
  );

  // The name is type, not material: it stays out of the tone curve so it holds
  // the same weight whether its record is lit or dim.
  const plateMaterials = useMemo(
    () =>
      plates.map(
        (map) =>
          new MeshBasicMaterial({
            map,
            transparent: true,
            depthWrite: false,
            opacity: 0,
            toneMapped: false,
          }),
      ),
    [plates],
  );

  const portraitGeometry = useMemo(
    () => new PlaneGeometry(PORTRAIT.width, PORTRAIT.height),
    [],
  );
  const plateGeometry = useMemo(
    () => new PlaneGeometry(PLATE.width, PLATE.height),
    [],
  );
  /** Unit quad, scaled per instance into a hairline of the right length. */
  const ruleGeometry = useMemo(() => new PlaneGeometry(1, 1), []);
  const sealGeometry = useMemo(() => new TorusGeometry(1, 0.16, 4, 28), []);

  /*
    Shared by both instanced meshes. Additive, so an instance colour of black
    is genuinely absent rather than a dark shape sitting on the backdrop --
    which is what lets one material carry the whole ring's worth of brightness.
  */
  const markMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        blending: AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );

  const markColor = useMemo(() => new Color(color), [color]);

  useEffect(
    () => () => {
      portraits.forEach((texture) => texture.dispose());
      plates.forEach((texture) => texture.dispose());
      portraitMaterials.forEach((material) => material.dispose());
      plateMaterials.forEach((material) => material.dispose());
      portraitGeometry.dispose();
      plateGeometry.dispose();
      ruleGeometry.dispose();
      sealGeometry.dispose();
      markMaterial.dispose();
    },
    [
      portraits,
      plates,
      portraitMaterials,
      plateMaterials,
      portraitGeometry,
      plateGeometry,
      ruleGeometry,
      sealGeometry,
      markMaterial,
    ],
  );

  useFrame(() => {
    const cursor = getCursor();
    const reveal = getReveal();

    if (turntable.current) turntable.current.rotation.y = -cursor * step;

    for (let i = 0; i < count; i++) {
      // Signed distance from the front of the ring, in stations, taking the
      // short way round so a record entering from the right is not treated as
      // nine stations away.
      let offset = i - cursor;
      if (offset > count / 2) offset -= count;
      if (offset < -count / 2) offset += count;

      const focus = smoothstep(FOCUS_SPAN, 0, Math.abs(offset));
      /*
        Records turning away dim out before the plane would edge on and
        vanish. The band is tight enough that only the immediate neighbours
        are lit at a rest position -- enough to say the roster continues in
        both directions, and no more.
      */
      const facing = smoothstep(0.3, 0.74, Math.cos(offset * step));
      const enter = clamp((reveal - i * REVEAL_STAGGER) / REVEAL_RISE);
      const presence = enter * facing;

      const { angle, sin, cos } = ring[i];
      const push = radius + focus * FOCUS_PUSH;
      const rise = (1 - enter) * -RISE;

      const station = stations.current[i];
      if (station) {
        station.visible = presence > 0.004;
        station.position.set(sin * push, rise, cos * push);
        station.rotation.y = angle;
      }

      const figure = figures.current[i];
      if (figure) {
        const material = figure.material as MeshBasicMaterial;
        material.opacity = presence;
        material.color.setScalar(DIM + (1 - DIM) * focus);
      }

      const caption = captions.current[i];
      if (caption) {
        // Squared, so only the record actually being introduced carries a
        // name. Two legible names at once reads as a caption that has lost
        // its subject.
        (caption.material as MeshBasicMaterial).opacity =
          presence * focus * focus;
      }

      if (rules.current) {
        dummy.position.set(sin * push, RULE_Y + rise, cos * push);
        dummy.rotation.set(0, angle, 0);
        dummy.scale.set(RULE_MIN + RULE_MAX * focus, RULE_THICKNESS, 1);
        dummy.updateMatrix();
        rules.current.setMatrixAt(i, dummy.matrix);
        tint.copy(markColor).multiplyScalar(presence * (0.16 + 0.84 * focus));
        rules.current.setColorAt(i, tint);
      }

      if (seals.current) {
        // The seal completes late, after the rule has drawn out: the record is
        // read first and marked second, which is the order it means.
        const seal = SEAL_RADIUS * smoothstep(0.3, 0.92, focus);
        dummy.position.set(sin * push, RULE_Y + rise, cos * push);
        dummy.rotation.set(0, angle, 0);
        dummy.scale.setScalar(Math.max(seal, 1e-4));
        dummy.updateMatrix();
        seals.current.setMatrixAt(i, dummy.matrix);
        tint.copy(markColor).multiplyScalar(presence * focus);
        seals.current.setColorAt(i, tint);
      }
    }

    if (rules.current) {
      rules.current.instanceMatrix.needsUpdate = true;
      if (rules.current.instanceColor) {
        rules.current.instanceColor.needsUpdate = true;
      }
    }
    if (seals.current) {
      seals.current.instanceMatrix.needsUpdate = true;
      if (seals.current.instanceColor) {
        seals.current.instanceColor.needsUpdate = true;
      }
    }
  });

  return (
    <group ref={turntable}>
      {members.map((member, i) => (
        <group
          key={member.slug}
          ref={(node) => {
            stations.current[i] = node;
          }}
          visible={false}
        >
          <mesh
            ref={(node) => {
              figures.current[i] = node;
            }}
            geometry={portraitGeometry}
            material={portraitMaterials[i]}
            position={[0, PORTRAIT.y, 0]}
            renderOrder={2}
          />
          <mesh
            ref={(node) => {
              captions.current[i] = node;
            }}
            geometry={plateGeometry}
            material={plateMaterials[i]}
            position={[0, PLATE.y, 0]}
            renderOrder={3}
          />
        </group>
      ))}

      <instancedMesh
        ref={rules}
        args={[ruleGeometry, markMaterial, count]}
        frustumCulled={false}
        renderOrder={3}
      />
      <instancedMesh
        ref={seals}
        args={[sealGeometry, markMaterial, count]}
        frustumCulled={false}
        renderOrder={4}
      />
    </group>
  );
}
