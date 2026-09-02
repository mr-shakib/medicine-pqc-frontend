'use client';

import dynamic from 'next/dynamic';

/** Client boundary for the vial inspector — see CapsuleLabClient. */
const SerumBottleLab = dynamic(
  () => import('@/components/dev/SerumBottleLab'),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 grid place-items-center bg-n00">
        <p className="eyebrow text-n09">Loading inspector…</p>
      </div>
    ),
  },
);

export default function SerumBottleLabClient() {
  return <SerumBottleLab />;
}
