import Link from 'next/link';
import { TEAM_BY_ROLE, PROJECT } from '@/lib/team';

/**
 * The team, in plain HTML.
 *
 * Chapter 08 introduces these people in the canvas, where a screen reader, a
 * search engine and anyone without WebGL can none of them follow. This is the
 * same roster as a document: no photographs, no formation, just who worked on
 * it and what the project is.
 *
 * Server-rendered, and the only place the funding attribution appears in full.
 */
export default function TeamCredits() {
  return (
    <section
      id="credits"
      aria-label="Project team"
      className="relative z-10 border-t border-n06/60 bg-n00 px-6 py-28 sm:px-12 lg:px-20"
    >
      <div className="mx-auto max-w-6xl">
        <p className="eyebrow text-[var(--scene-accent)]">The team</p>

        <h2 className="display-l mt-6 max-w-3xl">
          {PROJECT.subProject} · {PROJECT.programme}
        </h2>

        <p className="lead mt-8 max-w-3xl">{PROJECT.title}.</p>

        <dl className="mt-20 grid gap-10 border-t border-n06/60 pt-12 sm:grid-cols-2 lg:grid-cols-3">
          {TEAM_BY_ROLE.map((group) => (
            <div key={group.role}>
              <dt className="eyebrow text-n09">{group.label}</dt>
              <dd className="mt-4">
                <ul className="space-y-1.5">
                  {group.members.map((member) => (
                    <li key={member.slug} className="text-n11">
                      {member.name}
                    </li>
                  ))}
                </ul>
              </dd>
            </div>
          ))}
        </dl>

        <div className="mt-16 flex flex-col gap-8 border-t border-n06/60 pt-8 sm:flex-row sm:items-end sm:justify-between">
          <p className="body-copy max-w-2xl">
            {PROJECT.department}, {PROJECT.institution}. {PROJECT.funding}
          </p>

          <Link
            href="/team"
            className="group inline-flex shrink-0 items-center gap-4 border border-n07 px-6 py-4 text-sm text-n12 transition-colors duration-300 hover:border-[var(--scene-accent)]"
          >
            The team page
            <span
              aria-hidden="true"
              className="text-n09 transition-transform duration-300 group-hover:translate-x-1"
            >
              →
            </span>
          </Link>
        </div>
      </div>
    </section>
  );
}
