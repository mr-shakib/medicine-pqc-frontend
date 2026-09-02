'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group, Mesh } from 'three';
import SerumBottle, {
  type SerumBottleHandle,
  type VialPart,
} from '@/components/three/objects/SerumBottle';
import DevStage from '@/components/dev/DevStage';
import { Panel, Segmented, Slider, Toggle } from '@/components/dev/DevControls';
import { accent } from '@/lib/design/tokens';
import type { QualityTier } from '@/lib/quality';

interface LabParams {
  fill: number;
  dissolve: number;
  dissolvePart: VialPart | 'all';
  serum: string;
  bodyRadius: number;
  bodyHeight: number;
  neckRadius: number;
  wallThickness: number;
  showGlass: boolean;
  showLiquid: boolean;
  showStopper: boolean;
  showCap: boolean;
  showLabel: boolean;
  autoRotate: boolean;
  spin: number;
  wireframe: boolean;
}

const DEFAULTS: LabParams = {
  fill: 0.72,
  dissolve: 0,
  dissolvePart: 'all',
  serum: accent.analysis.base,
  bodyRadius: 0.3,
  bodyHeight: 0.6,
  neckRadius: 0.17,
  wallThickness: 0.022,
  showGlass: true,
  showLiquid: true,
  showStopper: true,
  showCap: true,
  showLabel: true,
  autoRotate: true,
  spin: 0.28,
  wireframe: false,
};

function Rig({ params, tier }: { params: LabParams; tier: QualityTier }) {
  const vial = useRef<SerumBottleHandle>(null);
  const pivot = useRef<Group>(null);

  useEffect(() => {
    const handle = vial.current;
    if (!handle) return;
    handle.setVisible('glass', params.showGlass);
    handle.setVisible('liquid', params.showLiquid && params.fill > 0.004);
    handle.setVisible('stopper', params.showStopper);
    handle.setVisible('cap', params.showCap);
    handle.setVisible('label', params.showLabel);
  }, [params, tier]);

  useEffect(() => {
    const root = vial.current?.group;
    if (!root) return;
    root.traverse((child) => {
      const mesh = child as Mesh;
      const material = mesh.material as { wireframe?: boolean } | undefined;
      if (material && 'wireframe' in material) {
        material.wireframe = params.wireframe;
      }
    });
  }, [params.wireframe, params.bodyRadius, params.bodyHeight, tier]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 20);
    const handle = vial.current;
    if (!handle) return;

    handle.setFill(params.fill);
    // Reset every part first, so switching the target part does not leave the
    // previous one stuck mid-dissolve.
    handle.setDissolve(0);
    if (params.dissolvePart === 'all') handle.setDissolve(params.dissolve);
    else handle.setDissolve(params.dissolve, params.dissolvePart);

    if (pivot.current && params.autoRotate) {
      pivot.current.rotation.y += dt * params.spin;
    }
  });

  return (
    <group ref={pivot}>
      <SerumBottle
        key={`${params.bodyRadius}-${params.bodyHeight}-${params.neckRadius}-${params.wallThickness}-${tier}-${params.showLabel}`}
        ref={vial}
        dissolvable
        serumColor={params.serum}
        bodyRadius={params.bodyRadius}
        bodyHeight={params.bodyHeight}
        neckRadius={params.neckRadius}
        wallThickness={params.wallThickness}
        label={params.showLabel}
        scale={2.4}
      />
    </group>
  );
}

/** Development inspector for the SerumBottle component. */
export default function SerumBottleLab() {
  const [params, setParams] = useState<LabParams>(DEFAULTS);
  const [tier, setTier] = useState<QualityTier>('high');

  const set = useCallback(
    <K extends keyof LabParams>(key: K, value: LabParams[K]) =>
      setParams((current) => ({ ...current, [key]: value })),
    [],
  );

  return (
    <DevStage
      title="Serum vial"
      tier={tier}
      onTierChange={setTier}
      camera={[2.2, 1.1, 3.2]}
      groundY={-1.35}
      controls={
        <>
          <Panel title="Contents">
            <Slider
              label="Fill level"
              value={params.fill}
              min={0}
              max={1}
              onChange={(v) => set('fill', v)}
            />
            <Segmented
              label="Serum"
              value={params.serum}
              options={[
                { label: 'Analysis', value: accent.analysis.base },
                { label: 'Pharma', value: accent.pharma.base },
                { label: 'Lattice', value: accent.lattice.base },
              ]}
              onChange={(v) => set('serum', v)}
            />
          </Panel>

          <Panel title="Parts">
            {(
              [
                ['Glass', 'showGlass'],
                ['Liquid', 'showLiquid'],
                ['Stopper', 'showStopper'],
                ['Crimp cap', 'showCap'],
                ['Label', 'showLabel'],
              ] as const
            ).map(([label, key]) => (
              <Toggle
                key={key}
                label={label}
                value={params[key]}
                onChange={(v) => set(key, v)}
              />
            ))}
          </Panel>

          <Panel title="Dissolve">
            <Slider
              label="Amount"
              value={params.dissolve}
              min={0}
              max={1}
              onChange={(v) => set('dissolve', v)}
            />
            <Segmented
              label="Target"
              value={params.dissolvePart}
              options={[
                { label: 'All', value: 'all' as const },
                { label: 'Glass', value: 'glass' as const },
                { label: 'Liquid', value: 'liquid' as const },
              ]}
              onChange={(v) => set('dissolvePart', v)}
            />
          </Panel>

          <Panel title="Geometry">
            <Slider
              label="Body radius"
              value={params.bodyRadius}
              min={0.18}
              max={0.44}
              step={0.005}
              onChange={(v) => set('bodyRadius', v)}
            />
            <Slider
              label="Body height"
              value={params.bodyHeight}
              min={0.34}
              max={1}
              step={0.01}
              onChange={(v) => set('bodyHeight', v)}
            />
            <Slider
              label="Neck radius"
              value={params.neckRadius}
              min={0.1}
              max={0.26}
              step={0.005}
              onChange={(v) => set('neckRadius', v)}
            />
            <Slider
              label="Wall thickness"
              value={params.wallThickness}
              min={0.008}
              max={0.05}
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

          <Panel title="Animation">
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
