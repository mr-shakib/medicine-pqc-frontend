import { accent, type AccentFamily } from '@/lib/design/tokens';

/**
 * The narrative spine of the site. Everything -- the DOM sections, the scroll
 * ranges, the camera keyframes, the progress rail and the 3D scene router --
 * derives from this one array. Adding or reordering a scene is a one-file change.
 */
export interface SceneDefinition {
  /** Stable slug, used for anchors and React keys. */
  id: string;
  /** Zero-based order. */
  index: number;
  /** Short label for the navigation rail. */
  label: string;
  /** Headline shown in the DOM overlay. */
  title: string;
  /** Supporting line under the headline. */
  subtitle?: string;
  /** Body copy. Omitted on statement chapters. */
  body?: string;
  /** Accent family driving the DOM overlay, scene lighting and backdrop pool. */
  accent: AccentFamily;
  /** World-space position of this scene's subject matter. */
  anchor: readonly [number, number, number];
  /** Camera position offset from `anchor` on desktop. */
  cameraOffset: readonly [number, number, number];
  /** Camera position offset from `anchor` on portrait/mobile viewports. */
  mobileCameraOffset: readonly [number, number, number];
  /**
   * How many viewport heights of scroll this chapter occupies. Defaults to 1.
   * A chapter that needs room to breathe -- the opening dolly, say -- takes
   * more, and everything downstream (section height, progress mapping, camera
   * key placement) follows from this one number.
   */
  scrollWeight?: number;
  /**
   * Where inside its own scroll band the camera reaches this chapter's
   * keyframe, as a fraction 0 -> 1. Defaults to 0, meaning the camera is on its
   * mark the instant the section is framed. The opening uses a later arrival so
   * there is room for a long approach before it settles.
   */
  cameraArrival?: number;
  /**
   * An optional departure mark, taken after the chapter has been held.
   *
   * Without one the camera heads straight from a chapter's mark to the next,
   * which on a chapter viewed head-on means flying THROUGH the subject. A
   * departure lifts the camera clear first, and gives the exit a deliberate
   * shape instead of a straight line.
   *
   * `at` is a fraction of the chapter's own scroll band; `offset` is relative
   * to the chapter anchor, like `cameraOffset`.
   */
  cameraExit?: {
    at: number;
    offset: readonly [number, number, number];
    mobileOffset?: readonly [number, number, number];
  };
  /**
   * Render the title as a wide-tracked uppercase statement and suppress body
   * copy. Reserved for moments that should carry a single line and nothing else.
   */
  statement?: boolean;
}

