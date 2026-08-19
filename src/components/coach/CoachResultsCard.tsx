"use client";

import { useCoachSession } from "@/components/coach/CoachSessionContext";

const SECTION_ORDER = [
  "Leadership",
  "Risks",
  "Strategic Actions",
  "Disruptive Opportunity",
  "Recommended Actions",
] as const;

function stripMarkdownNoise(text: string) {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "");
}

function parseSections(markdown: string) {
  const blocks = markdown.split(/\n(?=##\s+)/);
  const mapped = new Map<string, string>();
  let intro = "";

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    const headingLine = lines[0]?.startsWith("##") ? lines[0] : null;
    if (!headingLine) {
      intro = stripMarkdownNoise(block.trim());
      continue;
    }
    const heading = headingLine
      .replace(/^##\s+/, "")
      .replace(/^\d+\.\s*/, "")
      .trim();
    const body = stripMarkdownNoise(lines.slice(1).join("\n").trim());
    const key =
      SECTION_ORDER.find((name) =>
        heading.toLowerCase().includes(name.toLowerCase()),
      ) ?? heading;
    mapped.set(key, body);
  }

  return { intro, mapped };
}

function renderLines(body: string) {
  return body.split("\n").map((line, idx) => {
    const key = `${idx}-${line.slice(0, 20)}`;
    if (!line.trim()) return null;
    if (line.startsWith("> ")) {
      return (
        <blockquote key={key}>{line.replace(/^>\s?/, "")}</blockquote>
      );
    }
    return <p key={key}>{line}</p>;
  });
}

export function CoachResultsCard() {
  const {
    showResults,
    busy,
    markdown,
    title,
    provider,
    lastRunAt,
    error,
    actions,
    accepted,
    acceptAction,
    dismissResults,
    openDrawer,
    scope,
  } = useCoachSession();

  if (!showResults) return null;

  const { intro, mapped } = parseSections(markdown);
  const ordered = [
    ...SECTION_ORDER.filter((name) => mapped.has(name)),
    ...[...mapped.keys()].filter(
      (k) => !(SECTION_ORDER as readonly string[]).includes(k),
    ),
  ];

  const scopeLabel =
    scope === "project" ? "Current project" : "All projects";

  return (
    <section className="coach-results-card" aria-live="polite">
      <header className="coach-results-header">
        <div className="min-w-0">
          <p className="eyebrow">Lume Coach</p>
          <h2>{busy && !markdown ? "Reviewing…" : title || "Coaching results"}</h2>
          <p className="meta">
            Scope: {scopeLabel}
            {provider ? ` · ${provider === "openai" ? "OpenAI" : "Local"}` : ""}
            {lastRunAt
              ? ` · ${new Date(lastRunAt).toISOString().slice(0, 16).replace("T", " ")}`
              : ""}
          </p>
        </div>
        <div className="coach-results-header-actions">
          <button type="button" className="ghost-btn" onClick={openDrawer}>
            Run again
          </button>
          <button type="button" className="ghost-btn" onClick={dismissResults}>
            Dismiss
          </button>
        </div>
      </header>

      {error ? <p className="error-banner">{error}</p> : null}
      {busy && !markdown ? (
        <p className="empty-copy">
          Reviewing your projects, tasks, meetings and knowledge…
        </p>
      ) : null}

      {intro ? (
        <div className="coach-section-body coach-results-intro">
          {renderLines(intro)}
        </div>
      ) : null}

      <div className="coach-results-grid">
        {ordered.map((name) => {
          const body = mapped.get(name) ?? "";
          const isDisruptive = name.toLowerCase().includes("disruptive");
          return (
            <section
              key={name}
              className={`coach-results-section ${isDisruptive ? "is-disruptive" : ""}`}
            >
              <h3>{name}</h3>
              <div className="coach-section-body">{renderLines(body)}</div>
            </section>
          );
        })}
      </div>

      {actions.length > 0 ? (
        <div className="coach-results-actions">
          <h3>Accept into workspace</h3>
          <ul>
            {actions.slice(0, 10).map((action) => (
              <li key={action.id}>
                <p>{stripMarkdownNoise(action.title)}</p>
                {accepted[action.id] ? (
                  <span className="accepted">{accepted[action.id]}</span>
                ) : (
                  <div className="row-actions">
                    <button
                      type="button"
                      className="ghost-btn"
                      onClick={() => acceptAction(action, "todo")}
                    >
                      To Do
                    </button>
                    <button
                      type="button"
                      className="ghost-btn"
                      onClick={() => acceptAction(action, "suggestion")}
                    >
                      Suggestion
                    </button>
                    <button
                      type="button"
                      className="ghost-btn"
                      onClick={() => acceptAction(action, "knowledge")}
                    >
                      Knowledge
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
