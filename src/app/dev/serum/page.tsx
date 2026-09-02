import type { Metadata } from 'next';
import SerumBottleLabClient from '@/components/dev/SerumBottleLabClient';

export const metadata: Metadata = {
  title: 'Serum vial — dev inspector',
  robots: { index: false, follow: false },
};

export default function SerumDevPage() {
  return <SerumBottleLabClient />;
}
