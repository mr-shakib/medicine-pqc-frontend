'use client';

import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  PerspectiveCamera,
  type Camera,
  type Object3D,
  type Scene,
  type WebGLRenderer,
} from 'three';

/**
 * Compiles and uploads the ENTIRE world at load, so nothing is compiled later.
 *
 * Three builds a material's shader program the first time it is drawn, and a
 * program can take anywhere from tens to hundreds of milliseconds. Left to
 * happen naturally, that cost lands on the first frame a chapter becomes
 * visible -- which is mid-scroll, in the transition into it, where a single
 * long frame reads as the page seizing.
 *
 * Every chapter is mounted from the start, so this can walk the whole scene
 * once, make everything visible, and draw it: one heavy frame while the
 * canvas is still faded out. `gl.compile` handles the programs and `gl.render`
 * uploads geometry and textures, both of which are otherwise deferred to first
 * use. The camera's far plane is pushed out for the pass so distant chapters
 * are not frustum-culled out of it.
 *
 * Runs on the second frame -- after every frame callback has executed once,
 * so any attribute a chapter only creates on its first frame (an instanced
 * colour buffer, say) exists and is part of the compiled program -- and once
 * more shortly after, which is nearly free and catches anything mounted late.
 */
export default function Precompile({ onDone }: { onDone: () => void }) {
  const frame = useRef(0);

  useFrame(({ gl, scene, camera }) => {
    frame.current++;
    if (frame.current === 2 || frame.current === 8) {
      warm(gl, scene, camera);
    }
    if (frame.current === 8) onDone();
  });

  return null;
}

function warm(gl: WebGLRenderer, scene: Scene, camera: Camera): void {
  const hidden: Object3D[] = [];
  scene.traverse((object) => {
    if (!object.visible) {
      hidden.push(object);
      object.visible = true;
    }
  });

  const perspective = camera instanceof PerspectiveCamera ? camera : null;
  const far = perspective?.far ?? 0;
  if (perspective) {
    perspective.far = 1e5;
    perspective.updateProjectionMatrix();
  }

  gl.compile(scene, camera);
  gl.render(scene, camera);

  if (perspective) {
    perspective.far = far;
    perspective.updateProjectionMatrix();
  }
  for (const object of hidden) object.visible = false;
}
