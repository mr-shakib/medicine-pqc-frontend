'use client';

import { SCENES } from '@/lib/scenes';
import { accent } from '@/lib/design/tokens';
import { useActiveScene } from '@/hooks/useActiveScene';

/**
 * Chapter rail: eight hairlines on the right edge, the active one extended and
 * tinted. Doubles as keyboard-accessible navigation -- each mark is a real
 * anchor, so the whole page is traversable without a pointer.
 */
export default function SceneRail() {
  const active = useActiveScene();

  return (
    <nav
      aria-label="Chapter navigation"
      className="fixed right-5 top-1/2 z-40 hidden -translate-y-1/2 sm:block lg:right-9"
    >
      <ul className="flex flex-col gap-4">
        {SCENES.map((scene) => {
          const isActive = scene.index === active;
          return (
            <li key={scene.id}>
              <a
                href={`#${scene.id}`}
                aria-label={`${scene.label}: ${scene.title}`}
                aria-current={isActive ? 'true' : undefined}
                className="group flex items-center justify-end gap-3 py-1"
              >
                <span
                  className="eyebrow translate-x-1 opacity-0 transition-all duration-500 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100"
                  style={{ color: accent[scene.accent].light }}
                >
                  {scene.label}
                </span>
                <span
                  className="block h-px transition-all duration-700 ease-[var(--ease-out-premium)]"
                  style={{
                    width: isActive ? 26 : 12,
                    backgroundColor: isActive
                      ? accent[scene.accent].light
                      : 'var(--color-n08)',
                  }}
                />
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
