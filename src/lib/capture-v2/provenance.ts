/**
 * Privacy-safe intelligence provenance for hosted Capture / New Project.
 * Never logs secrets, API keys, or raw user content.
 */
import { serverLog } from "@/lib/server-log";
import {
  CAPTURE_V2_EXTRACT_PATH,
  CAPTURE_V2_PROMPT_ID,
  CAPTURE_V2_PROMPT_VERSION,
} from "./prompt";

export type IntelligenceProvider = "openai" | "local" | "none";

export type IntelligenceProvenance = {
  provider: IntelligenceProvider;
  requestedModel: string | null;
  responseModel: string | null;
  promptId: string;
  promptVersion: string;
  path: string;
  fallback: boolean;
  fallbackReason: string | null;
  elapsedMs: number;
  observationCount: number;
  usagePrompt: number | null;
  usageCompletion: number | null;
  usageTotal: number | null;
  pipeline: "v2";
};

export function observationCountFromRaw(raw: unknown): number {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return 0;
  const list = (raw as { observations?: unknown }).observations;
  return Array.isArray(list) ? list.length : 0;
}

export function extractProvenanceBase(): Pick<
  IntelligenceProvenance,
  "promptId" | "promptVersion" | "path" | "pipeline"
> {
  return {
    promptId: CAPTURE_V2_PROMPT_ID,
    promptVersion: CAPTURE_V2_PROMPT_VERSION,
    path: CAPTURE_V2_EXTRACT_PATH,
    pipeline: "v2",
  };
}

export function logIntelligenceProvenance(
  event: string,
  fields: IntelligenceProvenance & {
    userId?: string;
    projectId?: string;
    ignoredClientTruth?: boolean;
    envelopeMalformed?: boolean;
  },
) {
  serverLog.info(event, fields);
}
