import SceneSection from '@/components/ui/SceneSection';
import { SCENES } from '@/lib/scenes';

/**
 * The scroll spine: one full-viewport section per scene, stacked to give the
 * document its total height. Server-rendered, so all narrative copy is present
 * in the HTML before any JavaScript runs.
 */
export default function ContentLayer() {
  return (
    <main id="content" data-scroll-spine className="relative z-10">
      {SCENES.map((scene, i) => (
        <SceneSection
          key={scene.id}
          definition={scene}
          isFirst={i === 0}
          isLast={i === SCENES.length - 1}
        />
      ))}
    </main>
  );
}
