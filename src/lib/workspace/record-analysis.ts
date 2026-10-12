import { isSupabaseAuth } from "@/lib/auth-mode";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { serverLog } from "@/lib/server-log";
import {
  readAnalysisLedger,
  type AnalysisUsageLedger,
} from "@/lib/workspace/usage-ledger";

/**
 * Count one completed analysis on workspace_usage.
 * A missing function or a failed write does not fail the analysis.
 * This does not price the analysis or decide whether another one is allowed.
 */
export async function recordWorkspaceAnalysis(
  workspaceId: string | null | undefined,
): Promise<AnalysisUsageLedger | null> {
  if (!workspaceId || !isSupabaseAuth()) return null;
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc("record_workspace_analysis", {
      p_workspace_id: workspaceId,
    });
    if (error) {
      serverLog.warn("usage.record_failed", { message: error.message });
      return null;
    }
    return readAnalysisLedger(data);
  } catch (err) {
    serverLog.warn("usage.record_failed", {
      message: err instanceof Error ? err.message : "unknown",
    });
    return null;
  }
}
