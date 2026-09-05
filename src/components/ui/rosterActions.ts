'use client';

import { showDossier } from '@/lib/dossierStore';
import { TEAM, TEAM_BY_ROLE, TEAM_COUNT } from '@/lib/team';

export { TEAM, TEAM_BY_ROLE };

/**
 * Open a record's dossier from somewhere other than the registry itself.
 *
 * The 3D half of the dossier is written around the figure standing in the
 * chapter, so opening one from a keyboard while the scroll is somewhere else
 * would put a panel over an empty frame. Scrolling to the record's own place
 * in the registry first costs one jump and makes the two halves agree.
 */
export function showDossierFor(index: number): void {
  if (index < 0) return;

  const spine = document.querySelector<HTMLElement>('[data-scroll-spine]');
  if (spine) {
    void import('@/lib/scenes').then(({ progressForRecord }) => {
      const top = spine.getBoundingClientRect().top + window.scrollY;
      const span = Math.max(spine.offsetHeight - window.innerHeight, 1);
      window.scrollTo(0, top + span * progressForRecord(index, TEAM_COUNT));
      showDossier(index);
    });
    return;
  }
  showDossier(index);
}
