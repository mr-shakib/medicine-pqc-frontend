'use client';

import { useCallback, useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerformanceMonitor, Preload } from '@react-three/drei';
import { ACESFilmicToneMapping } from 'three';
import SceneManager from '@/components/three/SceneManager';
import ScrollController from '@/components/three/ScrollController';
import { useQualityTier } from '@/hooks/useQualityTier';
import { useViewportFlags } from '@/hooks/useViewportFlags';
import { usePointerParallax } from '@/hooks/usePointerParallax';
import { scrollStore } from '@/lib/scrollStore';
import { neutral } from '@/lib/design/tokens';
import { responsiveFov } from '@/lib/cameraPath';
import type { QualityTier } from '@/lib/quality';

const TIER_ORDER: QualityTier[] = ['low', 'medium', 'high'];

/**
 * The root of the WebGL layer.
 *
 * Renders one fullscreen, fixed-position Canvas that lives for the whole session
 * and never remounts. The DOM content layer scrolls independently on top of it.
 */
export default function ThreeExperience() {
  const { tier, budget, setTier } = useQualityTier();
  const { isMobile, isTouch, reducedMotion } = useViewportFlags();
  const pointer = usePointerParallax(!isTouch);
  const [ready, setReady] = useState(false);
  const [contextLost, setContextLost] = useState(false);

  /** Fade the canvas in only once the first frame has actually been drawn. */
  const handleCreated = useCallback(() => {
    scrollStore.ready = true;
    setReady(true);
  }, []);

  /** Step the quality tier down when frames are consistently slow. */
  const handleDecline = useCallback(() => {
    setTier((current) => {
      const i = TIER_ORDER.indexOf(current);
      return TIER_ORDER[Math.max(0, i - 1)];
    });
  }, [setTier]);

  // WebGL context loss is a real failure mode on mobile Safari under memory
  // pressure; recover rather than leaving a dead black rectangle.
  useEffect(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;

    const onLost = (event: Event) => {
      event.preventDefault();
      setContextLost(true);
    };
    const onRestored = () => setContextLost(false);

    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);
    return () => {
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
    };
  }, [ready]);

  return (
    <>
      <ScrollController />

      <div
        className="fixed inset-0 z-0 transition-opacity duration-1000"
        style={{
          opacity: ready ? 1 : 0,
          // Scrolling must never be captured by the 3D layer.
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      >
        <Canvas
          dpr={budget.dpr}
          gl={{
            antialias: budget.samples > 0,
            alpha: false,
            powerPreference: 'high-performance',
            stencil: false,
            depth: true,
            /*
              ACES filmic stops bright emissive accents from clipping to flat
              white and keeps highlight rolloff photographic. The slightly sub-1
              exposure keeps the chamber genuinely dark rather than lifted.
            */
            toneMapping: ACESFilmicToneMapping,
            toneMappingExposure: 0.94,
            /*
              Transmissive materials cost a full extra render of the scene into
              a backbuffer. Halving that buffer's resolution quarters its
              fragment cost, and the difference is invisible: the result is only
              ever sampled through a refracting surface that is already blurring
              and distorting it.
            */
            transmissionResolutionScale: 0.5,
          }}
          camera={{
            fov: responsiveFov(1.6),
            near: 0.1,
            far: 200,
            position: [0, 0.6, 9],
          }}
          // 'percentage' maps to PCFShadowMap; R3F's `true` selects the
          // PCFSoftShadowMap that three 0.185 deprecated.
          shadows={budget.shadows ? 'percentage' : false}
          onCreated={handleCreated}
        >
          <color attach="background" args={[neutral.n00]} />

          <PerformanceMonitor
            onDecline={handleDecline}
            flipflops={3}
            factor={1}
          >
            <SceneManager
              budget={budget}
              mobile={isMobile}
              reducedMotion={reducedMotion}
              pointer={pointer}
            />
          </PerformanceMonitor>

          {/*
            No AdaptiveDpr.

            Dropping resolution while scrolling is the textbook fix for a
            scroll-driven scene, and on this content it is unusable: the canvas
            keeps a fixed CSS size, so every change rescales the drawing buffer
            and the whole frame visibly pops — twice per scroll gesture, once
            down and once back. On large, soft, dark surfaces that reads as the
            UI flashing.

            The resolution is therefore fixed, and the fragment cost it was
            chasing is taken out permanently instead: a lower DPR ceiling and
            fewer clearcoat lobes. Both are invisible; a resolution pop is not.
          */}
          <Preload all />
        </Canvas>
      </div>

      {contextLost ? (
        <div
          role="status"
          className="fixed inset-x-0 bottom-6 z-50 mx-auto w-fit rounded-full border border-white/10 bg-abyss/90 px-4 py-2 text-xs text-ink-muted backdrop-blur"
        >
          Restoring 3D context…
        </div>
      ) : null}

      {process.env.NEXT_PUBLIC_DEBUG === '1' ? (
        <div className="pointer-events-none fixed bottom-3 left-3 z-50 font-mono text-[10px] text-ink-muted">
          tier: {tier}
        </div>
      ) : null}
    </>
  );
}
