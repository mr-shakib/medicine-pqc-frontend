'use client';

import { useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useIsomorphicLayoutEffect } from '@/hooks/useIsomorphicLayoutEffect';
import { scrollStore, resetScrollStore } from '@/lib/scrollStore';
import { sceneAccent, sceneAt, progressToSection } from '@/lib/scenes';

if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

/**
 * The single source of scroll truth for the entire page.
 *
 * One ScrollTrigger spans the whole document and writes into the non-reactive
 * `scrollStore`. Nothing here calls setState, so scrolling costs zero React
 * work. The only DOM write is a CSS custom property for the active accent.
 *
 * Renders nothing.
 */
export default function ScrollController() {
  const lastProgress = useRef(0);
  const lastTime = useRef(0);

  useIsomorphicLayoutEffect(() => {
    resetScrollStore();

    // The mobile URL bar collapsing must not thrash layout or re-fire triggers.
    ScrollTrigger.config({ ignoreMobileResize: true });

    // Defuses iOS Safari rubber-banding and address-bar scroll jitter.
    if (window.matchMedia('(pointer: coarse)').matches) {
      ScrollTrigger.normalizeScroll(true);
    }

    // Anchor to the scroll spine, NOT the document: anything after it (the
    // footer) must not compress the progress range, or every scene would drift
    // out of alignment with its camera keyframe.
    const spine = document.querySelector<HTMLElement>('[data-scroll-spine]');
    if (!spine) return;

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: spine,
        start: 'top top',
        end: 'bottom bottom',
        scrub: true,
        onUpdate: (self) => {
          const progress = self.progress;
          const now = performance.now();
          const dt = Math.max((now - lastTime.current) / 1000, 1 / 240);

          scrollStore.velocity = (progress - lastProgress.current) / dt;
          scrollStore.progress = progress;

          lastProgress.current = progress;
          lastTime.current = now;

          const scene = sceneAt(progress);
          if (scene !== scrollStore.scene) {
            scrollStore.scene = scene;
            document.documentElement.style.setProperty(
              '--scene-accent',
              sceneAccent(scene),
            );
          }
          scrollStore.sceneProgress = progressToSection(progress) - scene + 0.5;
        },
      });
    });

    const onResize = () => ScrollTrigger.refresh();
    let resizeTimer = 0;
    const debouncedResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(onResize, 150);
    };
    window.addEventListener('resize', debouncedResize);

    // Content below the fold mounts after hydration; recompute once settled.
    const refreshTimer = window.setTimeout(() => ScrollTrigger.refresh(), 200);

    return () => {
      window.clearTimeout(resizeTimer);
      window.clearTimeout(refreshTimer);
      window.removeEventListener('resize', debouncedResize);
      ScrollTrigger.normalizeScroll(false);
      ctx.revert();
    };
  }, []);

  return null;
}
