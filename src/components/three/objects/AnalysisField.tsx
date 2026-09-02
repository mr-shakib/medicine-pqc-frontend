'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  CapsuleGeometry,
  Color,
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
import { accent } from '@/lib/design/tokens';
import {
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

  const signatureMaterial = useMemo(
    () =>
      new ShaderMaterial({
        vertexShader: signatureVertex,
        fragmentShader: signatureFragment,
        transparent: true,
        blending: AdditiveBlending,
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
        blending: AdditiveBlending,
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
    },
    [
      proxyGeometry, proxyMaterial, ringGeometry, ringMaterial,
      signatureGeometry, signatureMaterial, scanMaterial,
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

    // --- Proxy products ---------------------------------------------------
    if (proxies.current) {
      proxyItems.forEach((item, i) => {
        const grow = population * (item.scale ?? 1);
        dummy.position.set(...item.position);
        dummy.rotation.set(
          0.4 + Math.sin(time * 0.3 + i) * 0.06,
          i * 1.7 + time * 0.06,
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
        const judged = smoothstep(
          item.position[1] - 0.05,
          item.position[1] + 0.3,
          scanY,
        ) * reveal;

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
        const judged =
          smoothstep(item.position[1] - 0.05, item.position[1] + 0.3, scanY) *
          reveal;

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

    // --- The sweep --------------------------------------------------------
    if (scanPlane.current) {
      const uniforms = (scanPlane.current.material as ShaderMaterial).uniforms;
      // Brightest while travelling, gone once the sweep has finished.
      const active = reveal * (1 - smoothstep(extent * 0.85, extent, scanY));
      uniforms.uOpacity.value = active * 0.55;
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
