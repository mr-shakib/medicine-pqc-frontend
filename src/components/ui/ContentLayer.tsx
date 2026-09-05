import SceneSection from '@/components/ui/SceneSection';
import { SCENES } from '@/lib/scenes';
import TeamRoster from '@/components/ui/TeamRoster';

/**
 * The scroll spine: one full-viewport section per scene, stacked to give the
 * document its total height. Server-rendered, so all narrative copy is present
 * in the HTML before any JavaScript runs.
 *
 * Transparent to the pointer, all the way down.
 *
 * The spine is a full-height stack sitting on top of the fixed canvas, and hit
 * testing goes by an element's box rather than by what it painted -- so this
 * element, which paints nothing at all, was the top target over every pixel of
 * the page and swallowed every click meant for the 3D layer. The copy inside
 * was already `pointer-events-none`; putting it here instead covers the boxes
 * as well, and the one thing in the spine that needs the pointer -- the team
 * roster in chapter 08 -- turns it back on for itself.
 */
export default function ContentLayer() {
  return (
    <main
      id="content"
      data-scroll-spine
      className="pointer-events-none relative z-10"
    >
      {SCENES.map((scene, i) => (
        <SceneSection
          key={scene.id}
          definition={scene}
          isFirst={i === 0}
          isLast={i === SCENES.length - 1}
        >
          {scene.id === 'team' ? <TeamRoster /> : null}
        </SceneSection>
      ))}
    </main>
  );
}

