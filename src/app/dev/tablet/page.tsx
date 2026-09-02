import type { Metadata } from 'next';
import TabletLabClient from '@/components/dev/TabletLabClient';

export const metadata: Metadata = {
  title: 'Tablet — dev inspector',
  robots: { index: false, follow: false },
};

export default function TabletDevPage() {
  return <TabletLabClient />;
}
