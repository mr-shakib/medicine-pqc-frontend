'use client';

import { useCallback, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import MedicineCore from '@/components/three/objects/MedicineCore';
import SceneAnchor from '@/components/three/SceneAnchor';
import { useSceneProgress } from '@/hooks/useSceneProgress';
import { useQuality } from '@/components/three/QualityProvider';
import { smoothstep } from '@/lib/math';
import type { SceneComponentProps } from '@/types';

/**
 * SCENE 01 — THE MEDICINE CORE.
 *
 * The experience opens in darkness. A single pharmaceutical core resolves out
 * of it as the camera closes the distance, assembling layer by layer: nucleus,
 * then shell, then the suspended motes, then its structural cage, and finally
 * the holographic instrumentation that measures it.
 *
 * The chapter is a book-end (see the weights in `lib/scenes`) and the camera
 * reaches its mark 40% of the way through, so the approach has room without
 * holding the viewer at the door.
 *
 * Every property below is a pure function of scroll position -- there is no
 * playback state anywhere -- so scrolling backwards reverses the entire
 * sequence exactly.
 */
export default function Scene01MedicineCore({
  definition,
}: SceneComponentProps) {
  /**
   * Its own node, inside the anchor: this chapter animates position and
   * scale directly, which must never touch the anchored transform.
   */
  const group = useRef<Group>(null);

  const progress = useSceneProgress(definition.index);
  const budget = useQuality();

  /*
    Chapter 02 forms a capsule around this very object -- the two chapters share
    a world anchor, so it is the same core, not a copy. Reading the next
    chapter's progress here is a dependency on the shared progress space, not on
    that chapter's component, and it is what keeps the handover seamless: the
    measuring apparatus visibly withdraws to make room for the shell.
  */
  const formation = useSceneProgress(definition.index + 1);

  /**
   * The reveal curve, handed to the core as a getter so the scroll timeline
   * drives it without a single React re-render.
   *
   * It is deliberately front-loaded. The chapter's copy is pinned for the first
   * half of its band, so the object must be fully assembled -- instrumentation
   * included -- by local 0.5, while the statement is still on screen. That
   * composed frame is the point of the chapter; everything after it is exit.
   */
  const getReveal = useCallback(
    () => smoothstep(0.02, 0.5, progress.local()),
    [progress],
  );

  /** Withdraws the cage, instrumentation and motes as the capsule closes in. */
  const getRetract = useCallback(
    () => smoothstep(0.42, 0.78, formation.local()),
    [formation],
  );

  useFrame(() => {
    if (!group.current) return;
    const t = progress.local();

    // A long, slow settle: the core drifts fractionally toward the viewer as
    // the camera closes, which reads as depth rather than as scaling.
    group.current.position.z = (1 - smoothstep(0, 0.85, t)) * -1.4;

    // Scale is nearly static -- the sense of approach must come from the
    // camera, not from the object inflating. It settles at exactly 1 so the
    // capsule in chapter 02 encloses a core of known size.
    group.current.scale.setScalar(0.94 + smoothstep(0, 0.7, t) * 0.06);
  });

  return (
    <SceneAnchor definition={definition} driftAmount={0.03} driftSpeed={0.2}>
      <group ref={group}>
      <MedicineCore
        getReveal={getReveal}
        getRetract={getRetract}
        motes={Math.round(budget.particles * 0.06)}
      />
      </group>
    </SceneAnchor>
  );
}
