'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import {
  AdditiveBlending,
  Color,
  NormalBlending,
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
import { accent, mark, neutral } from '@/lib/design/tokens';
import { clamp, damp, frameDelta, lerp, smoothstep } from '@/lib/math';
import { dossierStore, openDossier, settleDossier } from '@/lib/dossierStore';
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

/* -------------------------------------------------------------------------- */
/* Selection                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * How square-on a record must be before it answers the pointer.
 *
 * Only the record being introduced is clickable. The neighbours are dim,
 * partly behind the copy column and partly off the frame edge; making them
 * targets would mean a click landing on someone the viewer cannot properly
 * see, and the pointer cursor would flicker on as the ring swept a face past
 * the edge of the screen.
 */
const INTERACT_FOCUS = 0.4;

/** Fraction of the opening move left after one second. ~0.5s to settle. */
const DOSSIER_DAMP = 0.0022;
const HOVER_DAMP = 0.0008;

/**
 * Where the opened record stands.
 *
 * Set against the camera mark in `lib/scenes`, and off to one side of it: the
 * compositional offset in the rig already pushes the subject right of centre,
 * so a hero mark on the world axis would land under the dossier panel. These
 * put the figure in the left third on a landscape viewport and in the upper
 * band on a portrait one, which is the half of the frame the panel leaves.
 */
const HERO = {
  landscape: { x: -2.7, y: 0.15, z: 5.6, scale: 1.3, yaw: 0.46 },
  portrait: { x: 0, y: -0.05, z: 6.4, scale: 0.95, yaw: 0 },
} as const;

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
 * Clicking the record being introduced opens its dossier: it leaves the ring
 * for a mark in front of the camera while the other nine sink and fade, and
 * the DOM panel wipes in beside it. The move is entirely in this component --
 * no camera state is touched -- because the lens is shared with the whole
 * corridor and a chapter that reached into it would have to put it back.
 *
 * Every station is placed at its own WORLD angle rather than by rotating a
 * parent group. Rotating the parent is a line shorter, but it means a record
 * leaving the ring has to have the parent's rotation undone out of both its
 * position and its facing before it can be blended toward a fixed mark, and
 * the arithmetic for that is worse than just placing ten stations directly.
 *
 * Ten records, one draw call each for the figure and the name and two
 * instanced draws for every rule and seal in the ring. Scrolling writes
 * transforms, opacities and instance colours, and nothing else.
 */
