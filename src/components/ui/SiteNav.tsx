'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV_LINKS } from '@/lib/navigation';
import { SCENES } from '@/lib/scenes';
import { useActiveScene } from '@/hooks/useActiveScene';
import { useNavReveal } from '@/hooks/useNavReveal';
import ThemeToggle from '@/components/ui/ThemeToggle';

/**
 * The site bar.
 *
 * Three columns on a grid rather than a flex row with a centred child, so the
 * capsule is centred on the VIEWPORT and not on whatever space the wordmark and
 * the controls leave over. It is the difference between a bar that looks set
 * and one that drifts a few pixels as the chapter readout changes width.
 *
 * The bar itself has no plate: it is the capsule that carries the glass, so
 * what floats over the page is a single considered shape rather than a full-
 * width strip of frosted panel. On the home page the whole thing withdraws as
 * the story is scrolled -- see `useNavReveal`.
 */
export default function SiteNav() {
  const pathname = usePathname();
  const isHome = pathname === '/';
  const visible = useNavReveal(isHome);

  const active = useActiveScene();
  const scene = SCENES[active];

  return (
    <header
      className={[
        'chrome-fade pointer-events-none fixed inset-x-0 top-0 z-40',
        'transition-[transform,opacity] duration-500 ease-[var(--ease-out-premium)]',
        visible ? 'translate-y-0 opacity-100' : '-translate-y-6 opacity-0',
      ].join(' ')}
      // Nothing in a withdrawn bar should be reachable by the keyboard either.
      inert={!visible || undefined}
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-5 py-4 sm:px-12 sm:py-5 lg:px-20">
        <Link
          href="/"
          className="pointer-events-auto flex items-baseline gap-2 justify-self-start text-sm tracking-tight text-n12 sm:gap-2.5"
        >
          <span
            className="inline-block h-1.5 w-1.5 shrink-0 rounded-full transition-colors duration-700"
            style={{ backgroundColor: 'var(--scene-accent)' }}
          />
          <span className="font-medium">MedSecure</span>
          <span className="hidden text-n09 sm:inline">PQC</span>
        </Link>

        <nav aria-label="Sections" className="pointer-events-auto justify-self-center">
          <ul className="flex items-center gap-0.5 rounded-full border border-n06/70 bg-n00/55 p-1 backdrop-blur-xl sm:gap-1">
            {NAV_LINKS.map((link) => {
              /*
                Home matches exactly; everything else matches by prefix, so a
                record open at `/team?record=...` still marks Team as current.
                A `startsWith` on "/" would light up every page at once.
              */
              const current =
                link.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(link.href);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={current ? 'page' : undefined}
                    className={[
                      'eyebrow block whitespace-nowrap rounded-full px-3 py-1.5 transition-colors duration-300 sm:px-4',
                      current
                        ? 'bg-n04 text-n12'
                        : 'text-n10 hover:text-n12',
                    ].join(' ')}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-4 justify-self-end sm:gap-5">
          {/* The chapter readout belongs to the story, so it only appears on it. */}
          {isHome ? (
            <p
              className="eyebrow readout hidden text-n09 sm:block"
              aria-live="polite"
            >
              <span className="hidden lg:inline">{scene.label} </span>
              <span className="text-n11">
                {String(active + 1).padStart(2, '0')}
              </span>
              <span className="mx-0.5">/</span>
              {String(SCENES.length).padStart(2, '0')}
            </p>
          ) : null}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
