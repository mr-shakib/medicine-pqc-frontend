'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import CameraRig from '@/components/three/CameraRig';
import Lighting from '@/components/three/Lighting';
import Precompile from '@/components/three/Precompile';
import ScrollSampler from '@/components/three/ScrollSampler';
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
import Scene05AIDetection from '@/components/three/scenes/Scene05AIDetection';
import Scene06PQCProtection from '@/components/three/scenes/Scene06PQCProtection';
import Scene07Final from '@/components/three/scenes/Scene07Final';
import Scene08Team from '@/components/three/scenes/Scene08Team';
import { scrollStore } from '@/lib/scrollStore';
import { DEFAULT_DRAW_RADIUS, SCENES, sceneDistance } from '@/lib/scenes';
import type { QualityBudget } from '@/lib/quality';
import type { SceneComponentProps } from '@/types';
import { type Group } from 'three';

/** Registry indexed by scene order -- mirrors the order of `SCENES`. */
const SCENE_COMPONENTS: React.ComponentType<SceneComponentProps>[] = [
  Scene01MedicineCore,
  Scene02CapsuleFormation,
  Scene03CapsuleToTablet,
  Scene04TabletToSerum,
  Scene05AIDetection,
  Scene06PQCProtection,
  Scene07Final,
  Scene08Team,
];

export interface SceneManagerProps {
  budget: QualityBudget;
  mobile: boolean;
  reducedMotion: boolean;
  pointer: React.RefObject<{ x: number; y: number }>;
  /** Called once the whole world has been compiled and drawn. */
  onReady: () => void;
}

/**
 * Owns the 3D world: the scroll sampling, the camera, the lighting, the
 * atmosphere, and every chapter.
 *
 * Every chapter is mounted for the whole session. Mounting them on demand
 * saved memory that was never short, and cost the one thing that cannot be
 * hidden: React work, geometry sampling and shader compilation all landing in
 * the middle of a scroll, right at the transition into the chapter. With all
 * of them resident, scrolling touches nothing but uniforms and transforms.
 * What is DRAWN is still gated per chapter -- see `SceneSlot`.
 */
export default function SceneManager({
  budget,
  mobile,
  reducedMotion,
  pointer,
  onReady,
}: SceneManagerProps) {
  return (
    <>
      {/* First, so its frame callback runs before every other one. */}
      <ScrollSampler reducedMotion={reducedMotion} />

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
        {SCENES.map((scene, index) => {
          const SceneComponent = SCENE_COMPONENTS[index];
          return (
            <SceneSlot key={scene.id} index={index}>
              <SceneComponent definition={scene} />
            </SceneSlot>
          );
        })}
      </QualityProvider>

      {/* Last, so it sees every chapter's first frame before it compiles. */}
      <Precompile onDone={onReady} />
    </>
  );
}

/**
 * Keeps a chapter out of the draw list while it is far from view.
 *
 * Toggling `visible` on the group is enough: Three skips the whole subtree
 * during render but leaves every component mounted, so React state, sampled
 * particle clouds and compiled programs all survive and the chapter is
 * instantly ready when it comes back into range.
 *
 * The radius is wide enough that a transition always has both of its chapters
 * and no wider: a chapter a full chapter away is behind enough fog to be
 * invisible while still rasterising every pixel it covers.
 */
function SceneSlot({
  index,
  children,
}: {
  index: number;
  children: React.ReactNode;
}) {
  const group = useRef<Group>(null);
  const radius = SCENES[index].drawRadius ?? DEFAULT_DRAW_RADIUS;

  useFrame(() => {
    if (!group.current) return;
    const visible = Math.abs(sceneDistance(scrollStore.smooth, index)) <= radius;
    if (group.current.visible !== visible) group.current.visible = visible;
  });

  // Hidden until the gate says otherwise, so the first frame does not draw
  // all eight chapters on top of one another.
  return (
    <group ref={group} visible={index === 0}>
      {children}
    </group>
  );
}
