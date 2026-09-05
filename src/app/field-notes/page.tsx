import type { Metadata } from 'next';
import Link from 'next/link';
import Footer from '@/components/ui/Footer';
import {
  KIND_LABEL,
  activitiesByDate,
  formatActivityDate,
  hasPlaceholders,
} from '@/lib/activities';
import { navLinkFor } from '@/lib/navigation';
import { PROJECT } from '@/lib/team';

const section = navLinkFor('/field-notes')!;

export const metadata: Metadata = {
  title: `${section.title} — MedSecure PQC`,
  description: section.description,
};

/**
 * The field-notes log.
 *
 * A log, not a news feed: entries are dated, kept in one column, separated by
 * hairlines and never boxed into cards. A card grid would make four entries
 * look like a product listing and would leave the page looking empty until
 * there were six of them; a column reads correctly at one entry and at fifty,
 * which is the shape a record that grows over a project's life actually needs.
 */
export default function FieldNotesPage() {
  const entries = activitiesByDate();
  const placeholders = hasPlaceholders();

  return (
    <>
      <main className="relative z-10 min-h-screen bg-n00 px-6 pb-28 pt-36 sm:px-12 sm:pt-44 lg:px-20">
        <div className="mx-auto max-w-4xl">
          <p className="eyebrow text-[var(--scene-accent)]">
            {PROJECT.subProject} · {PROJECT.programme}
          </p>

          <h1 className="display-l mt-6">{section.title}</h1>

          <p className="lead mt-8 max-w-2xl">
            Site visits, workshops and fieldwork from the sub-project — where
            the detection work meets the supply chain it is meant to protect.
          </p>

          {placeholders ? (
            <p
              role="note"
              className="body-copy mt-10 border border-[var(--scene-accent)]/40 px-5 py-4 text-n11"
            >
              <span className="eyebrow text-[var(--scene-accent)]">
                Placeholder content
              </span>
              <span className="mt-2 block">
                The entries below are examples, kept deliberately generic so
                nothing unverified is published. Replace them in{' '}
                <code className="font-mono text-n12">src/lib/activities.ts</code>{' '}
                and remove each entry&rsquo;s <code className="font-mono text-n12">placeholder</code>{' '}
                flag; this notice disappears once none is left.
              </span>
            </p>
          ) : null}

          {entries.length === 0 ? (
            <p className="body-copy mt-20 border-t border-n06/60 pt-10">
              No entries yet.
            </p>
          ) : (
            <ol className="mt-20">
              {entries.map((entry) => (
                <li
                  key={entry.slug}
                  id={entry.slug}
                  className="grid gap-y-4 border-t border-n06/60 py-10 sm:grid-cols-[10rem_1fr] sm:gap-x-10"
                >
                  <div>
                    <p className="eyebrow readout text-n09">
                      <time dateTime={entry.date}>
                        {formatActivityDate(entry.date)}
                      </time>
                    </p>
                    <p className="eyebrow mt-2 text-[var(--scene-accent)]">
                      {KIND_LABEL[entry.kind]}
                    </p>
                  </div>

                  <div>
                    <h2 className="display-m">{entry.title}</h2>
                    <p className="eyebrow mt-3 text-n09">{entry.location}</p>
                    <p className="body-copy mt-5 max-w-prose">{entry.summary}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}

          <div className="mt-16 border-t border-n06/60 pt-10">
            <Link
              href="/"
              className="group inline-flex items-center gap-4 text-sm text-n10 transition-colors duration-300 hover:text-n12"
            >
              <span
                aria-hidden="true"
                className="transition-transform duration-300 group-hover:-translate-x-1"
              >
                ←
              </span>
              Back to the story
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
