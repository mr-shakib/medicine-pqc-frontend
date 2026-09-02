'use client';

import { useState, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import { Grid, OrbitControls } from '@react-three/drei';
import { ACESFilmicToneMapping } from 'three';
import Lighting from '@/components/three/Lighting';
import { QualityProvider } from '@/components/three/QualityProvider';
import { StudioEnvironment } from '@/components/three/effects';
import PerfProbe, { type PerfStats } from '@/components/dev/PerfProbe';
import { Panel, Segmented } from '@/components/dev/DevControls';
import { BUDGETS, type QualityTier } from '@/lib/quality';
import { neutral } from '@/lib/design/tokens';

export interface DevStageProps {
  /** Name of the component under inspection. */
  title: string;
  /** Quality tier, owned by the lab so it can drive geometry keys too. */
  tier: QualityTier;
  onTierChange: (tier: QualityTier) => void;
  /** Control panels for the component's own parameters. */
  controls: ReactNode;
  /** Initial camera position. */
  camera?: [number, number, number];
  /** Height of the ground grid below the subject. */
  groundY?: number;
  children: ReactNode;
}

/**
 * Shared shell for the development inspectors.
 *
 * Every lab runs its subject under the REAL production lighting rig and
 * reflection environment. Inspecting a material under a convenient studio light
 * tells you nothing about how it will look in the piece — and it is how two
 * objects meant to share a design language quietly drift apart.
 */
export default function DevStage({
  title,
  tier,
  onTierChange,
  controls,
  camera = [2.9, 1.5, 3.8],
  groundY = -1.6,
  children,
}: DevStageProps) {
  const [stats, setStats] = useState<PerfStats | null>(null);
  const budget = BUDGETS[tier];

  return (
    <div className="fixed inset-0 flex bg-n00">
      <div className="relative flex-1">
        <Canvas
          dpr={budget.dpr}
          shadows="percentage"
          gl={{
            antialias: true,
            alpha: false,
            toneMapping: ACESFilmicToneMapping,
            toneMappingExposure: 0.94,
          }}
          camera={{ position: camera, fov: 38, near: 0.1, far: 60 }}
        >
          <color attach="background" args={[neutral.n01]} />

          <QualityProvider budget={budget}>
            <StudioEnvironment budget={budget} />
            <Lighting shadows={budget.shadows} />
            {children}
          </QualityProvider>

          <Grid
            position={[0, groundY, 0]}
            args={[20, 20]}
            cellSize={0.25}
            cellThickness={0.5}
            cellColor={neutral.n06}
            sectionSize={1}
            sectionThickness={0.8}
            sectionColor={neutral.n08}
            fadeDistance={16}
            fadeStrength={1.5}
            infiniteGrid
          />

          <OrbitControls
            makeDefault
            enablePan
            minDistance={1}
            maxDistance={16}
            target={[0, 0, 0]}
          />

          <PerfProbe onSample={setStats} />
        </Canvas>

        <p className="eyebrow pointer-events-none absolute bottom-5 left-6 text-n09">
          Drag to orbit · scroll to zoom · right-drag to pan
        </p>
      </div>

      <aside className="h-full w-[310px] shrink-0 overflow-y-auto border-l border-n06/70 bg-n01 px-5 py-6">
        <header className="mb-5">
          <p className="eyebrow text-[var(--scene-accent)]">Dev — inspector</p>
          <h1 className="display-m mt-2 text-2xl">{title}</h1>
        </header>

        <div className="flex flex-col gap-5">
          {controls}

          <Panel title="Quality tier">
            <Segmented
              label="Budget"
              value={tier}
              options={[
                { label: 'Low', value: 'low' as QualityTier },
                { label: 'Medium', value: 'medium' as QualityTier },
                { label: 'High', value: 'high' as QualityTier },
              ]}
              onChange={onTierChange}
            />
          </Panel>

          <Panel title="Renderer">
            <dl className="grid grid-cols-2 gap-x-3 gap-y-2">
              {[
                ['FPS', stats?.fps],
                ['Draw calls', stats?.drawCalls],
                ['Triangles', stats?.triangles],
                ['Geometries', stats?.geometries],
                ['Textures', stats?.textures],
                ['Programs', stats?.programs],
              ].map(([label, value]) => (
                <div key={String(label)} className="contents">
                  <dt className="eyebrow text-n09">{label}</dt>
                  <dd className="readout text-right text-[11px] text-n11">
                    {value === undefined ? '—' : value.toLocaleString()}
                  </dd>
                </div>
              ))}
            </dl>
          </Panel>

          <nav className="flex gap-2 border-t border-n06/70 pt-4">
            {[
              ['Capsule', '/dev/capsule'],
              ['Tablet', '/dev/tablet'],
              ['Vial', '/dev/serum'],
            ].map(([label, href]) => (
              <a
                key={href}
                href={href}
                className="flex-1 border border-n07 px-1.5 py-1.5 text-center text-[10px] text-n10 transition-colors hover:border-n08 hover:text-n11"
              >
                {label}
              </a>
            ))}
          </nav>
        </div>
      </aside>
    </div>
  );
}
