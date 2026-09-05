'use client';

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { Canvas } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { ACESFilmicToneMapping } from 'three';
import SceneManager from '@/components/three/SceneManager';
import ScrollController from '@/components/three/ScrollController';
import { useQualityTier } from '@/hooks/useQualityTier';
import { useViewportFlags } from '@/hooks/useViewportFlags';
import { usePointerParallax } from '@/hooks/usePointerParallax';
import { scrollStore } from '@/lib/scrollStore';
import { mark, neutral } from '@/lib/design/tokens';
import { getServerTheme, getTheme, subscribeTheme } from '@/lib/theme';
import { responsiveFov } from '@/lib/cameraPath';

/** The render resolution is never stepped below this fraction of a CSS pixel. */
const MIN_DPR = 0.75;
/** How much one step-down takes off the resolution ceiling. */
const DPR_STEP = 0.25;

/**
 * The root of the WebGL layer.
 *
 * Renders one fullscreen, fixed-position Canvas that lives for the whole session
 * and never remounts. The DOM content layer scrolls independently on top of it.
 */
export default function ThreeExperience() {
  const theme = useSyncExternalStore(subscribeTheme, getTheme, getServerTheme);
  const { tier, budget } = useQualityTier();
  const { isMobile, isTouch, reducedMotion } = useViewportFlags();
  const pointer = usePointerParallax(!isTouch);
  const [ready, setReady] = useState(false);
  const [contextLost, setContextLost] = useState(false);

  /*
    The resolution ceiling, and the only quality setting that ever changes at
    runtime.

    The old response to a slow device was to drop the whole quality tier, which
    rebuilt every material and recompiled every shader -- a stall of a second or
    more, in the middle of scrolling, in the name of performance. Now a slow
    device has its resolution stepped down instead: a single buffer resize,
    taken at most twice, and never stepped back up so the frame does not pop
    between two sizes as the scroll starts and stops.
  */
  const [dprCap, setDprCap] = useState(budget.dpr[1]);
  const dpr = Math.min(
    Math.max(
      typeof window === 'undefined' ? 1 : window.devicePixelRatio,
      budget.dpr[0],
    ),
    dprCap,
  );

  /** Fade the canvas in only once every shader has compiled and drawn. */
  const handleReady = useCallback(() => {
    scrollStore.ready = true;
    setReady(true);
  }, []);

  const handleDecline = useCallback(() => {
    setDprCap((cap) => Math.max(MIN_DPR, Math.round((cap - DPR_STEP) * 100) / 100));
  }, []);

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
          /*
            The 3D layer takes the pointer so chapter 08's records can be
            clicked, and the DOM spine above it is transparent to the pointer
            so they can be reached.

            Scrolling is unaffected: R3F sets no `touch-action` of its own, and
            a fixed element receiving pointer events does not stop the document
            scrolling under it. The one thing that would is a handler calling
            preventDefault on wheel or touchmove, and the only one in the piece
            is the dossier's own scroll lock, which is deliberate.
          */
          pointerEvents: 'auto',
        }}
        /*
          Still hidden from assistive technology: it is a decorative rendering
          of copy that is already in the DOM, and the one thing in it that can
          be clicked has a real button in `TeamRoster` standing for it.
        */
        aria-hidden="true"
      >
        <Canvas
          dpr={dpr}
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
            /*
              Per palette. ACES maps an input of 1.0 to roughly 0.8, so the
              light ground rendered at the dark palette's exposure comes out a
              flat grey instead of paper. Set here for the first frame and
              again imperatively by `SceneManager` on every rebuild, since the
              `gl` prop is only read when the renderer is created.
            */
            toneMappingExposure: mark.exposure,
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
        >
          <color attach="background" args={[neutral.n00]} />

          {/*
            Rebuilt from scratch when the palette changes.

            Every material in the piece reads its colours, its blending mode
            and its emissive lift once, at construction. A theme is not a
            uniform that can be eased across a live scene -- half of it is
            whether a mark is ADDED to the ground or laid onto it, which is
            baked into the compiled program -- so the honest way to change it
            is to build the world again. It costs one `Precompile` pass, which
            is the same pass the page already runs at load, and the scrim below
            covers it.
          */}
          <SceneManager
            key={theme}
            budget={budget}
            mobile={isMobile}
            reducedMotion={reducedMotion}
            pointer={pointer}
            onReady={handleReady}
          />

          {/*
            Only once the world is warm. The compile pass itself produces a
            few very slow frames, and they must not be read as a slow device.
          */}
          {ready ? <PerformanceMonitor onDecline={handleDecline} /> : null}
        </Canvas>
      </div>

      {/*
        Covers the rebuild. Keyed on the theme so it simply REMOUNTS and runs
        its own fade-out -- no state, no timer, and nothing to get stuck on if
        a swap happens while one is already running.
      */}
      <div
        key={theme}
        aria-hidden="true"
        className="theme-scrim pointer-events-none fixed inset-0 z-[6] bg-n00"
      />

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
          tier: {tier} · dpr: {dpr}
        </div>
      ) : null}
    </>
  );
}
