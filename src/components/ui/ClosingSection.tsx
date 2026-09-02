import { SCENES } from '@/lib/scenes';

/**
 * The closing section.
 *
 * Sits after the scroll spine, where the canvas has been left behind and the
 * page becomes an ordinary document again. That shift is deliberate: the story
 * ends with the 3D, and what follows is the plain statement of what was just
 * shown and what to do about it.
 *
 * Server-rendered, so the project's full description is in the HTML for anyone
 * — a search engine, a reader with WebGL disabled — who never sees the canvas
 * at all.
 */
export default function ClosingSection() {
  const pillars = [
    {
      label: 'Verify',
      copy: 'A model reads imprint geometry, coating variance and spectral response, and returns a calibrated verdict rather than a guess.',
    },
    {
      label: 'Protect',
      copy: 'Every custody event is sealed with lattice-based ML-KEM and ML-DSA — NIST FIPS 203 and 204 — so authenticity survives the quantum transition.',
    },
    {
      label: 'Trust',
      copy: 'Two independent proofs, one answer. The model says it is genuine; the signature says it is untampered.',
    },
  ];

  return (
    <section
      id="closing"
      aria-label="About MedSecure PQC"
      className="relative z-10 border-t border-n06/60 bg-n00 px-6 py-28 sm:px-12 lg:px-20"
    >
      <div className="mx-auto max-w-6xl">
        <p className="eyebrow text-[var(--scene-accent)]">
          {String(SCENES.length).padStart(2, '0')} chapters · one system
        </p>

        <h2 className="display-l mt-6 max-w-4xl">
          AI-powered, post-quantum cryptography-enabled counterfeit medicine
          detection.
        </h2>

        <p className="lead mt-8 max-w-2xl">
          Medicine changes form. Authenticity should not. MedSecure PQC pairs
          machine inspection with signatures that a quantum computer cannot
          forge — so a dose can be trusted at every hand it passes through.
        </p>

        {/* The three closing words, expanded. */}
        <dl className="mt-20 grid gap-10 border-t border-n06/60 pt-12 sm:grid-cols-3 sm:gap-8">
          {pillars.map((pillar) => (
            <div key={pillar.label}>
              <dt className="eyebrow text-n11">{pillar.label}</dt>
              <dd className="body-copy mt-4 max-w-xs">{pillar.copy}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-20 flex flex-col gap-4 sm:flex-row sm:items-center">
          {/*
            Hairline buttons rather than filled ones. A solid block of accent
            here would be the loudest element on a page that has spent nine
            chapters being restrained.
          */}
          <a
            href="#medicine-core"
            className="group inline-flex items-center justify-between gap-6 border border-n07 px-6 py-4 text-sm text-n12 transition-colors duration-300 hover:border-[var(--scene-accent)]"
          >
            Replay the sequence
            <span
              aria-hidden="true"
              className="translate-x-0 text-n09 transition-transform duration-300 group-hover:translate-x-1"
            >
              ↑
            </span>
          </a>

          <a
            href="#ai-detection"
            className="group inline-flex items-center justify-between gap-6 border border-transparent px-6 py-4 text-sm text-n10 transition-colors duration-300 hover:text-n12"
          >
            See detection in action
            <span
              aria-hidden="true"
              className="text-n09 transition-transform duration-300 group-hover:translate-x-1"
            >
              →
            </span>
          </a>
        </div>
      </div>
    </section>
  );
}