export const SCENES: readonly SceneDefinition[] = [
  {
    id: 'medicine-core',
    index: 0,
    label: 'Core',
    title: 'Every medicine\nhas an identity.',
    accent: 'pharma',
    anchor: [0, 0, 0],
    // The arrival mark. Held back deliberately: the core must read as a small
    // object in a large dark space, not fill the frame. Presence here comes
    // from the light and the surrounding emptiness, not from scale.
    cameraOffset: [0, 0.3, 7.5],
    mobileCameraOffset: [0, 0.2, 10],
    // Two viewport heights, so the approach has somewhere to happen.
    scrollWeight: 2,
    // The camera settles on the core just before its copy begins to scroll
    // away, so the composed frame -- statement plus resolved core -- is held
    // for a beat before anything moves on.
    cameraArrival: 0.4,
    // Then it lifts back and up, keeping the core in view as it leaves rather
    // than driving straight through it on the way to chapter 02.
    cameraExit: {
      at: 0.68,
      offset: [1.8, 2.5, 8.5],
      mobileOffset: [0.6, 2, 11],
    },
    statement: true,
  },
  {
    id: 'capsule-formation',
    index: 1,
    label: 'Capsule',
    title: 'From identity\nto authentic medicine.',
    accent: 'pharma',
    /*
      Deliberately the SAME anchor as chapter 01.

      The capsule has to form around the core the viewer has just watched
      resolve -- which means it must be the same object in the same place, not
      a copy waiting further down the corridor. Co-locating turns the chapter
      transition into an orbit rather than a flight, which is both seamless and
      the movement the formation needs to read as an assembly.
    */
    anchor: [0, 0, 0],
    /*
      ~40 degrees around from chapter 01's mark, and notably further out.

      The standoff is set by the STAGING spread in the scene, not by the sealed
      capsule: the halves start roughly 3 world units off-axis, and the frame
      has to hold both of them at the moment they appear or the assembly reads
      as objects entering from nowhere.
    */
    cameraOffset: [7.1, 1.6, 8.4],
    // Portrait needs extra standoff here, not less: the mobile framing offset
    // already lifts the subject by ~30% of the half-height, and that stacks on
    // top of the staging spread. Without the extra distance the cap clips out
    // of the top of frame at the moment it appears.
    mobileCameraOffset: [7.7, 1.5, 9.2],
    // Two viewport heights: six distinct beats need room to breathe.
    scrollWeight: 2,
    cameraArrival: 0.2,
    // The orbit continues past the seal, holding the finished capsule in view.
    cameraExit: {
      at: 0.6,
      offset: [9.8, 2.3, 6.1],
      mobileOffset: [10.6, 2, 6.6],
    },
    statement: true,
  },
  {
    id: 'capsule-to-tablet',
    index: 2,
    label: 'Tablet',
    title: 'Different forms.\nOne trusted identity.',
    accent: 'pharma',
    anchor: [10, 1, -48],
    /*
      The close mark. The transformation is the chapter, so the camera comes in
      for it — near enough that individual particles resolve as fragments
      rather than dissolving into a haze.
    */
    cameraOffset: [-2.4, 0.9, 6.2],
    mobileCameraOffset: [-1.2, 0.7, 8.6],
    // Two viewport heights: eleven beats need the room.
    scrollWeight: 2,
    /*
      The camera is on its mark almost as soon as the chapter is framed, and
      holds there for the whole transformation. The approach itself covers the
      earlier rotation beats — but the dissolve, the flight and the reforming
      all need a steady frame, or the most detailed moment in the piece plays
      out while the camera is still travelling.
    */
    cameraArrival: 0.05,
    // Then it eases back as the tablet solidifies, giving the resolved object
    // air to sit in.
    cameraExit: {
      at: 0.5,
      offset: [-3, 1.4, 8.2],
      mobileOffset: [-1.6, 1.1, 11.4],
    },
    statement: true,
  },
  {
    id: 'tablet-to-serum',
    index: 3,
    label: 'Serum',
    title: 'Medicine may change form.\nAuthenticity must remain.',
    accent: 'pharma',
    anchor: [4, 3.5, -96],
    // The close mark, held steady for the whole transformation.
    cameraOffset: [-3, 0.6, 5.8],
    mobileCameraOffset: [-1.6, 0.5, 8.4],
    scrollWeight: 2,
    cameraArrival: 0.05,
    // The reveal: a lift and a pull back once the vial is whole.
    cameraExit: {
      at: 0.55,
      offset: [-4.6, 1.5, 8.4],
      mobileOffset: [-2.4, 1.2, 11.6],
    },
    statement: true,
  },
  {
    id: 'product-convergence',
    index: 4,
    label: 'Forms',
    title: 'One system.\nEvery form.',
    /*
      Pharma, not alert.

      This chapter used to carry the counterfeit-scale beat, which is why it was
      the palette's one break to red. It is now a product composition with no
      security content, so the accent returns to the warm baseline — and the
      break to alert moves downstream with the threat itself.
    */
    accent: 'pharma',
    anchor: [-6, -2, -150],
    // The mid-distance mark the camera arrives on...
    cameraOffset: [1, 1.3, 7.6],
    mobileCameraOffset: [0.5, 1, 10.4],
    scrollWeight: 2,
    cameraArrival: 0.12,
    // ...before pulling back to the wide hero framing as the trio settles.
    cameraExit: {
      at: 0.62,
      offset: [1.8, 2.2, 10.4],
      mobileOffset: [1, 1.7, 14.2],
    },
    statement: true,
  },
  {
    id: 'ai-detection',
    index: 5,
    label: 'AI',
    title: 'AI analyzes.\nCounterfeits are detected.',
    accent: 'analysis',
    anchor: [8, 0, -204],
    /*
      Far enough back to hold the whole population at once.

      The point of this chapter is comparison — one product resolving as
      counterfeit only means something beside the ones that do not — so the
      framing has to keep every item in frame rather than favour a subject.
    */
    cameraOffset: [-2.2, 0.9, 12.6],
    mobileCameraOffset: [-1, 0.7, 16.5],
    scrollWeight: 2,
    cameraArrival: 0.05,
    cameraExit: {
      at: 0.6,
      offset: [-3.4, 1.6, 13.8],
      mobileOffset: [-1.6, 1.2, 18],
    },
    statement: true,
  },
  {
    id: 'pqc-protection',
    index: 6,
    label: 'PQC',
    title: 'Protected today.\nSecure for tomorrow.',
    accent: 'lattice',
    anchor: [-4, 4, -258],
    /*
      Far enough to hold the whole structure. This chapter's subject is not an
      object but an architecture, and an architecture only reads when you can
      see all of it at once.
    */
    cameraOffset: [3.2, -0.6, 15.5],
    mobileCameraOffset: [1.4, -0.4, 20],
    scrollWeight: 2,
    cameraArrival: 0.06,
    cameraExit: {
      at: 0.66,
      offset: [4.6, 1.2, 16.8],
      mobileOffset: [2, 0.8, 21.5],
    },
    statement: true,
  },
  {
    id: 'threat-detected',
    index: 7,
    label: 'Threat',
    title: 'Counterfeit detected.',
    /*
      The palette's one deliberate break to alert.

      Red has been held back for exactly this — it appears nowhere else in the
      piece except the two failed products in chapter 06 — so when the boundary
      refuses something, the colour itself carries the meaning before anything
      else is read.
    */
    accent: 'alert',
    anchor: [2, 2, -288],
    /*
      Wide enough to hold the protected volume AND the duplicate outside it.
      The whole point of the chapter is a spatial relationship — something is
      outside a boundary and stays outside — which cannot be read from a frame
      that only contains the inside.
    */
    cameraOffset: [-2.2, 1.1, 17.8],
    mobileCameraOffset: [-1.1, 0.8, 22.5],
    scrollWeight: 2,
    cameraArrival: 0.06,
    cameraExit: {
      at: 0.66,
      offset: [-3.4, 1.7, 18.8],
      mobileOffset: [-1.7, 1.2, 23.5],
    },
    statement: true,
  },
  {
    id: 'final',
    index: 8,
    label: 'Sealed',
    title: 'Verify.\nProtect.\nTrust.',
    subtitle:
      'AI-powered, post-quantum cryptography-enabled counterfeit medicine detection.',
    accent: 'verified',
    anchor: [0, 0, -314],
    cameraOffset: [1.4, 0.9, 14.5],
    mobileCameraOffset: [0.7, 0.7, 18.5],
    scrollWeight: 2,
    cameraArrival: 0.08,
    /*
      The last camera move in the piece: a slow lift and settle. It resolves
      rather than departs, because there is nothing after it to travel to.
    */
    cameraExit: {
      at: 0.7,
      offset: [1.9, 1.7, 15.6],
      mobileOffset: [0.9, 1.2, 19.6],
    },
    statement: true,
  },
] as const;