export default function TeamRegistry({
  members,
  radius = 4.6,
  getCursor,
  getReveal,
  color = accent.pharma.ink,
}: TeamRegistryProps) {
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
  /** Portrait viewports put the panel below the figure rather than beside it. */
  const isPortrait = useThree((state) => state.size.height > state.size.width);

  const count = members.length;
  const step = (Math.PI * 2) / count;

  /** Per-station focus, published for the pointer handlers to gate on. */
  const focusOf = useRef<Float32Array>(new Float32Array(count));
  /** Per-station hover, damped so the lift is not a step. */
  const hoverOf = useRef<Float32Array>(new Float32Array(count));

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
    Shared by both instanced meshes, and the one place the instance colour has
    to mean two different things.

    On a dark ground the blending is additive, so an instance colour of black
    is genuinely absent and scaling the colour scales the mark's brightness. On
    a light ground black would be a black mark, so the scaling has to move the
    OPACITY instead -- which is what the ink mix below does, lerping each
    instance from the ground colour up to the ink rather than from black up to
    the glow.
  */
  const markMaterial = useMemo(
    () =>
      new MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        blending: mark.additive ? AdditiveBlending : NormalBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    [],
  );

  const markColor = useMemo(() => new Color(color), [color]);
  /** What "absent" looks like: black under additive, the ground under normal. */
  const markVoid = useMemo(
    () => new Color(mark.additive ? '#000000' : neutral.n00),
    [],
  );

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

  /* ---------------------------------------------------------------------- */
  /* Pointer                                                                 */
  /* ---------------------------------------------------------------------- */

  /** A record answers the pointer only while it is the one being introduced. */
  const interactive = useCallback(
    (i: number) => focusOf.current[i] > INTERACT_FOCUS && dossierStore.target === 0,
    [],
  );

  const handleOver = useCallback(
    (i: number) => (event: ThreeEvent<PointerEvent>) => {
      if (!interactive(i)) return;
      event.stopPropagation();
      dossierStore.hover = i;
      document.body.style.cursor = 'pointer';
    },
    [interactive],
  );

  const handleOut = useCallback(
    (i: number) => () => {
      if (dossierStore.hover !== i) return;
      dossierStore.hover = -1;
      document.body.style.cursor = '';
    },
    [],
  );

  const handleClick = useCallback(
    (i: number) => (event: ThreeEvent<MouseEvent>) => {
      if (!interactive(i)) return;
      event.stopPropagation();
      dossierStore.hover = -1;
      document.body.style.cursor = '';
      openDossier(i);
    },
    [interactive],
  );

  // The cursor is set on the document, so it has to be given back if this
  // unmounts while a record is hovered.
  useEffect(() => () => {
    document.body.style.cursor = '';
  }, []);

  /* ---------------------------------------------------------------------- */
  /* Frame                                                                   */
  /* ---------------------------------------------------------------------- */

  useFrame((_, delta) => {
    const dt = frameDelta(delta);

    dossierStore.amount = damp(
      dossierStore.amount,
      dossierStore.target,
      DOSSIER_DAMP,
      dt,
    );
    /*
      A record on its way out hands over as soon as it is nearly home. A swap
      waits only until the outgoing one has mostly returned, so stepping
      through the roster reads as one continuous exchange rather than as a
      close followed by an open; a genuine dismissal runs all the way down.
    */
    const handover = dossierStore.pending >= 0 ? 0.22 : 0.002;
    if (dossierStore.target === 0 && dossierStore.amount < handover) {
      if (dossierStore.pending < 0) dossierStore.amount = 0;
      settleDossier();
    }

    const open = dossierStore.amount;
    const selected = dossierStore.index;
    const hero = isPortrait ? HERO.portrait : HERO.landscape;

    const reveal = getReveal();
    /*
      The turntable stops as a record leaves it. `cursor` was captured at the
      moment of the click, so the ring holds the station the record came from
      and can put it back exactly there.
    */
    const cursor = lerp(getCursor(), dossierStore.cursor, smoothstep(0, 0.4, open));

    for (let i = 0; i < count; i++) {
      // Signed distance from the front of the ring, in stations, taking the
      // short way round so a record entering from the right is not treated as
      // nine stations away.
      let offset = i - cursor;
      if (offset > count / 2) offset -= count;
      if (offset < -count / 2) offset += count;

      const angle = offset * step;
      const sin = Math.sin(angle);
      const cos = Math.cos(angle);

      const focus = smoothstep(FOCUS_SPAN, 0, Math.abs(offset));
      focusOf.current[i] = focus;

      /*
        Records turning away dim out before the plane would edge on and
        vanish. The band is tight enough that only the immediate neighbours
        are lit at a rest position -- enough to say the roster continues in
        both directions, and no more.
      */
      const facing = smoothstep(0.3, 0.74, cos);
      const enter = clamp((reveal - i * REVEAL_STAGGER) / REVEAL_RISE);

      const wantHover =
        dossierStore.hover === i && dossierStore.target === 0 ? 1 : 0;
      hoverOf.current[i] = damp(hoverOf.current[i], wantHover, HOVER_DAMP, dt);
      const hovered = hoverOf.current[i];

      const isSelected = i === selected;
      /** How far this record has travelled to its hero mark. */
      const stage = isSelected ? open : 0;
      /** How far the rest of the ring has been cleared away. */
      const cleared = isSelected ? 0 : open;

      const push = radius + (focus * FOCUS_PUSH + hovered * 0.12) * (1 - stage);
      const rise = (1 - enter) * -RISE;

      const x = lerp(sin * push, hero.x, stage);
      const y = lerp(rise + hovered * 0.05, hero.y, stage);
      const z = lerp(cos * push, hero.z, stage);
      const yaw = lerp(angle, hero.yaw, stage);
      const scale = lerp(1, hero.scale, stage);

      /*
        Presence, with the opened record exempt from the facing cull. A record
        selected from the keyboard roster can be anywhere on the ring,
        including behind it; it has to survive the flight to the front rather
        than wink out on the way.
      */
      const presence = lerp(enter * facing, enter, stage) * (1 - cleared);

      const station = stations.current[i];
      if (station) {
        station.visible = presence > 0.004;
        station.position.set(x, y - cleared * 0.7, z);
        station.rotation.y = yaw;
        station.scale.setScalar(scale);
      }

      const figure = figures.current[i];
      if (figure) {
        const material = figure.material as MeshBasicMaterial;
        /*
          How a record RECEDES depends on what it is receding into.

          Against the dark chamber a photograph steps back by going dark, so
          the multiplier on its colour is the whole effect and it dissolves
          into the ground. On paper that same multiplier is the opposite of
          receding: it turns an unfocused neighbour into the heaviest, blackest
          shape on the page. There it has to fade out instead -- toward the
          ground, which is what receding has always meant.
        */
        const lit = Math.min(
          1,
          DIM + (1 - DIM) * Math.max(focus, stage) + hovered * 0.14,
        );
        material.color.setScalar(mark.additive ? lit : 1);
        material.opacity = presence * (mark.additive ? 1 : lit);
      }

      const caption = captions.current[i];
      if (caption) {
        // Squared, so only the record actually being introduced carries a
        // name. Two legible names at once reads as a caption that has lost
        // its subject. It fades out entirely once the dossier is up, which
        // sets the same name in the panel at ten times the size.
        (caption.material as MeshBasicMaterial).opacity =
          presence * focus * focus * (1 - smoothstep(0, 0.35, stage));
      }

      /*
        The rule and seal ride with the record, and hand over as the dossier
        opens: the panel sets the same record number under a rule of its own,
        and two marks for one record is one too many. Drawn out at this scale
        the 3D one also runs most of the way across the frame, at the slight
        keystone the compositional offset views it from, which reads as a
        stray line rather than as an annotation.
      */
      const markY = y - cleared * 0.7 + RULE_Y * scale;
      const emphasis = focus;
      const marked = 1 - smoothstep(0, 0.4, stage);

      if (rules.current) {
        dummy.position.set(x, markY, z);
        dummy.rotation.set(0, yaw, 0);
        dummy.scale.set(
          (RULE_MIN + RULE_MAX * emphasis) * scale,
          RULE_THICKNESS,
          1,
        );
        dummy.updateMatrix();
        rules.current.setMatrixAt(i, dummy.matrix);
        tint
          .copy(markVoid)
          .lerp(
            markColor,
            presence * marked * (0.16 + 0.84 * emphasis + hovered * 0.2),
          );
        rules.current.setColorAt(i, tint);
      }

      if (seals.current) {
        // The seal completes late, after the rule has drawn out: the record is
        // read first and marked second, which is the order it means.
        const seal = SEAL_RADIUS * smoothstep(0.3, 0.92, emphasis) * scale;
        dummy.position.set(x, markY, z);
        dummy.rotation.set(0, yaw, 0);
        dummy.scale.setScalar(Math.max(seal, 1e-4));
        dummy.updateMatrix();
        seals.current.setMatrixAt(i, dummy.matrix);
        tint.copy(markVoid).lerp(markColor, presence * marked * emphasis);
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
    <group>
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
            onPointerOver={handleOver(i)}
            onPointerOut={handleOut(i)}
            onClick={handleClick(i)}
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
