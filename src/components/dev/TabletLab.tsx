'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  type Group,
  type Points,
} from 'three';
import Tablet, { type TabletHandle } from '@/components/three/objects/Tablet';
import DevStage from '@/components/dev/DevStage';
import { Panel, Slider, Toggle } from '@/components/dev/DevControls';
import { accent } from '@/lib/design/tokens';
import type { QualityTier } from '@/lib/quality';

interface LabParams {
  dissolve: number;
  radius: number;
  bandHeight: number;
  capHeight: number;
  bevel: number;
  reliefDepth: number;
  score: boolean;
  marking: boolean;
  autoRotate: boolean;
  spin: number;
  tumble: number;
  wireframe: boolean;
  showSamples: boolean;
  sampleCount: number;
}

const DEFAULTS: LabParams = {
  dissolve: 0,
  radius: 0.62,
  bandHeight: 0.1,
  capHeight: 0.13,
  bevel: 0.03,
  reliefDepth: 0.45,
  score: true,
  marking: true,
  autoRotate: true,
  spin: 0.3,
  tumble: 0.35,
  wireframe: false,
  showSamples: false,
  sampleCount: 1200,
};

/**
 * Visualises the surface sampler's output — the cloud a particle
 * transformation would morph to and from. Worth seeing directly: an uneven
 * distribution is invisible in a still render and obvious the moment the
 * particles move.
 *
 * The buffer is allocated up front and filled from the frame loop rather than
 * from an effect. The sample has to come off the tablet's imperative handle,
 * and a ref may only be read once rendering has committed.
 */
function SurfacePreview({
  tablet,
  count,
  visible,
}: {
  tablet: React.RefObject<TabletHandle | null>;
  count: number;
  visible: boolean;
}) {
  const points = useRef<Points>(null);
  const filled = useRef(false);

  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute(
      'position',
      new BufferAttribute(new Float32Array(count * 3), 3),
    );
    return g;
  }, [count]);

  useEffect(() => {
    filled.current = false;
    return () => geometry.dispose();
  }, [geometry, visible]);

  useFrame(() => {
    if (filled.current || !visible) return;
    const handle = tablet.current;
    const node = points.current;
    if (!handle || !node) return;

    // Reached through the rendered object rather than the memoised handle:
    // the buffer is written every time the cloud is rebuilt, which belongs to
    // the scene graph rather than to render output.
    const target = node.geometry;
    const attribute = target.attributes.position as BufferAttribute;
    (attribute.array as Float32Array).set(handle.sampleSurface(count).positions);
    attribute.needsUpdate = true;
    target.computeBoundingSphere();
    filled.current = true;
  });

  if (!visible) return null;

  return (
    <points ref={points} geometry={geometry}>
      <pointsMaterial
        color={accent.analysis.light}
        size={0.012}
        sizeAttenuation
        transparent
        opacity={0.9}
        blending={AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </points>
  );
}

/** Drives the tablet imperatively from the lab's parameters. */
function Rig({ params, tier }: { params: LabParams; tier: QualityTier }) {
  const tablet = useRef<TabletHandle>(null);
  const pivot = useRef<Group>(null);

  useEffect(() => {
    const mesh = tablet.current?.mesh;
    if (!mesh) return;
    const material = mesh.material as { wireframe?: boolean };
    if ('wireframe' in material) material.wireframe = params.wireframe;
  }, [params.wireframe, params.radius, params.capHeight, tier]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 1 / 20);
    tablet.current?.setDissolve(params.dissolve);

    if (pivot.current && params.autoRotate) {
      pivot.current.rotation.y += dt * params.spin;
      // A slow tilt as well: a flat object seen only edge-on or only face-on
      // hides exactly the shoulder this geometry exists to get right.
      pivot.current.rotation.x =
        Math.sin(state.clock.elapsedTime * 0.35) * params.tumble;
    }
  });

  const key = `${params.radius}-${params.bandHeight}-${params.capHeight}-${params.bevel}-${tier}-${params.score}-${params.marking}-${params.reliefDepth}`;

  return (
    <group ref={pivot}>
      <Tablet
        key={key}
        ref={tablet}
        dissolvable
        radius={params.radius}
        bandHeight={params.bandHeight}
        capHeight={params.capHeight}
        bevel={params.bevel}
        score={params.score}
        marking={params.marking ? 'MSP' : ''}
        reliefDepth={params.reliefDepth}
        scale={2.2}
      />
      <group scale={2.2}>
        <SurfacePreview
          tablet={tablet}
          count={params.sampleCount}
          visible={params.showSamples}
        />
      </group>
    </group>
  );
}

