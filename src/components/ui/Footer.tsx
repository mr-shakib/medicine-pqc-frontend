/** Closing band below the scroll spine. */
export default function Footer() {
  return (
    <footer className="hairline-b relative z-10 border-t border-n06/60 bg-n00/90 px-6 py-16 backdrop-blur-sm sm:px-12 lg:px-20">
      <div className="flex flex-col gap-10 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="display-m">MedSecure PQC</p>
          <p className="body-copy mt-3 max-w-sm">
            AI-powered, post-quantum cryptography-enabled counterfeit medicine
            detection.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:items-end">
          <p className="eyebrow text-n09">Built with</p>
          <p className="eyebrow text-n10">
            Next.js · Three.js · R3F · GSAP
          </p>
        </div>
      </div>
    </footer>
  );
}
