import { accent, type AccentFamily, type AccentStep } from '@/lib/design/tokens';
import { clamp } from '@/lib/math';
import { TEAM_COUNT } from '@/lib/team';

/**
 * The narrative spine of the site. Everything -- the DOM sections, the scroll
 * ranges, the camera keyframes, the progress rail, the light rig and the 3D
 * scene router -- derives from this one array. Adding or reordering a scene is
 * a one-file change.
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
   * Everything downstream (section height, progress mapping, camera key
   * placement) follows from this one number.
   */
  scrollWeight?: number;
  /**
   * Where inside its own scroll band the camera reaches this chapter's
   * keyframe, as a fraction 0 -> 1. Defaults to 0, meaning the camera is on its
   * mark the instant the section is framed.
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
   * How far away, in chapters, this chapter is still drawn. Defaults to
   * `DEFAULT_DRAW_RADIUS`. The opening needs more: chapter 02 seals a capsule
   * around its core, so the core has to stay on screen well into that chapter.
   */
  drawRadius?: number;
  /**
   * The chapter's close accent light, in WORLD units relative to the anchor.
   *
   * Declared here rather than mounted inside the chapter so the number of
   * lights in the scene never changes. Three bakes the light count into every
   * shader, so a light that appears or disappears mid-scroll recompiles every
   * material on screen -- a stall exactly where it is most visible. The rig in
   * `lib/lightRig` holds a fixed pool of two and points them at the two
   * nearest chapters instead.
   */
  accentLight?: {
    offset: readonly [number, number, number];
    /**
     * Which step of the chapter's own accent family to use.
     *
     * A step rather than a resolved colour: this array is evaluated once, when
     * the module is first imported, and a hex frozen in at that moment would
     * still be the first palette's after a theme change. The family is already
     * on the chapter, so naming the step says everything and can be resolved
     * whenever it is actually needed.
     */
    step: AccentStep;
    intensity: number;
    distance: number;
  };
  /**
   * Render the title as a wide-tracked uppercase statement and suppress body
   * copy. Reserved for moments that should carry a single line and nothing else.
   */
  statement?: boolean;
}

/** How far away, in chapters, a chapter is drawn unless it says otherwise. */
export const DEFAULT_DRAW_RADIUS = 0.85;

/*
  Chapter length.

  The whole story is a hook: it has to land before the viewer's patience does.
  Every chapter is therefore a little under two viewport heights -- enough for
  its beats to read, and no longer -- and the two book-ends are shorter still,
  since the opening is mostly approach and the ending mostly hold. The seven
  story chapters come to under twelve viewport heights between them.

  Weights are uniform on purpose. Chapters of different lengths make the same
  scroll gesture cover different amounts of story, which reads as the pace
  changing from chapter to chapter. The one chapter that breaks the rule is the
  registry below, and it breaks it because it is a roster rather than a beat.
*/
const CHAPTER_WEIGHT = 1.75;
const BOOKEND_WEIGHT = 1.5;

/*
  The team registry is the one chapter that is not a single beat.

  Every other chapter shows one thing happening; this one introduces ten
  people, and a roster read faster than it can be read is not an introduction.
  Its length is therefore derived from the roster rather than fixed: a lead-in
  and a hold, plus a fixed slice of scroll per person, so adding or removing a
  member changes the chapter's length instead of its pace.

  The slice is deliberately tight. At 0.3 viewport heights each, ten records
  cost three viewport heights -- real length in a piece built to be short, and
  the reason the registry keeps its own detented easing: the ring rests on each
  face and moves quickly between them, rather than sweeping past all ten at one
  uniform speed.
*/
const REGISTRY_LEAD_IN = 1.5;
const REGISTRY_PER_MEMBER = 0.3;

