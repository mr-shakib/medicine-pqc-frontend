'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  CapsuleGeometry,
  Color,
  NormalBlending,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  ShaderMaterial,
  TorusGeometry,
} from 'three';
import { accent, mark } from '@/lib/design/tokens';
import {
  featureFragment,
  featureVertex,
  scanPlaneFragment,
  scanPlaneVertex,
  signatureFragment,
  signatureVertex,
} from '@/shaders/analysis';
import { clamp, seededRandom, smoothstep } from '@/lib/math';

const dummy = new Object3D();
const scratchColor = new Color();

const AUTHENTIC = new Color(accent.verified.base);
const COUNTERFEIT = new Color(accent.alert.base);
const PENDING = new Color(accent.analysis.base);

export interface AnalysisItem {
  position: [number, number, number];
  authentic: boolean;
  /** Omit for hero objects that render their own geometry. */
  proxy?: boolean;
  scale?: number;
}

export interface AnalysisFieldProps {
  items: AnalysisItem[];
  /** Height of the sweep, in local units. Read every frame. */
  getScanY: () => number;
  /** Overall presence of the analysis layer, 0 -> 1. Read every frame. */
  getReveal: () => number;
  /** Presence of the population proxies, 0 -> 1. Read every frame. */
  getPopulation: () => number;
  /** Half-width of the scanned volume. */
  extent?: number;
}

/**
 * The analysis layer: the population under inspection, the sweeping scan, and
 * the per-product verdict.
 *
 * Three instanced draws for the whole thing, however many products there are:
 * the proxy products, the verdict rings, and the signature traces. The three
 * hero objects render themselves; everything around them is instanced, because
 * a field of similar products is exactly the case instancing exists for.
 *
 * There is deliberately no text, no readout and no numerals. The verdict is
 * carried by colour and by the shape of each product's signature trace.
 */
