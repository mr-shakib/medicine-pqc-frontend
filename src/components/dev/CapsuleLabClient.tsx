'use client';

import dynamic from 'next/dynamic';

/**
 * Client boundary for the capsule inspector.
 *
 * `next/dynamic` with `ssr: false` is only valid inside a Client Component, so
 * this thin wrapper exists to let the route itself stay a Server Component and
 * keep exporting `metadata`.
 */
const CapsuleLab = dynamic(() => import('@/components/dev/CapsuleLab'), {
  ssr: false,
  loading: () => (
    <div className="fixed inset-0 grid place-items-center bg-n00">
      <p className="eyebrow text-n09">Loading inspector…</p>
    </div>
  ),
});

export default function CapsuleLabClient() {
  return <CapsuleLab />;
}
