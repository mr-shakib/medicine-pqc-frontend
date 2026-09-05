import type { Metadata } from 'next';
import Link from 'next/link';
import Footer from '@/components/ui/Footer';
import TeamDirectory from '@/components/ui/TeamDirectory';
import { navLinkFor } from '@/lib/navigation';
import { PROJECT } from '@/lib/team';

const section = navLinkFor('/team')!;

export const metadata: Metadata = {
  title: `${section.title} — MedSecure PQC`,
  description: section.description,
};

/**
 * The dedicated team page.
 *
 * The home page introduces these people in the canvas, one at a time, as a
 * turntable of records; that is an experience and it is deliberately paced.
 * This is the same roster as a DOCUMENT -- everyone at once, in role order,
 * scannable, linkable and printable.
 *
 * The heading and the attribution are server-rendered; only the grid and the
 * record detail that opens over it are a client island, because only they need
 * to answer a click.
 */
export default function TeamPage() {
  return (
    <>
      <main className="relative z-10 min-h-screen bg-n00 px-6 pb-28 pt-36 sm:px-12 sm:pt-44 lg:px-20">
        <div className="mx-auto max-w-6xl">
          <p className="eyebrow text-[var(--scene-accent)]">
            {PROJECT.subProject} · {PROJECT.programme}
          </p>

          <h1 className="display-l mt-6 max-w-3xl">{section.title}</h1>

          <p className="lead mt-8 max-w-2xl">{PROJECT.title}.</p>

          <p className="body-copy mt-6 max-w-2xl">
            {PROJECT.department}, {PROJECT.institution}. {PROJECT.funding}
          </p>

          <TeamDirectory />

          <div className="mt-24 border-t border-n06/60 pt-10">
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
