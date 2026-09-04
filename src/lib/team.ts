/**
 * The people behind the project, and the project's own attribution.
 *
 * One source for both layers: the 3D registry in chapter 08 reads it to build
 * its stations, and the DOM reads it for the accessible roster and the closing
 * credits. Order is the order the registry introduces them -- by role, leads
 * first -- so changing this array reorders the carousel and the credits
 * together.
 *
 * Deliberately NOT a transcription of the project ID cards. The cards carry
 * personal contact details and medical information; none of that belongs on a
 * public page, so only name, role and photograph are kept.
 *
 * Portraits are cut out with an alpha channel, normalised so every head reads
 * at the same size, graded into the piece's cool-shadow / warm-highlight rig
 * and dissolved at the waist. See `public/team`.
 */
export interface TeamMember {
  /** Stable slug. Also the portrait's filename. */
  slug: string;
  name: string;
  /** Short form, set under the name on the 3D plate. */
  role: string;
  /** Path to the 512x640 RGBA portrait, served from `public`. */
  portrait: string;
}

const portraitOf = (slug: string): string => `/team/${slug}.webp`;

const member = (slug: string, name: string, role: string): TeamMember => ({
  slug,
  name,
  role,
  portrait: portraitOf(slug),
});

export const TEAM: readonly TeamMember[] = [
  member('arif-mahmud', 'Dr. Arif Mahmud', 'Principal Investigator'),
  member('rasedul-islam', 'Md. Rasedul Islam', 'Co-Principal Investigator'),
  member('sharifa-sultana', 'Dr. Sharifa Sultana', 'Co-Principal Investigator'),
  member('rubayat-uddin-rimon', 'Md. Rubayat Uddin Rimon', 'Research Assistant'),
  member('shakib-howlader', 'Shakib Howlader', 'Research Assistant'),
  member('showrav-das', 'Showrav Das', "Master's Fellow"),
  member('zadid-al-lisan', 'Zadid Al Lisan', "Master's Fellow"),
  member('faiyaz-khan-sami', 'Faiyaz Khan Sami', "Master's Fellow"),
  member('anzir-rahman-khan', 'Anzir Rahman Khan', "Master's Fellow"),
  member('fahim-montasir-turjo', 'Md. Fahim Montasir Turjo', 'Accounts Officer'),
] as const;

export const TEAM_COUNT = TEAM.length;

/** Project attribution, as it appears on the sub-project's own records. */
export const PROJECT = {
  subProject: 'Sub-Project A-71',
  programme: 'ICSETEP',
  title:
    'Development and Effective Application of AI-Based, Post-Quantum Cryptography-Enabled Counterfeit Medicine Identification Tools for Better Treatment Outcomes in Bangladesh',
  department: 'Department of Computer Science and Engineering',
  institution: 'Daffodil International University',
  funding:
    'Funded by the Government of Bangladesh and the Asian Development Bank under the UGC RDG-ICSETEP project.',
} as const;

/**
 * The roster grouped by role, in roster order.
 *
 * Used by the credits and by the accessible roster inside the scroll spine, so
 * the two can never disagree about who does what.
 */
export interface TeamGroup {
  /** The role as it appears on a single record. */
  role: string;
  /** The same role as a heading for the people in it. */
  label: string;
  members: readonly TeamMember[];
}

export const TEAM_BY_ROLE: readonly TeamGroup[] = (() => {
  const groups: TeamGroup[] = [];
  for (const person of TEAM) {
    const existing = groups.find((group) => group.role === person.role);
    if (existing) {
      (existing.members as TeamMember[]).push(person);
    } else {
      groups.push({ role: person.role, label: person.role, members: [person] });
    }
  }
  // Every role in this roster pluralises by suffix. If one ever does not, it
  // wants an explicit plural on the member rather than a rule with an
  // exception in it.
  return groups.map((group) => ({
    ...group,
    label: group.members.length > 1 ? `${group.role}s` : group.role,
  }));
})();
