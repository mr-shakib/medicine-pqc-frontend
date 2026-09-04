import { Color, MeshPhysicalMaterial, type IUniform } from 'three';
import { simplex3D } from '@/shaders/noise';

/**
 * Dissolve support, injected into a standard PBR material.
 *
 * The alternative — writing a bespoke ShaderMaterial — would mean giving up
 * clearcoat, environment reflections, tone mapping and the whole lighting
 * pipeline, which is most of what makes the capsule read as premium. Patching
 * `MeshPhysicalMaterial` through `onBeforeCompile` keeps all of it and adds
 * roughly fifteen lines of GLSL.
 *
 * The effect is a noise-thresholded `discard` with an emissive band tracking
 * just ahead of the threshold, so the surface burns away from a glowing edge
 * rather than fading out — a fade would read as opacity, not as material loss.
 */
export interface DissolveUniforms {
  uDissolve: IUniform<number>;
  uEdgeWidth: IUniform<number>;
  uEdgeColor: IUniform<Color>;
  uNoiseScale: IUniform<number>;
  [key: string]: IUniform;
}

/**
 * Pass the accent family's `base` step as the edge colour, never `light` or
 * `glow`. The edge is multiplied well above 1 to make it burn, and a pale step
 * clips every channel to white — losing the hue exactly where it identifies
 * the material that is dissolving.
 */
export function createDissolveUniforms(edgeColor: string): DissolveUniforms {
  return {
    /** 0 = intact, 1 = fully gone. */
    uDissolve: { value: 0 },
    /** Width of the glowing edge band, in noise units. */
    uEdgeWidth: { value: 0.055 },
    uEdgeColor: { value: new Color(edgeColor) },
    /** Spatial frequency of the dissolve pattern. */
    uNoiseScale: { value: 7 },
  };
}

/**
 * Attach dissolve to a physical material.
 *
 * Returns the uniform object; hold onto it and mutate `uDissolve.value` from
 * the render loop. The material is patched in place.
 */
export function attachDissolve(
  material: MeshPhysicalMaterial,
  uniforms: DissolveUniforms,
  cacheKey: string,
): MeshPhysicalMaterial {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vDissolveLocal;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vDissolveLocal = position;`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vDissolveLocal;
        uniform float uDissolve;
        uniform float uEdgeWidth;
        uniform vec3 uEdgeColor;
        uniform float uNoiseScale;
        ${simplex3D}`,
      )
      // Earliest point in main(), so the discard costs nothing beyond the
      // noise evaluation -- lighting is never computed for a killed fragment.
      //
      // The noise itself sits behind the uniform branch. Two octaves of 3D
      // simplex per fragment is real work, and an intact object -- which is
      // what these materials are for most of every chapter -- would otherwise
      // pay it on every pixel for a result it never uses.
      .replace(
        '#include <clipping_planes_fragment>',
        `#include <clipping_planes_fragment>
        float dissolveNoise = 0.0;
        if (uDissolve > 0.0) {
          dissolveNoise = msp_fbm01(vDissolveLocal * uNoiseScale);
          if (dissolveNoise < uDissolve) discard;
        }`,
      )
      // The edge is emissive rather than albedo so it survives tone mapping and
      // reads as the material giving up energy as it goes.
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        if (uDissolve > 0.0) {
          float dissolveEdge =
            1.0 - smoothstep(uDissolve, uDissolve + uEdgeWidth, dissolveNoise);
          totalEmissiveRadiance += uEdgeColor * dissolveEdge * 1.8;
        }`,
      );
  };

  /*
    Three caches compiled programs by material type plus a set of feature
    flags, none of which know about an onBeforeCompile patch. Without a
    distinct cache key a patched material can silently receive the unpatched
    program compiled for another material with the same flags.
  */
  material.customProgramCacheKey = () => cacheKey;
  material.needsUpdate = true;

  return material;
}
