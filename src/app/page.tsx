import ContentLayer from '@/components/ui/ContentLayer';
import ExperienceLoader from '@/components/ui/ExperienceLoader';
import ClosingSection from '@/components/ui/ClosingSection';
import Footer from '@/components/ui/Footer';
import Grade from '@/components/ui/Grade';
import Nav from '@/components/ui/Nav';
import SceneRail from '@/components/ui/SceneRail';

/**
 * MedSecure PQC — the whole experience is one page.
 *
 * Composition, back to front:
 *   1. ExperienceLoader — fixed, full-bleed WebGL canvas (or a static fallback)
 *   2. Grade            — vignette and scrims, the cinematic colour grade
 *   3. ContentLayer     — the scrolling DOM spine that drives it
 *   4. ClosingSection   — the page after the story, once the canvas is behind
 *   5. Nav / SceneRail  — fixed chrome
 */
export default function Home() {
  return (
    <>
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-n04 focus:px-4 focus:py-2 focus:text-n12"
      >
        Skip to content
      </a>

      <ExperienceLoader />
      <Grade />

      <Nav />
      <SceneRail />

      <ContentLayer />
      <ClosingSection />
      <Footer />
    </>
  );
}
