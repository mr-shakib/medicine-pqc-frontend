'use client';

import { useCallback, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import CameraRig from '@/components/three/CameraRig';
import Lighting from '@/components/three/Lighting';
import {
  Atmosphere,
  Backdrop,
  StudioEnvironment,
} from '@/components/three/effects';
import { QualityProvider } from '@/components/three/QualityProvider';
import Scene01MedicineCore from '@/components/three/scenes/Scene01MedicineCore';
import Scene02CapsuleFormation from '@/components/three/scenes/Scene02CapsuleFormation';
import Scene03CapsuleToTablet from '@/components/three/scenes/Scene03CapsuleToTablet';
import Scene04TabletToSerum from '@/components/three/scenes/Scene04TabletToSerum';
import Scene05ProductConvergence from '@/components/three/scenes/Scene05ProductConvergence';
import Scene06AIDetection from '@/components/three/scenes/Scene06AIDetection';
import Scene07PQCProtection from '@/components/three/scenes/Scene07PQCProtection';
import Scene08ThreatDetected from '@/components/three/scenes/Scene08ThreatDetected';
import Scene09Final from '@/components/three/scenes/Scene09Final';
import { scrollStore } from '@/lib/scrollStore';
import { SCENES, sceneAt, sceneDistance } from '@/lib/scenes';
import { damp } from '@/lib/math';
import type { QualityBudget } from '@/lib/quality';
import type { SceneComponentProps } from '@/types';
import { type Group } from 'three';

/** Registry indexed by scene order -- mirrors the order of `SCENES`. */
const SCENE_COMPONENTS: React.ComponentType<SceneComponentProps>[] = [
  Scene01MedicineCore,
  Scene02CapsuleFormation,
  Scene03CapsuleToTablet,
  Scene04TabletToSerum,
  Scene05ProductConvergence,
  Scene06AIDetection,
  Scene07PQCProtection,
  Scene08ThreatDetected,
  Scene09Final,
];

/** How many scenes either side of the framed one stay mounted. */
const MOUNT_RADIUS = 1;

/**
 * How far a chapter may be, in chapters, before it stops being drawn.
 *
 * Mounting a neighbour and DRAWING it are different things. Neighbours have to
 * stay mounted so a transition has both sides of it ready, but a chapter a full
 * chapter away is behind enough fog to be invisible while still rasterising
 * every pixel it covers — which for a finished vial is five PBR materials and a
 * transmission pass, paid for nothing.
 *
 * Comfortably wider than any transition needs, so nothing ever pops.
 *
 * The margin is generous on purpose. This is driven by the DAMPED scroll value,
 * the same one the camera follows, which lags behind a large jump — an anchor
 * click, or a fast scrub. Too tight a radius and the lag can hide a chapter the
 * camera can still see. The gate is only ever an optimisation, so it errs
 * toward drawing.
 */
const DRAW_RADIUS = 1.25;

/**
 * Frames a newly mounted chapter is drawn for before the gate may hide it, so
 * its shaders compile off-screen rather than at the transition into it.
 */
const WARMUP_FRAMES = 4;

export interface SceneManagerProps {
  budget: QualityBudget;
  mobile: boolean;
  reducedMotion: boolean;
  pointer: React.RefObject<{ x: number; y: number }>;
}

/**
 * Owns the 3D world: the frame-loop scroll smoothing, the camera, the lighting,
 * the atmosphere, and which scenes are currently mounted.
 *
 * This component is rendered FIRST among the canvas children so its `useFrame`
 * runs before every other one -- meaning `scrollStore.smooth` is already updated
 * for the current frame by the time scenes and the camera read it.
 */
export default function SceneManager({
  budget,
  mobile,
  reducedMotion,
  pointer,
}: SceneManagerProps) {
  /**
   * Which scenes are mounted, and which one is centred.
   *
   * Low-frequency state: it changes 8 times across the whole page, so the
   * re-render cost is negligible and it keeps the mounted set declarative.
   */
  const [mounted, setMounted] = useState<{ center: number; scenes: number[] }>(
    () => ({ center: 0, scenes: [0, 1] }),
  );
  const lastCenter = useRef(0);

  const mountAround = useCallback((center: number) => {
    const scenes: number[] = [];
    for (let i = center - MOUNT_RADIUS; i <= center + MOUNT_RADIUS; i++) {
      if (i >= 0 && i < SCENES.length) scenes.push(i);
    }
    setMounted({ center, scenes });
  }, []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 20);

    // Single point where scroll smoothing happens for the whole application.
    scrollStore.smooth = reducedMotion
      ? scrollStore.progress
      : damp(scrollStore.smooth, scrollStore.progress, 0.0025, dt);

    // Mount/unmount only when the smoothed centre actually crosses a boundary.
    const center = sceneAt(scrollStore.smooth);
    if (center !== lastCenter.current) {
      lastCenter.current = center;
      mountAround(center);
    }
  });

  return (
    <>
      <CameraRig
        mobile={mobile}
        pointer={pointer}
        reducedMotion={reducedMotion}
      />
      <Backdrop />
      <StudioEnvironment budget={budget} />
      <Lighting shadows={budget.shadows} />
      <Atmosphere count={budget.particles} />

      <QualityProvider budget={budget}>
        {mounted.scenes.map((index) => (
          <SceneSlot key={SCENES[index].id} index={index}>
            {(() => {
              const SceneComponent = SCENE_COMPONENTS[index];
              return (
                <SceneComponent
                  definition={SCENES[index]}
                  active={index === mounted.center}
                />
              );
            })()}
          </SceneSlot>
        ))}
      </QualityProvider>
    </>
  );
}

/**
 * Keeps a mounted chapter out of the draw list while it is far from view.
 *
 * Toggling `visible` on the group is enough: Three skips the whole subtree
 * during render but leaves every component mounted, so React state, sampled
 * particle clouds and material compilations all survive and the chapter is
 * instantly ready when it comes back into range.
 */
function SceneSlot({
  index,
  children,
}: {
  index: number;
  children: React.ReactNode;
}) {
  const group = useRef<Group>(null);
  const framesRendered = useRef(0);

  useFrame(() => {
    if (!group.current) return;

    /*
      Render for a few frames before the gate is allowed to hide anything.

      Three compiles a material's shader program the first time it is actually
      drawn. Hiding a freshly mounted chapter defers every one of its compiles
      to the moment it becomes visible — which for a chapter carrying nine
      materials is a stall right at the transition into it. Measured: a mobile
      journey sampling with a short settle saw 1 fps at that seam, against
      22 fps once the compiles had happened.
      
      Letting the chapter draw briefly while it is still off in the fog moves
      that work to where nobody is looking. The frames are cheap: it is one
      chapter, far away, for a handful of frames.
    */
    if (framesRendered.current < WARMUP_FRAMES) {
      framesRendered.current++;
      if (!group.current.visible) group.current.visible = true;
      return;
    }

    const visible =
      Math.abs(sceneDistance(scrollStore.smooth, index)) <= DRAW_RADIUS;
    if (group.current.visible !== visible) group.current.visible = visible;
  });

  return <group ref={group}>{children}</group>;
}
