'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group, Mesh } from 'three';
import Capsule, {
  type CapsuleHandle,
} from '@/components/three/objects/Capsule';
import DevStage from '@/components/dev/DevStage';
import { Panel, Slider, Toggle } from '@/components/dev/DevControls';
import type { QualityTier } from '@/lib/quality';

interface LabParams {
  separation: number;
  dissolveBody: number;
  dissolveCap: number;
  radius: number;
  length: number;
  capRatio: number;
  wallThickness: number;
  autoRotate: boolean;
  wireframe: boolean;
  spin: number;
}

const DEFAULTS: LabParams = {
  separation: 0,
  dissolveBody: 0,
  dissolveCap: 0,
  radius: 0.3,
  length: 1,
  capRatio: 0.46,
  wallThickness: 0.024,
  autoRotate: true,
  wireframe: false,
  spin: 0.25,
};

/** Drives the capsule imperatively from the lab's parameters. */
function Rig({ params, tier }: { params: LabParams; tier: QualityTier }) {
  const capsule = useRef<CapsuleHandle>(null);
  const pivot = useRef<Group>(null);

  // Wireframe is applied by walking the tree: the capsule owns its materials,
  // and an inspector has no business widening the component's public API.
  useEffect(() => {
    const root = capsule.current?.group;
    if (!root) return;
    root.traverse((child) => {
      const mesh = child as Mesh;
      const material = mesh.material as { wireframe?: boolean } | undefined;
      if (material && 'wireframe' in material) {
        material.wireframe = params.wireframe;
      }
    });
  }, [params.wireframe, params.radius, params.length, tier]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 20);
    capsule.current?.setSeparation(params.separation);
    capsule.current?.setDissolve(params.dissolveBody, 'body');
    capsule.current?.setDissolve(params.dissolveCap, 'cap');

    if (pivot.current && params.autoRotate) {
      pivot.current.rotation.y += dt * params.spin;
    }
  });

  return (
    <group ref={pivot}>
      <Capsule
        // Remount on any geometry parameter change so the lathe is rebuilt.
        key={`${params.radius}-${params.length}-${params.capRatio}-${params.wallThickness}-${tier}`}
        ref={capsule}
        dissolvable
        radius={params.radius}
        length={params.length}
        capRatio={params.capRatio}
        wallThickness={params.wallThickness}
        scale={1.5}
      />
    </group>
  );
}

/** Development inspector for the Capsule component. */
export default function CapsuleLab() {
  const [params, setParams] = useState<LabParams>(DEFAULTS);
  const [tier, setTier] = useState<QualityTier>('high');

  const set = useCallback(
    <K extends keyof LabParams>(key: K, value: LabParams[K]) =>
      setParams((current) => ({ ...current, [key]: value })),
    [],
  );

  return (
    <DevStage
      title="Capsule"
      tier={tier}
      onTierChange={setTier}
      camera={[2.9, 1.5, 3.8]}
      controls={
        <>
          <Panel title="Animation">
            <Slider
              label="Separation"
              value={params.separation}
              min={0}
              max={1}
              onChange={(v) => set('separation', v)}
            />
            <Slider
              label="Dissolve — body"
              value={params.dissolveBody}
              min={0}
              max={1}
              onChange={(v) => set('dissolveBody', v)}
            />
            <Slider
              label="Dissolve — cap"
              value={params.dissolveCap}
              min={0}
              max={1}
              onChange={(v) => set('dissolveCap', v)}
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
          </Panel>

          <Panel title="Geometry">
            <Slider
              label="Radius"
              value={params.radius}
              min={0.16}
              max={0.44}
              step={0.005}
              onChange={(v) => set('radius', v)}
            />
            <Slider
              label="Length"
              value={params.length}
              min={0.62}
              max={1.7}
              step={0.01}
              onChange={(v) => set('length', v)}
            />
            <Slider
              label="Cap ratio"
              value={params.capRatio}
              min={0.3}
              max={0.6}
              step={0.005}
              onChange={(v) => set('capRatio', v)}
            />
            <Slider
              label="Wall thickness"
              value={params.wallThickness}
              min={0.006}
              max={0.06}
              step={0.001}
              format={(v) => v.toFixed(3)}
              onChange={(v) => set('wallThickness', v)}
            />
            <Toggle
              label="Wireframe"
              value={params.wireframe}
              onChange={(v) => set('wireframe', v)}
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