/**
 * Where inside the registry's own band the turntable turns, as fractions of it.
 *
 * Here rather than in the chapter because two things outside the chapter need
 * it: `progressForRecord` below, which a deep link into one person's dossier
 * uses to put the scroll where that record is at the front before it opens.
 * Everything else about scroll space is already resolved in this file, and a
 * second copy of these two numbers in the scene would be a second thing to
 * keep in step.
 */
export const REGISTRY_WINDOW = { from: 0.08, to: 0.9 } as const;

export const SCENES: readonly SceneDefinition[] = [
  {
    id: 'medicine-core',
    index: 0,
    label: 'Core',
    title: 'Every medicine\nhas an identity.',
    accent: 'pharma',
    anchor: [0, 0, 0],
    // The arrival mark. Held back deliberately: the core must read as a small
    // object in a large dark space, not fill the frame.
    cameraOffset: [0, 0.3, 7.5],
    mobileCameraOffset: [0, 0.2, 10],
    scrollWeight: BOOKEND_WEIGHT,
    // The camera settles on the core while its statement is still on screen.
    cameraArrival: 0.4,
    // Then it lifts back and up, keeping the core in view as it leaves rather
    // than driving straight through it on the way to chapter 02.
    cameraExit: {
      at: 0.68,
      offset: [1.8, 2.5, 8.5],
      mobileOffset: [0.6, 2, 11],
    },
    // Stays drawn until the capsule has sealed around it.
    drawRadius: 1.45,
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
      transition into an orbit rather than a flight.
    */
    anchor: [0, 0, 0],
    // ~40 degrees around from chapter 01's mark, and far enough out to hold
    // both halves at their staging marks.
    cameraOffset: [7.1, 1.6, 8.4],
    mobileCameraOffset: [7.7, 1.5, 9.2],
    scrollWeight: CHAPTER_WEIGHT,
    cameraArrival: 0.2,
    // The orbit continues past the seal, holding the finished capsule in view.
    cameraExit: {
      at: 0.6,
      offset: [9.8, 2.3, 6.1],
      mobileOffset: [10.6, 2, 6.6],
    },
    // The seam flash. Intensity is written per frame by the chapter through
    // `lightRig.boost`; the definition only fixes where and what colour.
    accentLight: {
      offset: [0, 0, 0],
      step: 'glow',
      intensity: 0,
      distance: 9,
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
    // The close mark: near enough that individual particles resolve as
    // fragments rather than dissolving into a haze.
    cameraOffset: [-2.4, 0.9, 6.2],
    mobileCameraOffset: [-1.2, 0.7, 8.6],
    scrollWeight: CHAPTER_WEIGHT,
    // On its mark almost at once, and steady for the whole transformation.
    cameraArrival: 0.05,
    // Then it eases back as the tablet solidifies.
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
    cameraOffset: [-3, 0.6, 5.8],
    mobileCameraOffset: [-1.6, 0.5, 8.4],
    scrollWeight: CHAPTER_WEIGHT,
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
    id: 'ai-detection',
    index: 4,
    label: 'AI',
    title: 'AI analyzes.\nCounterfeits are detected.',
    accent: 'analysis',
    anchor: [8, 0, -150],
    // Far enough back to hold the whole population at once: one product
    // resolving as counterfeit only means something beside the ones that do not.
    cameraOffset: [-2.2, 0.9, 12.6],
    mobileCameraOffset: [-1, 0.7, 16.5],
    scrollWeight: CHAPTER_WEIGHT,
    cameraArrival: 0.05,
    cameraExit: {
      at: 0.6,
      offset: [-3.4, 1.6, 13.8],
      mobileOffset: [-1.6, 1.2, 18],
    },
    // One cool source, so the analysis reads as a different kind of light from
    // the warm product rig that precedes it.
    accentLight: {
      offset: [-2.7, 1.1, 6.1],
      step: 'light',
      intensity: 9,
      distance: 12,
    },
    statement: true,
  },
  {
    id: 'pqc-protection',
    index: 5,
    label: 'PQC',
    title: 'Protected today.\nSecure for tomorrow.',
    accent: 'lattice',
    anchor: [-4, 4, -204],
    // Far enough to hold the whole structure: an architecture only reads when
    // you can see all of it at once.
    cameraOffset: [3.2, -0.6, 15.5],
    mobileCameraOffset: [1.4, -0.4, 20],
    scrollWeight: CHAPTER_WEIGHT,
    cameraArrival: 0.06,
    cameraExit: {
      at: 0.66,
      offset: [4.6, 1.2, 16.8],
      mobileOffset: [2, 0.8, 21.5],
    },
    accentLight: {
      offset: [3.2, 2.8, 6],
      step: 'light',
      intensity: 8,
      distance: 12,
    },
    statement: true,
  },
  {
    id: 'final',
    index: 6,
    label: 'Sealed',
    title: 'Verify.\nProtect.\nTrust.',
    subtitle:
      'AI-powered, post-quantum cryptography-enabled counterfeit medicine detection.',
    accent: 'verified',
    anchor: [0, 0, -258],
    cameraOffset: [1.4, 0.9, 14.5],
    mobileCameraOffset: [0.7, 0.7, 18.5],
    scrollWeight: BOOKEND_WEIGHT,
    cameraArrival: 0.06,
    /*
      A slow lift and settle, taken LATE in the band.

      This is the story's resolution, and the chapter after it is a coda rather
      than another beat, so the lens has no reason to leave early. Departing at
      a third of the way through -- which is where this sat while this chapter
      was the last one, and the whole band after it unscrollable -- left the
      camera crossing fifty empty units with nothing on screen at either end.
      Holding until the assembly is nearly out of draw range closes that gap to
      a single flight.
    */
    cameraExit: {
      at: 0.62,
      offset: [1.9, 1.7, 15.6],
      mobileOffset: [0.9, 1.2, 19.6],
    },
    accentLight: {
      offset: [-2.55, 2.4, 5.1],
      step: 'light',
      intensity: 7,
      distance: 11,
    },
    statement: true,
  },
  {
    id: 'team',
    index: 7,
    label: 'Team',
    title: 'The people\nbehind the signature.',
    subtitle:
      'Sub-Project A-71 · ICSETEP — Department of Computer Science and Engineering, Daffodil International University.',
    /*
      Warm, and the same family the piece opened on.

      The three chapters before this one run cool -- instrument blue, then
      indigo, then sage -- because they are about machines reading and
      mathematics sealing. Coming back to the pharmaceutical warm for the
      people closes the arc, and it is the only accent in the system that
      flatters a photograph of a face.
    */
    accent: 'pharma',
    /*
      Set off to one side, and closer than the ~54 units the corridor otherwise
      keeps between chapters.

      The lateral offset is the important half. Every chapter in the corridor
      is displaced in x and y from the one before it, and the reason is this
      exact flight: a chapter sitting squarely behind its predecessor means the
      camera crosses the predecessor's own position on the way, flying THROUGH
      the assembly it just resolved -- which is what it did here at [0, 0, -312],
      passing inside the lattice and out the back of it. Offset, the camera
      passes beside chapter 07 instead, holding it in the corner of the frame
      as it leaves.

      The shorter run is the other half. This is the only chapter the camera
      approaches with nothing to look at on the way -- chapter 07 at least had
      chapter 06's lattice to arrive into -- so the gap is pulled in until the
      ring comes out of the fog while the previous chapter is still drawn.
    */
    anchor: [12, -3, -294],
    /*
      The camera barely moves in this chapter, which is the point: the registry
      is a turntable, and a lens that also travels would make it impossible to
      tell which of the two is turning. The mark sits far enough out that the
      front record's name plate reads at close to texture resolution, and near
      enough that its neighbours still flank it.
    */
    cameraOffset: [0, 0.2, 11],
    mobileCameraOffset: [0, 0.15, 11.6],
    scrollWeight: REGISTRY_LEAD_IN + TEAM_COUNT * REGISTRY_PER_MEMBER,
    cameraArrival: 0.04,
    /*
      A lift so slight it reads as breath rather than as a move. It is here at
      all because the path needs a final key to take its closing tangent from;
      without one the camera would come to rest on the arrival mark and the
      last chapter of the piece would be the only one the lens never touches.
    */
    cameraExit: {
      at: 0.78,
      offset: [0.35, 0.62, 11.7],
      mobileOffset: [0.15, 0.45, 12.3],
    },
    statement: true,
  },
] as const;

export const SCENE_COUNT = SCENES.length;

/* -------------------------------------------------------------------------- */
/* Progress space                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Each chapter has a `scrollWeight` in viewport heights, so the scroll spine
 * is the sum of those weights and a chapter's DOM section is exactly that tall.
 *
 * The scrollable distance is one viewport shorter than the spine -- you cannot
 * scroll the last viewport past itself -- so with weights summing to W, global
 * progress 0 -> 1 covers (W - 1) viewport heights of travel. Chapter `i` is
 * framed when the scroll has covered `SCENE_OFFSETS[i]` of them, and the last
 * chapter absorbs the viewport that can never be scrolled past.
 *
 * Everything downstream -- section heights, the chapter readout, scene-local
 * progress and camera key placement -- is derived from these arrays, so
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
 * its band, then scrolls away. So the readout flips when that copy is half off
 * screen, which is `(w - 0.5) / w` of the way through the band.
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
 * after. The FIRST and LAST chapters have no scroll room on their outer side,
 * so their windows are shifted inward to lie entirely within the spine.
 */
export function sceneLocalRaw(progress: number, index: number): number {
  const section = progressToSection(progress);
  if (index === 0) return section;
  if (index === SCENE_COUNT - 1) return section - (SCENE_COUNT - 2);
  return section - index + 0.5;
}

/**
 * Progress across a chapter's OWN scroll band, 0 -> 1.
 *
 * `sceneLocalRaw` centres a chapter's window on the moment it is framed, which
 * is what a chapter whose subject transforms on arrival wants: by the time you
 * are looking at the tablet, it has finished becoming one.
 *
 * A chapter whose subject animates while it is HELD wants the opposite. The
 * registry turns through its roster for the whole time it is on screen, so its
 * timeline has to start when the chapter is framed and end when the scroll
 * does -- and for the LAST chapter those are not the same thing as local 0 and
 * 1, because the final viewport height can never be scrolled past. This maps
 * the band that actually exists onto 0 -> 1, so a chapter can be written
 * against its own length without knowing where it sits in the spine.
 */
export function sceneBand(progress: number, index: number): number {
  const span =
    index === SCENE_COUNT - 1
      ? (SCROLL_SPAN - SCENE_OFFSETS[index]) / WEIGHTS[index]
      : 1;
  return clamp((progressToSection(progress) - index) / span);
}

/**
 * Global scroll progress at which team record `i` stands at the front of the
 * registry, for a link that opens straight into someone's dossier.
 */
export function progressForRecord(i: number, total: number): number {
  const index = SCENE_COUNT - 1;
  const span = (SCROLL_SPAN - SCENE_OFFSETS[index]) / WEIGHTS[index];
  const step = total > 1 ? i / (total - 1) : 0;
  const band =
    REGISTRY_WINDOW.from + step * (REGISTRY_WINDOW.to - REGISTRY_WINDOW.from);
  return clamp((SCENE_OFFSETS[index] + band * span * WEIGHTS[index]) / SCROLL_SPAN);
}

/** Signed distance from a chapter, in chapters. */
export function sceneDistance(progress: number, index: number): number {
  return progressToSection(progress) - index;
}

/** Hex string of a chapter's base accent colour. */
export function sceneAccent(index: number): string {
  return accent[SCENES[index].accent].base;
}
