'use client';

import { useMemo, useState, type Dispatch, type SetStateAction } from 'react';
import {
  BUDGETS,
  detectQualityTier,
  type QualityBudget,
  type QualityTier,
} from '@/lib/quality';

/**
 * Owns the device quality tier.
 *
 * Called exactly once, by `ThreeExperience`; every other component reads the
 * resulting budget through `QualityProvider`. Detection happens in a lazy state
 * initialiser rather than an effect -- safe here because the whole 3D layer is
 * a client-only dynamic import and never server-renders.
 */
export function useQualityTier(): {
  tier: QualityTier;
  budget: QualityBudget;
  setTier: Dispatch<SetStateAction<QualityTier>>;
} {
  const [tier, setTier] = useState<QualityTier>(detectQualityTier);
  const budget = useMemo(() => BUDGETS[tier], [tier]);

  return { tier, budget, setTier };
}
