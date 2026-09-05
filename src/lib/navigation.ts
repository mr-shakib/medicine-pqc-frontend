/**
 * The site's sections.
 *
 * Home is in the list as well as being on the wordmark. The wordmark alone is
 * the older convention and it does work, but it asks the reader to know it --
 * and on a page that is mostly a full-bleed canvas there is nothing else
 * nearby to make it read as navigation. A named item costs one more slot in
 * the capsule and removes the guess.
 */
export interface NavLink {
  href: string;
  /** Set in the tracked monospace label voice, so it stays short. */
  label: string;
  /** Used for the page's own heading and metadata. */
  title: string;
  description: string;
}

/**
 * "Field Notes" rather than "Recent Activities".
 *
 * The section carries site visits, workshops and training -- the record a
 * research project keeps of the work it does away from the desk. "Recent
 * Activities" is the phrase an annual report reaches for, it dates itself the
 * moment the newest entry is a year old, and "activities" says nothing about
 * what any of them were. Field notes is what these are.
 */
export const NAV_LINKS: readonly NavLink[] = [
  {
    href: '/',
    label: 'Home',
    title: 'MedSecure PQC',
    description:
      'AI-powered, post-quantum cryptography-enabled counterfeit medicine detection.',
  },
  {
    href: '/team',
    label: 'Team',
    title: 'The team',
    description:
      'The investigators, research assistants and fellows of ICSETEP Sub-Project A-71.',
  },
  {
    href: '/field-notes',
    label: 'Field Notes',
    title: 'Field notes',
    description:
      'Site visits, workshops and fieldwork from ICSETEP Sub-Project A-71.',
  },
] as const;

export const navLinkFor = (href: string): NavLink | undefined =>
  NAV_LINKS.find((link) => link.href === href);
