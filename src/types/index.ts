import type { SceneDefinition } from '@/lib/scenes';

/** Props every 3D scene component receives from the SceneManager. */
export interface SceneComponentProps {
  /** The scene's own definition from `lib/scenes`. */
  definition: SceneDefinition;
}

export type { SceneDefinition };