/** Development inspector for the Tablet component. */
export default function TabletLab() {
  const [params, setParams] = useState<LabParams>(DEFAULTS);
  const [tier, setTier] = useState<QualityTier>('high');

  const set = useCallback(
    <K extends keyof LabParams>(key: K, value: LabParams[K]) =>
      setParams((current) => ({ ...current, [key]: value })),
    [],
  );

  return (
    <DevStage
      title="Tablet"
      tier={tier}
      onTierChange={setTier}
      camera={[2.4, 1.7, 3.2]}
      controls={
        <>
          <Panel title="Animation">
            <Slider
              label="Dissolve"
              value={params.dissolve}
              min={0}
              max={1}
              onChange={(v) => set('dissolve', v)}
            />
            <Toggle
              label="Auto rotate"
              value={params.autoRotate}
              onChange={(v) => set('autoRotate', v)}
            />
            <Slider
              label="Spin rate"
              value={params.spin}
              min={0}
              max={1.5}
              onChange={(v) => set('spin', v)}
            />
            <Slider
              label="Tumble"
              value={params.tumble}
              min={0}
              max={1.4}
              onChange={(v) => set('tumble', v)}
            />
          </Panel>

          <Panel title="Geometry">
            <Slider
              label="Radius"
              value={params.radius}
              min={0.3}
              max={0.9}
              step={0.005}
              onChange={(v) => set('radius', v)}
            />
            <Slider
              label="Band height"
              value={params.bandHeight}
              min={0.04}
              max={0.34}
              step={0.005}
              onChange={(v) => set('bandHeight', v)}
            />
            <Slider
              label="Cup height"
              value={params.capHeight}
              min={0.03}
              max={0.26}
              step={0.005}
              onChange={(v) => set('capHeight', v)}
            />
            <Slider
              label="Bevel"
              value={params.bevel}
              min={0.005}
              max={0.09}
              step={0.001}
              format={(v) => v.toFixed(3)}
              onChange={(v) => set('bevel', v)}
            />
            <Toggle
              label="Wireframe"
              value={params.wireframe}
              onChange={(v) => set('wireframe', v)}
            />
          </Panel>

          <Panel title="Relief">
            <Toggle
              label="Score line"
              value={params.score}
              onChange={(v) => set('score', v)}
            />
            <Toggle
              label="Engraving"
              value={params.marking}
              onChange={(v) => set('marking', v)}
            />
            <Slider
              label="Relief strength"
              value={params.reliefDepth}
              min={0}
              max={1.2}
              step={0.01}
              format={(v) => v.toFixed(2)}
              onChange={(v) => set('reliefDepth', v)}
            />
          </Panel>

          <Panel title="Particle integration">
            <Toggle
              label="Show surface samples"
              value={params.showSamples}
              onChange={(v) => set('showSamples', v)}
            />
            <Slider
              label="Sample count"
              value={params.sampleCount}
              min={200}
              max={6000}
              step={100}
              format={(v) => String(Math.round(v))}
              onChange={(v) => set('sampleCount', Math.round(v))}
            />
          </Panel>

          <button
            type="button"
            onClick={() => setParams(DEFAULTS)}
            className="border border-n07 px-3 py-2 text-[11px] text-n10 transition-colors hover:border-n08 hover:text-n11"
          >
            Reset
          </button>
        </>
      }
    >
      <Rig params={params} tier={tier} />
    </DevStage>
  );
}
