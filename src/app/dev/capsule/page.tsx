import type { Metadata } from 'next';
import CapsuleLabClient from '@/components/dev/CapsuleLabClient';

export const metadata: Metadata = {
  title: 'Capsule — dev inspector',
  // An internal tool; useful in any build, but never a search result.
  robots: { index: false, follow: false },
};

export default function CapsuleDevPage() {
  return <CapsuleLabClient />;
}
