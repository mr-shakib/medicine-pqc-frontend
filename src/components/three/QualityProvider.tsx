'use client';

import { createContext, useContext, useMemo } from 'react';
import { BUDGETS, type QualityBudget } from '@/lib/quality';

const QualityContext = createContext<QualityBudget>(BUDGETS.medium);

/**
 * Shares one quality budget with every object in the scene graph.
 *
 * Rendered INSIDE the Canvas so the value reaches the R3F tree directly, and so
 * a live downgrade from `PerformanceMonitor` reaches every scene at once rather
 * than each component detecting its own tier independently.
 */
export function QualityProvider({
  budget,
  children,
}: {
  budget: QualityBudget;
  children: React.ReactNode;
}) {
  const value = useMemo(() => budget, [budget]);
  return (
    <QualityContext.Provider value={value}>{children}</QualityContext.Provider>
  );
}

/** Read the active quality budget from anywhere inside the canvas. */
export function useQuality(): QualityBudget {
  return useContext(QualityContext);
}