export const SCENE_COUNT = SCENES.length;

/* -------------------------------------------------------------------------- */
/* Progress space                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Chapters are not all the same length. Each has a `scrollWeight` in viewport
 * heights (default 1), so the scroll spine is the sum of those weights and a
 * chapter's DOM section is exactly that tall.
 *
 * The scrollable distance is one viewport shorter than the spine -- you cannot
 * scroll the last viewport past itself -- so with weights summing to W, global
 * progress 0 -> 1 covers (W - 1) viewport heights of travel. Chapter `i` is
 * framed when the scroll has covered `SCENE_OFFSETS[i]` of them.
 *
 * Everything downstream -- section heights, the chapter readout, scene-local
 * progress and camera key placement -- is derived from these three arrays, so
 * changing a weight is a one-field edit.
 */
const WEIGHTS: readonly number[] = SCENES.map((s) => s.scrollWeight ?? 1);

/** Cumulative viewport heights before each chapter. */
export const SCENE_OFFSETS: readonly number[] = (() => {
  const offsets: number[] = [];
  let total = 0;
  for (const weight of WEIGHTS) {
    offsets.push(total);
    total += weight;
  }
  return offsets;
})();

/** Total height of the scroll spine, in viewport heights. */
export const TOTAL_WEIGHT = WEIGHTS.reduce((sum, w) => sum + w, 0);

