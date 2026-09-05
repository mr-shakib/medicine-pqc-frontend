/**
 * The people behind the project, and the project's own attribution.
 *
 * One source for every surface: the 3D registry in chapter 08 builds its
 * stations from it, the dossier reads a record out of it, and the DOM credits
 * and accessible roster render it as a document. Order is the order the
 * registry introduces them -- by role, leads first -- so changing this array
 * reorders the carousel, the roster and the credits together.
 *
 * Deliberately NOT a transcription of the project ID cards. The cards carry
 * personal contact details and medical information; none of that belongs on a
 * public page, so only the name, the role, the project record number and the
 * photograph are kept.
 *
 * Portraits are cut out with an alpha channel, normalised so every head reads
 * at the same size, graded into the piece's cool-shadow / warm-highlight rig
 * and dissolved at the waist. See `public/team`.
 */
export interface TeamMember {
  /** Stable slug. Also the portrait's filename and the dossier's URL. */
  slug: string;
  name: string;
  /** Short form, set under the name on the 3D plate. */
  role: string;
  /** The role as the project's own records write it. */
  roleFull: string;
  /** Project record number, as issued by the sub-project. */
  record: string;
  /** A further appointment, where the person holds one. */
  appointment?: string;
  /** Path to the 512x640 RGBA portrait, served from `public`. */
  portrait: string;
}

interface MemberInput {
  slug: string;
  name: string;
  role: string;
  record: string;
  appointment?: string;
}

const member = ({ slug, name, role, record, appointment }: MemberInput): TeamMember => ({
  slug,
  name,
  role,
  roleFull: `${role}, ICSETEP Sub-Project`,
  record,
  appointment,
  portrait: `/team/${slug}.webp`,
});

export const TEAM: readonly TeamMember[] = [
  member({
    slug: 'arif-mahmud',
    name: 'Dr. Arif Mahmud',
    role: 'Principal Investigator',
    record: 'DIU-P-A71-PI-01',
    appointment:
      'Associate Professor and Associate Head, Department of Computer Science and Engineering, Daffodil International University',
  }),
  member({
    slug: 'rasedul-islam',
    name: 'Md. Rasedul Islam',
    role: 'Co-Principal Investigator',
    record: 'DIU-P-A71-CPI-01',
  }),
  member({
    slug: 'sharifa-sultana',
    name: 'Dr. Sharifa Sultana',
    role: 'Co-Principal Investigator',
    record: 'DIU-P-A71-CPI-02',
  }),
  member({
    slug: 'rubayat-uddin-rimon',
    name: 'Md. Rubayat Uddin Rimon',
    role: 'Research Assistant',
    record: 'DIU-P-A71-RA-01',
  }),
  member({
    slug: 'shakib-howlader',
    name: 'Shakib Howlader',
    role: 'Research Assistant',
    record: 'DIU-P-A71-RA-02',
  }),
  member({
    slug: 'showrav-das',
    name: 'Showrav Das',
    role: "Master's Fellow",
    record: 'DIU-P-A71-MF-01',
  }),
  member({
    slug: 'zadid-al-lisan',
    name: 'Zadid Al Lisan',
    role: "Master's Fellow",
    record: 'DIU-P-A71-MF-02',
  }),
  member({
    slug: 'faiyaz-khan-sami',
    name: 'Faiyaz Khan Sami',
    role: "Master's Fellow",
    record: 'DIU-P-A71-MF-03',
  }),
  member({
    slug: 'anzir-rahman-khan',
    name: 'Anzir Rahman Khan',
    role: "Master's Fellow",
    record: 'DIU-P-A71-MF-04',
  }),
  member({
    slug: 'fahim-montasir-turjo',
    name: 'Md. Fahim Montasir Turjo',
    role: 'Accounts Officer',
    record: 'DIU-P-A71-AO-01',
  }),
] as const;

export const TEAM_COUNT = TEAM.length;

export const memberIndex = (slug: string): number =>
  TEAM.findIndex((person) => person.slug === slug);

/**
 * What each role carries on the sub-project.
 *
 * Written per ROLE, never per person. The project's records give a name and a
 * post and nothing else, and the alternative to describing the post is
 * inventing a biography for someone who did not write one -- so the dossier
 * says what the post is responsible for and stops there. Anything more
 * specific has to come from the people themselves.
 */
export const ROLE_BRIEF: Readonly<Record<string, string>> = {
  'Principal Investigator':
    'Holds scientific and administrative responsibility for the sub-project: its research direction, its reporting against the ICSETEP award, and the work of everyone listed here.',
  'Co-Principal Investigator':
    'Shares direction of the sub-project with the Principal Investigator, leading a portion of its technical programme and its supervision.',
  'Research Assistant':
    'Carries the day-to-day investigative work — building, measuring and documenting the detection and cryptographic components under supervision.',
  "Master's Fellow":
    'A funded graduate researcher on the sub-project, contributing a thesis-scale piece of the programme alongside the wider team.',
  'Accounts Officer':
    'Administers the sub-project’s funds and financial reporting against the terms of the award.',
};

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
