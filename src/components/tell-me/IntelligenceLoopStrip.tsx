"use client";

/**
 * Capture → Lume learns → Tell Me relationship strip.
 * Kept free of server/AI imports so Capture pages stay client-safe.
 */
export function IntelligenceLoopStrip({
  onScrollToKnowledge,
}: {
  onScrollToKnowledge?: () => void;
}) {
  return (
    <div className="intelligence-loop" aria-label="Capture, learn, Tell Me">
      <div className="intelligence-loop-step is-static">
        <span className="intelligence-loop-title">Capture</span>
        <span className="intelligence-loop-copy">Tell Lume what happened</span>
      </div>
      <span className="intelligence-loop-arrow" aria-hidden>
        →
      </span>
      <button
        type="button"
        className="intelligence-loop-step is-action"
        onClick={() => onScrollToKnowledge?.()}
      >
        <span className="intelligence-loop-title">Lume learns</span>
        <span className="intelligence-loop-copy">Project memory grows</span>
      </button>
      <span className="intelligence-loop-arrow" aria-hidden>
        →
      </span>
      <button
        type="button"
        className="intelligence-loop-step is-action"
        onClick={() =>
          window.dispatchEvent(
            new CustomEvent("lume:open-tell-me", { detail: {} }),
          )
        }
      >
        <span className="intelligence-loop-title">Tell Me</span>
        <span className="intelligence-loop-copy">Ask what Lume knows</span>
      </button>
    </div>
  );
}
