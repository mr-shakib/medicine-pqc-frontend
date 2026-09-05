'use client';

import Image from 'next/image';
import Link from 'next/link';
import RecordDossier from '@/components/ui/RecordDossier';
import { showDossier } from '@/lib/dossierStore';
import { ROLE_BRIEF, TEAM, TEAM_BY_ROLE } from '@/lib/team';

/**
 * The roster grid, and the record detail that opens over it.
 *
 * The cards are real links to `/team?record=<slug>` whose click is taken over
 * rather than buttons that only look like links. That distinction buys three
 * things for one `preventDefault`: the address bar ends up somewhere that can
 * be sent to someone, a middle-click or a modifier still opens a new tab the
 * way a reader expects, and the same URL typed cold opens the same record.
 *
 * What it does NOT do is navigate. Following the href would replace the grid
 * with a page load, and the thing being asked for here is a detail that opens
 * over the roster you were reading -- so the dossier is mounted alongside and
 * the URL is moved under it.
 */
export default function TeamDirectory() {
  return (
    <>
      {TEAM_BY_ROLE.map((group) => (
        <section key={group.role} className="mt-20">
          <div className="flex items-baseline gap-4 border-t border-n06/60 pt-8">
            <h2 className="eyebrow text-n11">{group.label}</h2>
            <span className="eyebrow readout text-n09">
              {String(group.members.length).padStart(2, '0')}
            </span>
          </div>

          <p className="body-copy mt-4 max-w-2xl">{ROLE_BRIEF[group.role]}</p>

          <ul className="mt-10 grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
            {group.members.map((member) => (
              <li key={member.slug}>
                <Link
                  href={`/team?record=${member.slug}`}
                  onClick={(event) => {
                    // Leave the modified clicks alone: they mean "somewhere
                    // else", and the href is there precisely so they work.
                    if (
                      event.metaKey ||
                      event.ctrlKey ||
                      event.shiftKey ||
                      event.altKey ||
                      event.button !== 0
                    ) {
                      return;
                    }
                    event.preventDefault();
                    showDossier(TEAM.indexOf(member));
                  }}
                  className="group block"
                >
                  <div className="relative aspect-[4/5] overflow-hidden border border-n06/50 bg-gradient-to-b from-n02 to-n01">
                    <Image
                      src={member.portrait}
                      alt=""
                      width={512}
                      height={640}
                      className="h-full w-full object-cover object-top opacity-90 transition-[opacity,transform] duration-500 ease-[var(--ease-out-premium)] group-hover:scale-[1.03] group-hover:opacity-100"
                    />
                  </div>

                  <p className="mt-5 text-n12 transition-colors duration-300 group-hover:text-[var(--scene-accent)]">
                    {member.name}
                  </p>
                  <p className="eyebrow mt-2 text-n09">{member.role}</p>
                  <p className="eyebrow readout mt-1 text-n08">{member.record}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {/* Over the grid, not instead of it. */}
      <RecordDossier surface="page" />
    </>
  );
}
