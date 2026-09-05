import { Color, Vector3 } from 'three';
import { SCENES, SCENE_COUNT, progressToSection } from '@/lib/scenes';
import { accent } from '@/lib/design/tokens';
import { clamp } from '@/lib/math';

/**
 * A fixed pool of two accent lights, shared by every chapter.
 *
 * Three compiles the number of lights into every shader program. Mounting a
 * light inside a chapter -- or toggling one's visibility for a flash -- changes
 * that number, and every material on screen is recompiled on the spot: a stall
 * of tens to hundreds of milliseconds, paid mid-scroll at exactly the moment a
 * chapter comes into view. Keeping the count constant means every program is
 * compiled once, at load, and never again.
 *
 * The two slots always serve the two nearest chapters. Each chapter's light is
 * declared on its `SceneDefinition`; a chapter that has none gets a slot at
 * zero intensity, which costs nothing visible and keeps the count at two.
 */
export interface LightSlot {
  position: Vector3;
  color: Color;
  intensity: number;
  distance: number;
}

const makeSlot = (): LightSlot => ({
  position: new Vector3(),
  color: new Color(),
  intensity: 0,
  distance: 10,
});

export const lightRig = {
  slots: [makeSlot(), makeSlot()] as const,
  /**
   * Per-chapter intensity added on top of the definition, written each frame
   * by the chapter that owns it. This is how a chapter flashes its light
   * without touching the light count: the seam flash in chapter 02 lives here.
   */
  boost: new Float32Array(SCENE_COUNT),
};

/**
 * Pre-resolved colours -- the frame loop must never allocate.
 *
 * Filled by `rebuildLightRigColors`, not at module scope: a colour resolved
 * when this file is first imported is the colour of whichever palette happened
 * to be active then, and would survive a theme change unchanged. `Lighting`
 * rebuilds them, because it is rebuilt itself for each palette.
 */
const SCENE_LIGHT_COLORS = SCENES.map(() => new Color('#000000'));

/** Re-resolve every chapter's accent light against the current palette. */
export function rebuildLightRigColors(): void {
  SCENES.forEach((scene, i) => {
    const step = scene.accentLight?.step;
    SCENE_LIGHT_COLORS[i].set(step ? accent[scene.accent][step] : '#000000');
  });
}

function fillSlot(slot: LightSlot, index: number): void {
  const scene = SCENES[index];
  const light = scene.accentLight;
  const [ax, ay, az] = scene.anchor;

  if (!light) {
    slot.position.set(ax, ay, az);
    slot.intensity = 0;
    return;
  }

  slot.position.set(ax + light.offset[0], ay + light.offset[1], az + light.offset[2]);
  slot.color.copy(SCENE_LIGHT_COLORS[index]);
  slot.intensity = light.intensity + lightRig.boost[index];
  slot.distance = light.distance;
}

/**
 * Point the pool at the two chapters either side of the current position.
 * Called once per frame from the scroll sampler, before the lights read it.
 */
export function updateLightRig(progress: number): void {
  const section = clamp(progressToSection(progress), 0, SCENE_COUNT - 1);
  const lower = Math.floor(section);
  const upper = Math.min(lower + 1, SCENE_COUNT - 1);

  fillSlot(lightRig.slots[0], lower);
  if (upper === lower) {
    lightRig.slots[1].intensity = 0;
  } else {
    fillSlot(lightRig.slots[1], upper);
  }
}
