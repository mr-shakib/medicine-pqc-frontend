'use client';

import { useCallback } from 'react';
import TeamRegistry from '@/components/three/objects/TeamRegistry';
import Motes from '@/components/three/objects/Motes';
import { LightPool } from '@/components/three/effects';
import SceneAnchor from '@/components/three/SceneAnchor';
import { useSceneProgress } from '@/hooks/useSceneProgress';
import { useQuality } from '@/components/three/QualityProvider';
import { accent } from '@/lib/design/tokens';
import { lerp, range, smoothstep } from '@/lib/math';
import { REGISTRY_WINDOW } from '@/lib/scenes';
import { TEAM, TEAM_COUNT } from '@/lib/team';
import type { SceneComponentProps } from '@/types';

const T = {
  /*
    The ring fills on APPROACH, not on arrival.

    These two are measured in chapters from this one, not in band progress:
    the flight in from chapter 07 covers most of a chapter, and a ring that
    only began to fill once this chapter was framed left the frame empty for
    the whole of it -- the camera arriving at nothing. Starting a third of a
    chapter out means the records are already standing when the lens gets
    here, and the approach reads as flying toward a group rather than toward
    an empty mark.
  */
  riseFrom: -0.34,
  riseTo: 0.1,
  /*
    Then the turntable turns, once through the roster. Declared in `lib/scenes`
    beside the chapter's other scroll timings, because a deep link into one
    record's dossier has to resolve the same window to know where to scroll.
  */
  rosterFrom: REGISTRY_WINDOW.from,
  rosterTo: REGISTRY_WINDOW.to,
} as const;

const RADIUS = 4.6;

/**
 * How strongly each step eases, 0 linear and 1 fully smoothstepped.
 *
 * The ring has to rest on a face long enough to read it, which means the turn
 * cannot run at one uniform speed -- ten faces at a constant rate is a blur
 * with names in it. But it must never STOP, and an earlier version of this
 * held each station for the first and last fifth of its step, using a
 * smoothstep with those as its edges.
 *
 * That was a mistake, and a bad one: the cursor's derivative was exactly zero
 * across those windows, and the cursor drives everything here -- the rotation,
 * every station's focus, the brightness, the name plate, the rule, the seal.
 * With the camera also holding still by design, roughly a hundred and sixty
 * pixels of every three hundred scrolled changed nothing on screen at all.
 * Scrolling a chapter that does not move reads as the page having stalled.
 *
 * Blending toward linear instead keeps a floor under the derivative -- the
 * slowest the ring ever turns is 0.28 of its nominal rate, never zero -- so
 * the roster still lingers on each face, and every pixel of scroll still buys
 * a visible change.
 */
const DETENT = 0.72;

/**
 * Ease a 0 -> 1 ramp into `steps` detented steps.
 *
 * Returns a continuous position in station units: 3 is squarely on the fourth
 * record, 3.5 is mid-turn between the fourth and the fifth. Continuous in
 * value AND in derivative across a step boundary, so no station arrives or
 * leaves on a visible change of pace.
 */
function detent(t: number, steps: number): number {
  const scaled = t * steps;
  // Clamped so the very last sample lands on the final step rather than
  // rolling over into a step that does not exist.
  const index = Math.min(Math.floor(scaled), steps - 1);
  const f = scaled - index;
  return index + lerp(f, smoothstep(0, 1, f), DETENT);
}

/**
 * SCENE 08 — THE TEAM.
 *
 * The credits, and the only chapter with people in it. Ten identity records on
 * a turntable that the scroll turns, one face at a time: the figure lit as it
 * comes to the front, a hairline drawing itself out beneath, a seal closing on
 * the line, and the name resolving last.
 *
 * It is deliberately built out of the piece's existing grammar rather than a
 * new one. Everything before this has been about establishing that a thing can
 * be identified, inspected and signed; introducing the people the same way --
 * held in the dark, annotated by a hairline, marked when they have been read --
 * says they are part of the same system rather than an about-page bolted to
 * the end of it.
 *
 * The camera barely moves. The ring is what turns, and a lens that also
 * travelled would make it ambiguous which of the two was doing it.
 */
export default function Scene08Team({ definition }: SceneComponentProps) {
  const progress = useSceneProgress(definition.index);
  const budget = useQuality();

  /*
    Driven by `band` rather than `local`, and by the DIRECT channel rather than
    the smoothed one.

    Band because this is the last chapter, and a chapter's local window is
    centred on the moment it is FRAMED -- which for the last chapter means it
    would finish before the chapter arrived. The registry animates while it is
    held, so it wants the band that can actually be scrolled.

    Direct because the turntable is the one subject in the piece the viewer
    turns rather than flies past. Everywhere else the scroll moves a camera,
    and the lens's ~150ms of inertia is the point; here it is a small rotation
    answering late, which is indistinguishable from the page being slow. See
    `direct` on the scroll store.
  */
  const getCursor = useCallback(
    () =>
      detent(
        range(progress.bandDirect(), T.rosterFrom, T.rosterTo),
        TEAM_COUNT - 1,
      ),
    [progress],
  );

  const getReveal = useCallback(
    () => smoothstep(T.riseFrom, T.riseTo, progress.distance()),
    [progress],
  );

  const motesReveal = useCallback(
    () => smoothstep(0.04, 0.3, progress.band()) * 0.75,
    [progress],
  );

  return (
    <SceneAnchor definition={definition} driftAmount={0.022} driftSpeed={0.13}>
      <TeamRegistry
        members={TEAM}
        radius={RADIUS}
        getCursor={getCursor}
        getReveal={getReveal}
        color={accent.pharma.ink}
      />

      {/*
        Sits at the CENTRE of the turntable, which is four and a half units
        behind whichever record is at the front — so it reads as a soft source
        behind the subject rather than as a plinth under it.
      */}
      <LightPool
        position={[0, -1.7, 0]}
        size={9}
        color={accent.pharma.ink}
        intensity={0.16}
        falloff={3}
      />

      <Motes
        count={Math.round(
          budget.particles * (budget.tier === 'high' ? 0.08 : 0.04),
        )}
        innerRadius={3.4}
        outerRadius={8}
        color={accent.pharma.ink}
        size={budget.tier === 'high' ? 0.22 : 0.18}
        spin={0.011}
        seed={71}
        getReveal={motesReveal}
      />
    </SceneAnchor>
  );
}