export default function AnalysisField({
  items,
  getScanY,
  getReveal,
  getPopulation,
  extent = 2.4,
}: AnalysisFieldProps) {
  const proxies = useRef<InstancedMesh>(null);
  const rings = useRef<InstancedMesh>(null);
  const signatures = useRef<InstancedMesh>(null);
  const scanPlane = useRef<Mesh>(null);
  const features = useRef<import('three').Points>(null);

  const proxyItems = useMemo(() => items.filter((i) => i.proxy), [items]);

  /* ---------------------------------------------------------------------- */
  /* Geometry and materials                                                 */
  /* ---------------------------------------------------------------------- */

  const proxyGeometry = useMemo(
    // A simplified capsule silhouette. These sit behind the hero objects and
    // read as population, not as subjects; lathing each one would be detail
    // nobody can resolve at this distance.
    () => new CapsuleGeometry(0.15, 0.34, 4, 12),
    [],
  );

  const proxyMaterial = useMemo(
    () => new MeshStandardMaterial({ roughness: 0.3, metalness: 0 }),
    [],
  );

  const ringGeometry = useMemo(() => new TorusGeometry(1, 0.014, 5, 48), []);
  const ringMaterial = useMemo(
    () =>
      new MeshStandardMaterial({
        transparent: true,
        opacity: 0.9,
        emissiveIntensity: 1.4,
        toneMapped: false,
        vertexColors: true,
      }),
    [],
  );

  const signatureGeometry = useMemo(() => {
    const g = new PlaneGeometry(1, 1);
    const count = items.length;
    const authentic = new Float32Array(count);
    const seeds = new Float32Array(count);
    const heights = new Float32Array(count);

    items.forEach((item, i) => {
      authentic[i] = item.authentic ? 1 : 0;
      seeds[i] = seededRandom((i + 1) * 13.7) * 20;
      heights[i] = item.position[1];
    });

    g.setAttribute('aAuthentic', new InstancedBufferAttribute(authentic, 1));
    g.setAttribute('aSeed', new InstancedBufferAttribute(seeds, 1));
    g.setAttribute('aHeight', new InstancedBufferAttribute(heights, 1));
    return g;
  }, [items]);

  /**
   * Feature points: a small cloud around each product that streams down into
   * its trace as the sweep reaches it.
   */
  const PER_ITEM = 26;

  const featureGeometry = useMemo(() => {
    const count = items.length * PER_ITEM;
    const positions = new Float32Array(count * 3);
    const targets = new Float32Array(count * 3);
    const itemY = new Float32Array(count);
    const seeds = new Float32Array(count);
    const authentic = new Float32Array(count);

    items.forEach((item, index) => {
      const [ix, iy, iz] = item.position;
      const spread = 0.34 * (item.scale ?? 1);

      for (let n = 0; n < PER_ITEM; n++) {
        const i = index * PER_ITEM + n;
        const k = (i + 1) * 3.7;

        // Start on a shell around the product, not at its centre: features are
        // read off a surface.
        const u = seededRandom(k * 1.1) * 2 - 1;
        const theta = seededRandom(k * 2.3) * Math.PI * 2;
        const radial = Math.sqrt(Math.max(0, 1 - u * u));

        positions[i * 3] = ix + Math.cos(theta) * radial * spread;
        positions[i * 3 + 1] = iy + u * spread;
        positions[i * 3 + 2] = iz + Math.sin(theta) * radial * spread;

        // Land spread along the width of that product's trace.
        targets[i * 3] = ix + (seededRandom(k * 5.1) - 0.5) * 0.7;
        targets[i * 3 + 1] = iy - 0.42;
        targets[i * 3 + 2] = iz;

        itemY[i] = iy;
        seeds[i] = seededRandom(k * 7.9);
        authentic[i] = item.authentic ? 1 : 0;
      }
    });

    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(positions, 3));
    g.setAttribute('aTarget', new BufferAttribute(targets, 3));
    g.setAttribute('aItemY', new BufferAttribute(itemY, 1));
    g.setAttribute('aSeed', new BufferAttribute(seeds, 1));
    g.setAttribute('aAuthentic', new BufferAttribute(authentic, 1));
    return g;
  }, [items]);

  const featureMaterial = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: featureVertex,
        fragmentShader: featureFragment,
        transparent: true,
        /*
          Additive on a dark ground, normal on a light one -- and premultiplied
          either way, so the same program composites correctly under both. See
          `hologram` in `lib/design/materials` for why a mark cannot simply be
          added to paper.
        */
        blending: mark.additive ? AdditiveBlending : NormalBlending,
        premultipliedAlpha: true,
        depthWrite: false,
        uniforms: {
          uScanY: { value: -99 },
          uReveal: { value: 0 },
          uTime: { value: 0 },
          /*
            Tuned against the 150/-z falloff in the vertex stage at this
            chapter's viewing distance. At 0.16 these landed under two pixels
            and the whole extraction layer was invisible.
          */
          uSize: { value: 0.9 },
          uPixelRatio: { value: 1 },
          uColor: { value: new Color(accent.analysis.light) },
          uCounterfeitColor: { value: new Color(accent.alert.light) },
        },
      }),
    [],
  );

  const signatureMaterial = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: signatureVertex,
        fragmentShader: signatureFragment,
        transparent: true,
        /*
          Additive on a dark ground, normal on a light one -- and premultiplied
          either way, so the same program composites correctly under both. See
          `hologram` in `lib/design/materials` for why a mark cannot simply be
          added to paper.
        */
        blending: mark.additive ? AdditiveBlending : NormalBlending,
        premultipliedAlpha: true,
        depthWrite: false,
        side: DoubleSide,
        uniforms: {
          uScanY: { value: -99 },
          uReveal: { value: 0 },
          uTime: { value: 0 },
          uAuthenticColor: { value: new Color(accent.verified.light) },
          uCounterfeitColor: { value: new Color(accent.alert.base) },
        },
      }),
    [],
  );

  const scanMaterial = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: scanPlaneVertex,
        fragmentShader: scanPlaneFragment,
        transparent: true,
        /*
          Additive on a dark ground, normal on a light one -- and premultiplied
          either way, so the same program composites correctly under both. See
          `hologram` in `lib/design/materials` for why a mark cannot simply be
          added to paper.
        */
        blending: mark.additive ? AdditiveBlending : NormalBlending,
        premultipliedAlpha: true,
        depthWrite: false,
        side: DoubleSide,
        uniforms: {
          uColor: { value: new Color(accent.analysis.light) },
          uOpacity: { value: 0 },
        },
      }),
    [],
  );

  useEffect(
    () => () => {
      proxyGeometry.dispose();
      proxyMaterial.dispose();
      ringGeometry.dispose();
      ringMaterial.dispose();
      signatureGeometry.dispose();
      signatureMaterial.dispose();
      scanMaterial.dispose();
      featureGeometry.dispose();
      featureMaterial.dispose();
    },
    [
      proxyGeometry, proxyMaterial, ringGeometry, ringMaterial,
      signatureGeometry, signatureMaterial, scanMaterial,
      featureGeometry, featureMaterial,
    ],
  );

  /* ---------------------------------------------------------------------- */
  /* Static instance placement                                              */
  /* ---------------------------------------------------------------------- */

  useEffect(() => {
    if (signatures.current) {
      items.forEach((item, i) => {
        dummy.position.set(
          item.position[0],
          item.position[1] - 0.42,
          item.position[2],
        );
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(0.86, 0.3, 1);
        dummy.updateMatrix();
        signatures.current!.setMatrixAt(i, dummy.matrix);
      });
      signatures.current.instanceMatrix.needsUpdate = true;
    }
  }, [items]);

  /* ---------------------------------------------------------------------- */
  /* Frame                                                                  */
  /* ---------------------------------------------------------------------- */

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    const scanY = getScanY();
    const reveal = clamp(getReveal());
    const population = clamp(getPopulation());

    /**
     * How far a verdict has resolved for one item.
     *
     * A counterfeit resolves on a later, slower window than a genuine product.
     * The delay is the point: a classifier settles a clear case immediately and
     * takes longer over an ambiguous one, and that hesitation is what makes the
     * failure read as a judgement rather than a label that was already attached.
     */
    const verdictFor = (item: AnalysisItem) =>
      smoothstep(
        item.position[1] - 0.05 + (item.authentic ? 0 : 0.35),
        item.position[1] + (item.authentic ? 0.3 : 0.95),
        scanY,
      ) * reveal;

    // --- Proxy products ---------------------------------------------------
    if (proxies.current) {
      proxyItems.forEach((item, i) => {
        const grow = population * (item.scale ?? 1);
        const judged = verdictFor(item);
        dummy.position.set(...item.position);
        /*
          Each product turns as it is read, then settles. A field where nothing
          moves under the sweep reads as a photograph being coloured in; a
          quarter-turn makes each one look inspected.
        */
        const presenting = Math.sin(Math.min(judged, 1) * Math.PI);
        dummy.rotation.set(
          0.4 + Math.sin(time * 0.3 + i) * 0.06 - presenting * 0.25,
          i * 1.7 + time * 0.06 + presenting * 0.9,
          0.2,
        );
        dummy.scale.setScalar(Math.max(grow, 0.0001));
        dummy.updateMatrix();
        proxies.current!.setMatrixAt(i, dummy.matrix);

        /*
          Counterfeits are NOT marked before they are scanned. Colouring them
          up front would answer the question the scan is there to ask -- the
          whole point is that they are visually indistinguishable until analysed.
        */

        /*
          Every product starts the same pharmaceutical amber and is only tinted
          once the sweep has reached it.

          The two verdicts are tinted very differently on purpose. A pass should
          leave the product looking like itself -- the ring and the steady trace
          carry the result, and washing a genuine medicine green would say that
          verification changes it. A failure gets a real colour shift, because
          the whole job of this chapter is that a counterfeit becomes
          impossible to miss.
        */
        scratchColor.set(accent.pharma.base);
        scratchColor.lerp(
          item.authentic ? AUTHENTIC : COUNTERFEIT,
          judged * (item.authentic ? 0.12 : 0.6),
        );
        proxies.current!.setColorAt(i, scratchColor);
      });
      proxies.current.instanceMatrix.needsUpdate = true;
      if (proxies.current.instanceColor) {
        proxies.current.instanceColor.needsUpdate = true;
      }
      proxies.current.visible = population > 0.004;
    }

    // --- Verdict rings ----------------------------------------------------
    if (rings.current) {
      items.forEach((item, i) => {
        const judged = verdictFor(item);

        // Contracts onto the product as the verdict lands.
        const radius = (item.scale ?? 1) * (0.62 - judged * 0.14);
        dummy.position.set(...item.position);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(Math.max(radius * judged, 0.0001));
        dummy.updateMatrix();
        rings.current!.setMatrixAt(i, dummy.matrix);

        scratchColor.copy(PENDING).lerp(
          item.authentic ? AUTHENTIC : COUNTERFEIT,
          smoothstep(0.25, 0.85, judged),
        );
        // Counterfeit rings pulse; authentic ones sit still. Instability is
        // the signal, and stillness is what reads as resolved.
        const pulse = item.authentic
          ? 1
          : 0.75 + Math.abs(Math.sin(time * 3.4 + i)) * 0.5;
        scratchColor.multiplyScalar(pulse);
        rings.current!.setColorAt(i, scratchColor);
      });
      rings.current.instanceMatrix.needsUpdate = true;
      if (rings.current.instanceColor) {
        rings.current.instanceColor.needsUpdate = true;
      }
      rings.current.visible = reveal > 0.004;
    }

    // --- Signature traces -------------------------------------------------
    if (signatures.current) {
      const uniforms = (signatures.current.material as ShaderMaterial).uniforms;
      uniforms.uScanY.value = scanY;
      uniforms.uReveal.value = reveal;
      uniforms.uTime.value = time;
      signatures.current.visible = reveal > 0.004;
    }

    // --- Feature extraction ----------------------------------------------
    if (features.current) {
      const uniforms = (features.current.material as ShaderMaterial).uniforms;
      uniforms.uScanY.value = scanY;
      uniforms.uReveal.value = reveal;
      uniforms.uTime.value = time;
      features.current.visible = reveal > 0.004;
    }

    // --- The sweep --------------------------------------------------------
    if (scanPlane.current) {
      const uniforms = (scanPlane.current.material as ShaderMaterial).uniforms;
      // Brightest while travelling, gone once the sweep has finished.
      const active = reveal * (1 - smoothstep(extent * 0.85, extent, scanY));
      uniforms.uOpacity.value = active * 0.55 * mark.density;
      scanPlane.current.position.y = scanY;
      scanPlane.current.visible = active > 0.004;
    }
  });

  return (
    <group>
      {proxyItems.length ? (
        <instancedMesh
          ref={proxies}
          args={[proxyGeometry, proxyMaterial, proxyItems.length]}
          frustumCulled={false}
          castShadow
        />
      ) : null}

      <instancedMesh
        ref={rings}
        args={[ringGeometry, ringMaterial, items.length]}
        frustumCulled={false}
      />

      <instancedMesh
        ref={signatures}
        args={[signatureGeometry, signatureMaterial, items.length]}
        frustumCulled={false}
      />

      <points
        ref={features}
        geometry={featureGeometry}
        material={featureMaterial}
        frustumCulled={false}
      />

      <mesh
        ref={scanPlane}
        material={scanMaterial}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[extent * 2.6, extent * 1.1]} />
      </mesh>
    </group>
  );
}
