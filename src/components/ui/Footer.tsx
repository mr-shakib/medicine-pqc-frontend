import Link from 'next/link';
import { NAV_LINKS } from '@/lib/navigation';
import { PROJECT } from '@/lib/team';

/** Closing band below the scroll spine. */
export default function Footer() {
  return (
    <footer className="hairline-b relative z-10 border-t border-n06/60 bg-n00 px-6 py-16 sm:px-12 lg:px-20">
      <div className="flex flex-col gap-10 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="display-m">MedSecure PQC</p>
          <p className="body-copy mt-3 max-w-sm">
            AI-powered, post-quantum cryptography-enabled counterfeit medicine
            detection.
          </p>
          {/* The attribution the project's own records carry. */}
          <p className="eyebrow mt-6 max-w-md text-n09">
            {PROJECT.subProject} · {PROJECT.programme} · {PROJECT.institution}
          </p>
        </div>

        <div className="flex flex-col gap-6 sm:items-end">
          <nav aria-label="Sections">
            <ul className="flex gap-6">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="eyebrow text-n10 transition-colors duration-300 hover:text-n12"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="flex flex-col gap-2 sm:items-end">
            <p className="eyebrow text-n09">Built with</p>
            <p className="eyebrow text-n10">Next.js · Three.js · R3F</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
