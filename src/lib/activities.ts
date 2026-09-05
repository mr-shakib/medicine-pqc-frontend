/**
 * The field-notes log: what the sub-project did, and when.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * THE ENTRIES BELOW ARE PLACEHOLDERS. They are shaped like real entries so the
 * page can be judged, and they are deliberately generic -- no company names, no
 * partner institutions, no attendance figures -- because inventing any of those
 * would put claims on a public research page that nobody made. Replace them
 * with what actually happened and delete the `placeholder` flag; the notice at
 * the top of the page disappears on its own once none is left.
 * ────────────────────────────────────────────────────────────────────────────
 */

export type ActivityKind =
  | 'visit'
  | 'workshop'
  | 'fieldwork'
  | 'dissemination';

export interface Activity {
  /** Stable slug, used as the React key and the entry's anchor. */
  slug: string;
  /** ISO date, `YYYY-MM-DD`. Sorted newest first for display. */
  date: string;
  kind: ActivityKind;
  title: string;
  /** Where it happened. Kept short -- a city, a campus, a facility type. */
  location: string;
  /** Two or three sentences. What was done, and what it was for. */
  summary: string;
  /** Remove once this entry describes something that actually happened. */
  placeholder?: boolean;
}

/** How each kind is labelled in the log's margin. */
export const KIND_LABEL: Readonly<Record<ActivityKind, string>> = {
  visit: 'Site visit',
  workshop: 'Workshop',
  fieldwork: 'Fieldwork',
  dissemination: 'Dissemination',
};

export const ACTIVITIES: readonly Activity[] = [
  {
    slug: 'manufacturing-site-visit',
    date: '2026-08-19',
    kind: 'visit',
    title: 'Pharmaceutical manufacturing site visit',
    location: 'Dhaka Division',
    summary:
      'A walk of a production and packaging line, from blister forming through to cartoning and serialisation, to see where an authenticity mark can realistically be applied and where it would survive handling.',
    placeholder: true,
  },
  {
    slug: 'pqc-workshop',
    date: '2026-07-02',
    kind: 'workshop',
    title: 'Post-quantum cryptography workshop',
    location: 'Department of CSE, Daffodil International University',
    summary:
      'An internal session on the NIST lattice standards — ML-KEM and ML-DSA — and what migrating a supply-chain custody record onto them costs in key size, signing time and storage.',
    placeholder: true,
  },
  {
    slug: 'imaging-collection-round',
    date: '2026-06-11',
    kind: 'fieldwork',
    title: 'Imaging collection round',
    location: 'Retail pharmacies, Savar',
    summary:
      'A collection round for the detection dataset: repeated captures of the same product under the lighting and camera conditions a pharmacist or a buyer would actually have, rather than under laboratory light.',
    placeholder: true,
  },
  {
    slug: 'progress-seminar',
    date: '2026-05-08',
    kind: 'dissemination',
    title: 'Sub-project progress seminar',
    location: 'Daffodil Smart City, Birulia, Savar',
    summary:
      'A presentation of the detection results to date and the proposed cryptographic custody design, with a review of the sub-project against its reporting milestones.',
    placeholder: true,
  },
] as const;

/** Newest first. */
export const activitiesByDate = (): readonly Activity[] =>
  [...ACTIVITIES].sort((a, b) => b.date.localeCompare(a.date));

/** True while any entry is still placeholder copy. */
export const hasPlaceholders = (): boolean =>
  ACTIVITIES.some((entry) => entry.placeholder);

/** `2026-08-19` -> `19 August 2026`. Fixed locale so SSR and client agree. */
export function formatActivityDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}
