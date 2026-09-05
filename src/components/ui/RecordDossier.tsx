'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import {
  closeDossier,
  dossierRecord,
  getDossierServerSnapshot,
  getDossierSnapshot,
  isDossierOpen,
  showDossier,
  subscribeDossier,
} from '@/lib/dossierStore';
import { scrollStore } from '@/lib/scrollStore';
import { PROJECT, ROLE_BRIEF, TEAM, TEAM_COUNT, memberIndex } from '@/lib/team';

/** How long a deep link waits for the 3D world before opening regardless. */
const WORLD_WAIT = 5000;

/** Query key carrying the open record, so a dossier can be linked to. */
const PARAM = 'record';

/**
 * Where the dossier is being shown, which decides who draws the subject.
 *
 * `canvas` -- over the chapter 08 registry. The figure is a real object in the
 * scene, and `TeamRegistry` carries it out of the ring to a mark in the half
 * of the frame the panel leaves. This component draws only the document.
 *
 * `page` -- over an ordinary document, where there is no scene to take the
 * subject out of. The same half of the frame is filled with the record's
 * photograph instead, so the composition is the one the reader already knows
 * from the story rather than a panel over nothing.
 */
export type DossierSurface = 'canvas' | 'page';

export interface RecordDossierProps {
  surface?: DossierSurface;
}

/**
 * The detail view for one team record.
 *
 * Opened by clicking a record in the chapter 08 registry, by tabbing to it in
 * the roster, by choosing someone on the team page, or by loading any of those
 * with `?record=<slug>`. It is not a separate route, on either surface: on the
 * canvas, navigating away would tear down the WebGL context and with it the
 * figure the panel is written around; on the team page, a route change would
 * throw away the grid the reader was reading and give them a page load in
 * place of a transition. What it does instead is behave like a page -- its own
 * URL, its own history entry, back closes it -- without leaving the one it is
 * on.
 */