/** Scrollable distance, in viewport heights. */
export const SCROLL_SPAN = TOTAL_WEIGHT - 1;

/** Scroll weight of a chapter, in viewport heights. */
export const sceneWeight = (index: number): number => WEIGHTS[index];

/** Global progress at which chapter `index` is framed. */
export function sceneProgressAt(index: number): number {
  return SCENE_OFFSETS[index] / SCROLL_SPAN;
}

/**
 * Global progress -> continuous chapter position.
 *
 * An integer result means that chapter is exactly framed; 2.5 means halfway
 * between chapters 2 and 3. This is the coordinate every scene animates in.
 */
export function progressToSection(progress: number): number {
  const units = progress * SCROLL_SPAN;
  for (let i = SCENE_COUNT - 1; i >= 0; i--) {
    if (units >= SCENE_OFFSETS[i] || i === 0) {
      return i + (units - SCENE_OFFSETS[i]) / WEIGHTS[i];
    }
  }
  return 0;
}

/**
 * The chapter the viewport is currently showing.
 *
 * A chapter's copy is pinned (sticky) for all but the last viewport height of
 * its band, then scrolls away. So the readout should flip when that copy is
 * half off screen, which is `(w - 0.5) / w` of the way through the band -- for
 * a single-weight chapter that is the halfway point, and for the two-viewport
 * opening it is three quarters. Rounding the raw position instead would flip
 * the opening to chapter 02 while its statement was still fully on screen.
 */
export function sceneAt(progress: number): number {
  const position = progressToSection(progress);
  const band = Math.min(Math.max(Math.floor(position), 0), SCENE_COUNT - 1);
  const weight = WEIGHTS[band];
  const flip = (weight - 0.5) / weight;
  const index = position - band < flip ? band : band + 1;
  return index < 0 ? 0 : index > SCENE_COUNT - 1 ? SCENE_COUNT - 1 : index;
}

/**
 * Scene-local progress, 0 -> 1. Unclamped, so callers can tell "approaching"
 * from "arrived".
 *
 * An interior chapter animates across a window centred on the moment it is
 * framed: local 0 half a chapter before, 0.5 when framed, 1 half a chapter
 * after. The FIRST and LAST chapters have no scroll room on their outer side --
 * you cannot scroll above the top of the page -- so their windows are shifted
 * inward to lie entirely within the spine. Without that shift the opening
 * chapter would begin life at local 0.5 and half its timeline would be
 * unreachable.
 */
export function sceneLocalRaw(progress: number, index: number): number {
  const section = progressToSection(progress);
  if (index === 0) return section;
  if (index === SCENE_COUNT - 1) return section - (SCENE_COUNT - 2);
  return section - index + 0.5;
}

/** Signed distance from a chapter, in chapters. */
export function sceneDistance(progress: number, index: number): number {
  return progressToSection(progress) - index;
}

/** Hex string of a chapter's base accent colour. */
export function sceneAccent(index: number): string {
  return accent[SCENES[index].accent].base;
}
