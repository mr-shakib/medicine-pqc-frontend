'use client';

import { TEAM_BY_ROLE, TEAM, showDossierFor } from '@/components/ui/rosterActions';

/**
 * The chapter 08 roster, for readers the canvas cannot reach.
 *
 * The registry introduces ten people as photographs and canvas textures, none
 * of which a screen reader can see and none of which a keyboard can reach. So
 * the same roster, in the same order, is here as real buttons that open the
 * same dossier the 3D records open -- hidden until focused, which is the one
 * way to give a pointer-only affordance a keyboard equivalent without putting
 * a second visible list on top of the chapter's own composition.
 */
export default function TeamRoster() {
  return (
    <div className="pointer-events-auto mt-10">
      <h3 className="sr-only">Project team</h3>
      {TEAM_BY_ROLE.map((group) => (
        <div key={group.role}>
          <h4 className="sr-only">{group.label}</h4>
          <ul>
            {group.members.map((member) => (
              <li key={member.slug}>
                <button
                  type="button"
                  onClick={() => showDossierFor(TEAM.indexOf(member))}
                  className="sr-only rounded-sm focus:not-sr-only focus:relative focus:my-1 focus:inline-flex focus:items-center focus:gap-3 focus:border focus:border-[var(--scene-accent)] focus:px-4 focus:py-2 focus:text-sm focus:text-n12"
                >
                  {member.name}
                  <span className="eyebrow text-n09">{member.role}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
