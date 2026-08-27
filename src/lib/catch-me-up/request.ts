/**
 * Catch Me Up request parsing.
 * The only client input that matters is projectId.
 * Posted MissionState / snapshots are discarded.
 */
import type { CatchMeUpRequestBody } from "./types";

export class CatchMeUpRequestError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "CatchMeUpRequestError";
    this.status = status;
    this.code = code;
  }
}

export function readCatchMeUpRequest(body: unknown): { projectId: string } {
  if (!body || typeof body !== "object") {
    throw new CatchMeUpRequestError(
      400,
      "invalid_request",
      "Project is required.",
    );
  }
  const raw = body as CatchMeUpRequestBody;
  const projectId =
    typeof raw.projectId === "string" ? raw.projectId.trim() : "";
  if (!projectId) {
    throw new CatchMeUpRequestError(
      400,
      "invalid_request",
      "Project is required.",
    );
  }
  return { projectId };
}
