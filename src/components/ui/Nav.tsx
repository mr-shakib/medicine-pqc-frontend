'use client';

import { SCENES } from '@/lib/scenes';
import { useActiveScene } from '@/hooks/useActiveScene';

/**
 * Minimal fixed header: wordmark left, chapter readout right.
 *
 * No background plate and no blur -- the grade underneath already guarantees
 * contrast, and a floating chrome bar would break the illusion that you are
 * looking into a space rather than at an interface.
 */
export default function Nav() {
  const active = useActiveScene();
  const scene = SCENES[active];

  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-40 flex items-center justify-between px-6 py-6 sm:px-12 lg:px-20">
      <a
        href="#medicine-core"
        className="pointer-events-auto flex items-baseline gap-2.5 text-sm tracking-tight text-n12"
      >
        <span
          className="inline-block h-1.5 w-1.5 rounded-full transition-colors duration-700"
          style={{ backgroundColor: 'var(--scene-accent)' }}
        />
        <span className="font-medium">MedSecure</span>
        <span className="text-n09">PQC</span>
      </a>

      <p className="eyebrow readout text-n09" aria-live="polite">
        <span className="hidden sm:inline">{scene.label} </span>
        <span className="text-n11">{String(active + 1).padStart(2, '0')}</span>
        <span className="mx-0.5">/</span>
        {String(SCENES.length).padStart(2, '0')}
      </p>
    </header>
  );
}
