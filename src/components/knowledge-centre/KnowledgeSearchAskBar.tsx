"use client";

import { FormEvent, useMemo, useState } from "react";
import { useMission } from "@/lib/store";
import { searchAuthoritativeProject } from "@/lib/knowledge-centre/search-authority";
import { highlightMatches } from "@/lib/tell-me/knowledge-search";
import { useTellMeSession } from "@/components/tell-me/TellMeSessionContext";

/**
 * Deterministic Search Knowledge + ✦ Ask Lume — clearly distinct.
 * Search never calls AI. Ask uses existing Tell Me session (server-loaded
 * canonical truth on `/api/tell-me`; suggestions remain local MissionState cache).
 */
export function KnowledgeSearchAskBar({ projectId }: { projectId: string }) {
  const { state } = useMission();
  const {
    question,
    setQuestion,
    ask,
    busy,
    error,
    answer,
    suggestions,
    clearThread,
  } = useTellMeSession();
  const [search, setSearch] = useState("");
  const [showAllSuggestions, setShowAllSuggestions] = useState(false);

  const hits = useMemo(
    () => searchAuthoritativeProject(state, projectId, search),
    [state, projectId, search],
  );

  const visibleSuggestions = showAllSuggestions
    ? suggestions
    : suggestions.slice(0, 3);

  async function onAsk(e: FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || busy) return;
    await ask(q);
  }

  async function onSuggestion(q: string) {
    setQuestion(q);
    await ask(q);
  }

  return (
    <div className="ocean-search-ask" data-testid="ocean-search-ask">
      <div className="ocean-search-ask-row">
        <label className="ocean-search-field">
          <span className="sr-only">Search knowledge</span>
          <span className="ocean-search-ico" aria-hidden>
            ⌕
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search knowledge…"
            autoComplete="off"
            data-testid="ocean-search-input"
            data-ai="false"
          />
        </label>
        <span className="ocean-search-or" aria-hidden>
          or
        </span>
        <form className="ocean-ask-field" onSubmit={onAsk}>
          <span className="ocean-ai-glyph" aria-hidden>
            ✦
          </span>
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask Lume anything…"
            autoComplete="off"
            data-testid="ocean-ask-input"
            data-ai="true"
          />
          <button
            type="submit"
            className="ocean-ask-send"
            disabled={busy || !question.trim()}
            aria-label="Ask Lume"
            data-testid="ocean-ask-send"
          >
            {busy ? "…" : "→"}
          </button>
        </form>
      </div>

      {search.trim() ? (
        <div
          className="ocean-search-results"
          data-testid="ocean-search-results"
          aria-live="polite"
        >
          {hits.length === 0 ? (
            <p className="ocean-search-empty">No matches in Knowledge.</p>
          ) : (
            <ul>
              {hits.slice(0, 12).map((hit) => (
                <li key={hit.id}>
                  <span className="ocean-search-section">{hit.sectionLabel}</span>
                  <span className="ocean-search-bullet">
                    {highlightMatches(hit.bullet, hit.matchRanges).map(
                      (part, i) =>
                        part.hit ? (
                          <mark key={i}>{part.text}</mark>
                        ) : (
                          <span key={i}>{part.text}</span>
                        ),
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {!search.trim() && visibleSuggestions.length ? (
        <div
          className="ocean-suggestions"
          data-testid="ocean-suggestions"
        >
          {visibleSuggestions.map((s) => (
            <button
              key={s.id}
              type="button"
              className="ocean-suggestion-link"
              onClick={() => void onSuggestion(s.question)}
            >
              {s.question}
            </button>
          ))}
          {suggestions.length > 3 ? (
            <button
              type="button"
              className="ocean-suggestion-more"
              onClick={() => setShowAllSuggestions((v) => !v)}
            >
              {showAllSuggestions ? "Show less" : "View all ›"}
            </button>
          ) : null}
        </div>
      ) : null}

      {(answer || error) && !search.trim() ? (
        <div
          className="ocean-ask-answer"
          data-testid="ocean-ask-answer"
          role="region"
          aria-label="Ask Lume answer"
        >
          {error ? <p className="ocean-ask-error">{error}</p> : null}
          {answer ? (
            <>
              <p className="ocean-ask-answer-text">{answer.answer}</p>
              {answer.noticed?.length ? (
                <div className="ocean-ask-noticed">
                  <p className="ocean-ask-noticed-label">✦ Lume noticed</p>
                  <ul>
                    {answer.noticed.map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {answer.needsConfirmation?.length ? (
                <div className="ocean-ask-needs">
                  <p className="ocean-ask-needs-label">Needs you</p>
                  <ul>
                    {answer.needsConfirmation.map((n) => (
                      <li key={n.id}>{n.summary}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <button
                type="button"
                className="ocean-ask-clear"
                onClick={clearThread}
              >
                Clear answer
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
