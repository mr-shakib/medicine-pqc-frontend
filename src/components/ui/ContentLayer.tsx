import SceneSection from '@/components/ui/SceneSection';
import { SCENES } from '@/lib/scenes';
import { TEAM_BY_ROLE } from '@/lib/team';

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
        >
          {scene.id === 'team' ? <TeamRoster /> : null}
        </SceneSection>
      ))}
    </main>
  );
}

/**
 * The chapter 08 roster, for readers the canvas cannot reach.
 *
 * The registry introduces ten people as photographs and canvas textures, none
 * of which a screen reader can see. This is the same roster in the same order,
 * present in the HTML and hidden only visually -- the visible credits live in
 * `TeamCredits`, below the story.
 */
function TeamRoster() {
  return (
    <div className="sr-only">
      <h3>Project team</h3>
      {TEAM_BY_ROLE.map((group) => (
        <div key={group.role}>
          <h4>{group.label}</h4>
          <ul>
            {group.members.map((member) => (
              <li key={member.slug}>{member.name}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
