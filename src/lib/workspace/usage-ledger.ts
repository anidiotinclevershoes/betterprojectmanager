/**
 * Month rollover for the existing workspace analysis count.
 * This does not price an analysis or decide who may run one.
 */
export function nextAnalysisCount(
  current: { used: number; monthKey: string | null | undefined },
  monthKey: string,
): number {
  if (current.monthKey !== monthKey) return 1;
  return Math.max(0, current.used) + 1;
}

export type AnalysisUsageLedger = {
  used: number;
  monthKey: string;
};

export function readAnalysisLedger(value: unknown): AnalysisUsageLedger | null {
  if (!value || typeof value !== "object") return null;
  const row = value as { used?: unknown; monthKey?: unknown };
  if (typeof row.used !== "number" || !Number.isFinite(row.used)) return null;
  if (typeof row.monthKey !== "string" || !/^\d{4}-\d{2}$/.test(row.monthKey)) {
    return null;
  }
  return { used: Math.max(0, Math.floor(row.used)), monthKey: row.monthKey };
}

export function adoptAnalysisLedger<
  T extends { analysesThisMonth?: number; analysesMonthKey?: string },
>(state: T, ledger: AnalysisUsageLedger): T {
  return {
    ...state,
    analysesThisMonth: ledger.used,
    analysesMonthKey: ledger.monthKey,
  };
}