export default function RecordDossier({
  surface = 'canvas',
}: RecordDossierProps) {
  const onCanvas = surface === 'canvas';
  const snapshot = useSyncExternalStore(
    subscribeDossier,
    getDossierSnapshot,
    getDossierServerSnapshot,
  );
  const open = isDossierOpen(snapshot);
  /** The record on screen -- still set while the panel animates out. */
  const index = dossierRecord(snapshot);

  const overlay = useRef<HTMLDivElement>(null);
  /** Where the page stood when the record opened, restored when it closes. */
  const lockedY = useRef(0);
  const panel = useRef<HTMLDivElement>(null);
  /** The only region inside the panel that scrolls. */
  const scroller = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const person = TEAM[index];
  const role = ROLE_BRIEF[person.role];

  /* ---------------------------------------------------------------- close - */

  const close = useCallback(() => {
    /*
      Only an entry this component PUSHED can be closed by going back. A
      dossier that arrived in the address bar is stamped onto the entry the
      page loaded with, and going back from that leaves the site entirely --
      or, worse, returns to the same entry with the record still in the query,
      which is what it did before the distinction existed. That one tidies the
      address bar in place instead.
    */
    if (window.history.state?.pushed) {
      window.history.back();
      return;
    }
    closeDossier();
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  /* ------------------------------------------------------------ url sync - */

  // Opening from anywhere pushes an entry; stepping between records replaces
  // it, so Back means "close the dossier" rather than "walk the roster
  // backwards one person at a time".
  useEffect(() => {
    if (!open) return;
    const slug = TEAM[index].slug;
    const url = `${window.location.pathname}?${PARAM}=${slug}`;
    const state = window.history.state;

    if (state?.dossier) {
      // Stepping between records. Keep the entry we are on, whichever kind it
      // is, so Back still means "close" rather than "walk the roster
      // backwards one person at a time".
      window.history.replaceState({ ...state, dossier: slug }, '', url);
    } else if (window.location.search === `?${PARAM}=${slug}`) {
      // The address bar brought us here: stamp the entry, do not add one.
      window.history.replaceState({ dossier: slug }, '', url);
    } else {
      window.history.pushState({ dossier: slug, pushed: true }, '', url);
    }
  }, [open, index]);

  useEffect(() => {
    // Follow the address rather than assuming Back means close: Forward onto
    // an entry that still names a record should put that record back up.
    const onPop = () => {
      const slug = new URLSearchParams(window.location.search).get(PARAM);
      const target = slug ? memberIndex(slug) : -1;
      if (target >= 0) showDossier(target);
      else closeDossier();
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  /* -------------------------------------------------------------- keyboard - */

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        showDossier((index + 1) % TEAM_COUNT);
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        showDossier((index - 1 + TEAM_COUNT) % TEAM_COUNT);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, index, close]);

  /* ---------------------------------------------------------- scroll lock - */

  /*
    The page must not scroll behind an open dossier -- the camera would fly out
    of the chapter the panel is describing -- but the usual `position: fixed`
    lock is not available here. The whole 3D world is a function of
    `window.scrollY`, and that lock zeroes it, which would throw the corridor
    back to chapter 01 the moment a record opened. Swallowing the gestures
    instead leaves the scroll position exactly where it was.
  */
  useEffect(() => {
    if (!open) return;
    const node = overlay.current;
    if (!node) return;

    lockedY.current = window.scrollY;

    const swallow = (event: Event) => {
      const target = event.target as Node | null;
      // The record's body may be longer than the panel; it scrolls itself, and
      // `overscroll-behavior: contain` stops that reaching the page. Only that
      // region is exempt -- a wheel over the fixed header or the roster
      // controls has nothing of its own to scroll.
      if (target && scroller.current?.contains(target)) return;
      event.preventDefault();
    };

    node.addEventListener('wheel', swallow, { passive: false });
    node.addEventListener('touchmove', swallow, { passive: false });
    document.documentElement.dataset.dossier = 'open';

    return () => {
      node.removeEventListener('wheel', swallow);
      node.removeEventListener('touchmove', swallow);
      delete document.documentElement.dataset.dossier;
      // Whatever got past the swallow -- a keyboard, a gesture already in the
      // compositor -- is undone here, so the chapter is exactly where it was
      // when the sampler picks the scroll back up.
      if (Math.abs(window.scrollY - lockedY.current) > 1) {
        window.scrollTo(0, lockedY.current);
      }
    };
  }, [open]);

  /* --------------------------------------------------------------- focus - */

  useEffect(() => {
    if (open) closeButton.current?.focus({ preventScroll: true });
  }, [open]);

  /* ------------------------------------------------- open from the address - */

  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get(PARAM);
    if (!slug) return;
    const target = memberIndex(slug);
    if (target < 0) {
      window.history.replaceState(null, '', window.location.pathname);
      return;
    }

    /*
      On a document there is nothing to wait for and nowhere to scroll to: the
      record is the page's own subject, so it simply opens.
    */
    if (!onCanvas) {
      showDossier(target);
      return;
    }

    let cancelled = false;
    let frame = 0;
    const started = performance.now();

    /*
      A link into a record lands at the top of the page, eight chapters away
      from the registry, so the scroll has to be moved to where that record
      stands at the front of the ring before the panel is any use -- otherwise
      the dossier opens over an empty frame, and closing it reveals the opening
      shot of the piece rather than the chapter the record came out of.

      Three things have to be true before that jump means anything: the spine
      has to have been laid out, the world has to have finished compiling, and
      the scroll sampler has to take the new position without easing to it --
      it freezes the moment a dossier opens, and would freeze part-way there.
    */
    const place = () => {
      if (cancelled) return;
      const spine = document.querySelector<HTMLElement>('[data-scroll-spine]');
      const ready = scrollStore.ready || performance.now() - started > WORLD_WAIT;
      if (!spine || !ready) {
        frame = requestAnimationFrame(place);
        return;
      }

      const top = spine.getBoundingClientRect().top + window.scrollY;
      const span = Math.max(spine.offsetHeight - window.innerHeight, 1);
      void import('@/lib/scenes').then(({ progressForRecord }) => {
        if (cancelled) return;
        window.scrollTo(0, top + span * progressForRecord(target, TEAM_COUNT));
        scrollStore.resync = true;
        // One frame for the sampler to take the landed position, one for the
        // registry to place its records from it, and then the record leaves
        // the ring it is already standing in.
        frame = requestAnimationFrame(() => {
          frame = requestAnimationFrame(() => {
            if (!cancelled) showDossier(target);
          });
        });
      });
    };

    frame = requestAnimationFrame(place);
    return () => {
      cancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [onCanvas]);

  /* ---------------------------------------------------------------- render - */

  const step = (delta: number) =>
    showDossier((index + delta + TEAM_COUNT) % TEAM_COUNT);

  const facts: [string, string][] = [
    ['Record', person.record],
    ['Role', person.roleFull],
    ...(person.appointment
      ? ([['Appointment', person.appointment]] as [string, string][])
      : []),
    ['Department', PROJECT.department],
    ['Institution', PROJECT.institution],
  ];

  return (
    <div
      ref={overlay}
      className={`fixed inset-0 z-50 transition-opacity duration-500 ${
        open ? 'opacity-100' : 'pointer-events-none opacity-0'
      }`}
      style={{ touchAction: open ? 'none' : 'auto' }}
      role="dialog"
      aria-modal="true"
      aria-label={`Project record: ${person.name}`}
      aria-hidden={!open}
    >
      {/*
        The half of the frame the figure stands in. It is a button because
        clicking away from a panel is how a panel is dismissed, and because
        the alternative -- a bare div with an onClick -- is invisible to
        everything except a mouse.
      */}
      <button
        type="button"
        aria-label="Close record"
        tabIndex={open ? 0 : -1}
        onClick={close}
        className={
          onCanvas
            ? // A wash, not a cover: the scene behind is the other half of the
              // composition and has to stay visible.
              'absolute inset-0 cursor-default bg-gradient-to-t from-n00/85 via-n00/35 to-transparent sm:bg-gradient-to-r sm:from-transparent sm:via-n00/20 sm:to-n00/75'
            : // On a document it has to actually cover: what is behind is a
              // grid of the other nine faces, and leaving them legible under
              // the panel would be nine subjects competing with the one.
              'absolute inset-0 cursor-default bg-n00/92 backdrop-blur-md'
        }
      />

      {/*
        The subject, on a document surface. Rises and settles a beat behind the
        scrim and a beat ahead of the panel, which is the same order the 3D
        registry moves in -- the figure arrives, then it is annotated.
      */}
      {onCanvas ? null : (
        <div className="pointer-events-none absolute inset-x-0 top-0 flex h-[38%] items-end justify-center sm:inset-y-0 sm:right-auto sm:h-full sm:w-[54%] sm:items-center lg:w-[52%]">
          <Image
            key={person.slug}
            src={person.portrait}
            alt=""
            width={512}
            height={640}
            priority
            className={[
              'h-full w-auto max-w-[80%] object-contain object-bottom sm:max-h-[76%] sm:object-center',
              'transition-[transform,opacity] duration-700 ease-[var(--ease-out-premium)]',
              open
                ? 'translate-y-0 scale-100 opacity-100'
                : 'translate-y-6 scale-95 opacity-0',
            ].join(' ')}
            style={{ transitionDelay: open ? '80ms' : '0ms' }}
          />
        </div>
      )}

      <div
        ref={panel}
        className={[
          'absolute inset-x-0 bottom-0 flex max-h-[60svh] flex-col',
          'border-t border-n06/70 bg-n00/92 backdrop-blur-xl',
          'px-6 pb-8 pt-7 sm:px-12 sm:pb-10 sm:pt-10 lg:px-16',
          'sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[56%]',
          'sm:border-l sm:border-t-0 lg:w-[46%]',
          'transition-transform duration-700 ease-[var(--ease-out-premium)]',
          open
            ? 'translate-y-0 sm:translate-x-0'
            : 'translate-y-8 sm:translate-y-0 sm:translate-x-10',
        ].join(' ')}
      >
        {/* Fixed head: the record's number, and the way out. */}
        <div className="mx-auto flex w-full max-w-xl shrink-0 items-start justify-between gap-6">
          <p className="eyebrow readout text-[var(--scene-accent)]">
            Record · {person.record}
          </p>
          <button
            ref={closeButton}
            type="button"
            onClick={close}
            tabIndex={open ? 0 : -1}
            className="-mr-2 -mt-2 shrink-0 rounded-sm p-2 text-n09 transition-colors duration-300 hover:text-n12"
            aria-label="Close record"
          >
            <span aria-hidden="true" className="block text-lg leading-none">
              ✕
            </span>
          </button>
        </div>

        <span
          aria-hidden="true"
          className="mx-auto mt-5 block h-px w-full max-w-xl shrink-0 origin-left bg-[var(--scene-accent)] transition-transform duration-1000 ease-[var(--ease-out-premium)]"
          style={{
            transform: `scaleX(${open ? 1 : 0})`,
            transitionDelay: open ? '120ms' : '0ms',
          }}
        />

        {/*
          The body is the only part that scrolls, so the record number and the
          roster controls cannot be pushed off the panel by a long appointment
          line. `my-auto` inside centres a short record and collapses on a long
          one -- a centred flex child taller than its container overflows in
          both directions, and its top can never be scrolled back to.
        */}
        <div
          ref={scroller}
          className="mx-auto flex w-full max-w-xl flex-1 flex-col overflow-y-auto overscroll-contain py-7"
        >
          <div className="my-auto w-full">
            <h2 className="display-l">{person.name}</h2>
            <p className="lead mt-4">{person.roleFull}</p>

            {role ? <p className="body-copy mt-6 max-w-prose">{role}</p> : null}

            <dl className="mt-10 grid gap-x-8 gap-y-5 border-t border-n06/60 pt-8 sm:grid-cols-2">
              {facts.map(([term, value]) => (
                <div
                  key={term}
                  className={term === 'Appointment' ? 'sm:col-span-2' : undefined}
                >
                  <dt className="eyebrow text-n09">{term}</dt>
                  <dd className="body-copy mt-2 text-n11">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-8 border-t border-n06/60 pt-7">
              <p className="eyebrow text-n09">
                {PROJECT.subProject} · {PROJECT.programme}
              </p>
              <p className="body-copy mt-3">{PROJECT.title}.</p>
            </div>
          </div>
        </div>

        {/* Stepping through the roster without going back to the ring. */}
        <div className="mx-auto flex w-full max-w-xl shrink-0 items-center justify-between border-t border-n06/60 pt-6">
          <button
            type="button"
            onClick={() => step(-1)}
            tabIndex={open ? 0 : -1}
            className="group flex items-center gap-3 text-sm text-n10 transition-colors duration-300 hover:text-n12"
          >
            <span
              aria-hidden="true"
              className="transition-transform duration-300 group-hover:-translate-x-1"
            >
              ←
            </span>
            Previous
          </button>

          <p className="eyebrow readout text-n09">
            {String(index + 1).padStart(2, '0')} /{' '}
            {String(TEAM_COUNT).padStart(2, '0')}
          </p>

          <button
            type="button"
            onClick={() => step(1)}
            tabIndex={open ? 0 : -1}
            className="group flex items-center gap-3 text-sm text-n10 transition-colors duration-300 hover:text-n12"
          >
            Next
            <span
              aria-hidden="true"
              className="transition-transform duration-300 group-hover:translate-x-1"
            >
              →
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
