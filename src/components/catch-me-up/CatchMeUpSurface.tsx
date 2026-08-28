"use client";

import { useCallback, useEffect, useState } from "react";
import type { CatchMeUpBriefing } from "@/lib/catch-me-up/types";
import { CATCH_ME_UP_API_PATH } from "./iron-man-contract";
import { CatchMeUpBriefingView } from "./CatchMeUpBriefingView";

export type CatchMeUpSurfaceProps = {
  projectId: string;
  /**
   * Dev/preview only. Never used as a production fallback when the live
   * briefing fails — that would display fabricated project content.
   */
  previewBriefing?: CatchMeUpBriefing | null;
  previewStatus?: "loading" | "error" | "unavailable";
  previewError?: string;
};

type SurfaceStatus = "loading" | "ready" | "error" | "unavailable";

export function CatchMeUpSurface({
  projectId,
  previewBriefing,
  previewStatus,
  previewError,
}: CatchMeUpSurfaceProps) {
  const previewLocked =
    previewBriefing !== undefined || Boolean(previewStatus);
  const [status, setStatus] = useState<SurfaceStatus>(
    previewStatus ?? (previewBriefing ? "ready" : "loading"),
  );
  const [briefing, setBriefing] = useState<CatchMeUpBriefing | null>(
    previewBriefing ?? null,
  );
  const [error, setError] = useState<string | null>(previewError ?? null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (previewLocked) return;
      setStatus("loading");
      setError(null);
      setBriefing(null);
      try {
        const response = await fetch(CATCH_ME_UP_API_PATH, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId }),
          signal,
        });
        const data = (await response.json().catch(() => ({}))) as {
          briefing?: CatchMeUpBriefing;
          error?: string;
          code?: string;
        };
        if (signal?.aborted) return;
        if (!response.ok) {
          setBriefing(null);
          if (data.code === "workspace_unavailable") {
            setStatus("unavailable");
            setError(
              data.error ||
                "Catch Me Up reads the live workspace. Connect a workspace to brief this project.",
            );
            return;
          }
          setStatus("error");
          setError(
            data.error || "Catch Me Up could not brief this project.",
          );
          return;
        }
        if (!data.briefing) {
          setBriefing(null);
          setStatus("error");
          setError("Catch Me Up could not brief this project.");
          return;
        }
        setBriefing(data.briefing);
        setStatus("ready");
      } catch (err) {
        if (signal?.aborted) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setBriefing(null);
        setStatus("error");
        setError("Catch Me Up could not brief this project.");
      }
    },
    [previewLocked, projectId],
  );

  useEffect(() => {
    if (previewLocked) return;
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, previewLocked, projectId]);

  const title = briefing?.projectName
    ? `Catch Me Up — ${briefing.projectName}`
    : "Catch Me Up";

  return (
    <div
      className="ocean-catch-me-up"
      data-testid="catch-me-up-surface"
      data-project-id={projectId}
      data-status={status}
    >
      <header className="ocean-catch-me-up-header">
        <div>
          <p className="ocean-catch-me-up-kicker">
            <span className="ocean-ai-glyph" aria-hidden>
              ✦
            </span>
            Catch Me Up
          </p>
          <h2>{title}</h2>
          <p className="ocean-catch-me-up-lede">
            Here is where things stand, what matters, and what I think you should
            notice.
          </p>
        </div>
        <button
          type="button"
          className="ocean-refresh-btn"
          onClick={() => void load()}
          disabled={status === "loading" || previewLocked}
          data-testid="catch-me-up-refresh"
          data-ai="true"
        >
          <span className="ocean-ai-glyph" aria-hidden>
            ✦
          </span>
          {status === "loading" ? "Catching you up…" : "Refresh briefing"}
        </button>
      </header>

      {status === "loading" ? (
        <p className="ocean-catch-me-up-status" data-testid="catch-me-up-loading">
          Catching you up…
        </p>
      ) : null}

      {status === "unavailable" ? (
        <div
          className="ocean-catch-me-up-error"
          data-testid="catch-me-up-unavailable"
          role="status"
        >
          <p>
            {error ||
              "Catch Me Up reads the live workspace. Connect a workspace to brief this project."}
          </p>
          <button
            type="button"
            className="ocean-refresh-btn"
            onClick={() => void load()}
            data-testid="catch-me-up-retry"
          >
            Try again
          </button>
        </div>
      ) : null}

      {status === "error" ? (
        <div
          className="ocean-catch-me-up-error"
          data-testid="catch-me-up-error"
          role="alert"
        >
          <p>{error || "Catch Me Up could not brief this project."}</p>
          <button
            type="button"
            className="ocean-refresh-btn"
            onClick={() => void load()}
            data-testid="catch-me-up-retry"
          >
            Try again
          </button>
        </div>
      ) : null}

      {status === "ready" && briefing ? (
        <CatchMeUpBriefingView briefing={briefing} />
      ) : null}
    </div>
  );
}
