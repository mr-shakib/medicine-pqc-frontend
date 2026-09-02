'use client';

import dynamic from 'next/dynamic';

/**
 * Client boundary for the tablet inspector. `next/dynamic` with `ssr: false` is
 * only valid inside a Client Component, so this lets the route stay a Server
 * Component and keep exporting `metadata`.
 */
const TabletLab = dynamic(() => import('@/components/dev/TabletLab'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 grid place-items-center bg-n00">
      <p className="eyebrow text-n09">Loading inspector…</p>
    </div>
  ),
});

export default function TabletLabClient() {
  return <TabletLab />;
}
