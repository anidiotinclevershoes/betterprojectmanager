"use client";

import { useMemo, useState } from "react";
import { useMission } from "@/lib/store";
import type { HistoryEventType } from "@/lib/types";

const TYPE_LABELS: Record<HistoryEventType, string> = {
  task_added: "Task added",
  task_completed: "Task completed",
  task_updated: "Task updated",
  suggestion_accepted: "Suggestion accepted",
  suggestion_dismissed: "Suggestion dismissed",
  meeting_created: "Meeting created",
  milestone_changed: "Milestone changed",
  risk_added: "Risk added",
  knowledge_updated: "Knowledge updated",
  project_created: "Project created",
  capture_analysed: "Capture analysed",
  coach_accepted: "Coach accepted",
  nudge_chased: "Nudge chased",
  nudge_resolved: "Nudge resolved",
  other: "Update",
};

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

function dayLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yday = new Date();
  yday.setDate(today.getDate() - 1);
  const key = dayKey(iso);
  if (key === dayKey(today.toISOString())) {
    return `Today — ${d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`;
  }
  if (key === dayKey(yday.toISOString())) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default function HistoryPage() {
  const { state, hydrated } = useMission();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");

  const events = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...(state.history ?? [])]
      .filter((e) => (typeFilter === "all" ? true : e.type === typeFilter))
      .filter((e) =>
        projectFilter === "all" ? true : e.projectId === projectFilter,
      )
      .filter((e) => {
        if (!q) return true;
        return (
          e.title.toLowerCase().includes(q) ||
          (e.detail ?? "").toLowerCase().includes(q) ||
          TYPE_LABELS[e.type].toLowerCase().includes(q)
        );
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [state.history, query, typeFilter, projectFilter]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof events>();
    for (const event of events) {
      const key = dayKey(event.createdAt);
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [events]);

  const projectCode = (id?: string | null) =>
    id ? state.projects.find((p) => p.id === id)?.code ?? "—" : "—";

  return (
    <div className="history-page">
      <div className="history-toolbar">
        <label className="history-search">
          <span className="sr-only">Search history</span>
          <input
            type="search"
            placeholder="Search history…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          aria-label="Filter by type"
        >
          <option value="all">All types</option>
          {Object.entries(TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
          aria-label="Filter by project"
        >
          <option value="all">All projects</option>
          {state.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code}
            </option>
          ))}
        </select>
      </div>

      {!hydrated ? (
        <p className="empty-copy">Loading history…</p>
      ) : groups.length === 0 ? (
        <p className="empty-copy">No history matches these filters.</p>
      ) : (
        <div className="history-feed">
          {groups.map(([key, list]) => (
            <section key={key} className="history-day">
              <h2>{dayLabel(list[0].createdAt)}</h2>
              <ul>
                {list.map((event) => (
                  <li key={event.id} className="history-row">
                    <span
                      className={`history-ico history-ico-${event.source ?? "user"}`}
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1">
                      <p className="history-title">
                        {TYPE_LABELS[event.type]}
                        {event.source === "ai" ? (
                          <span className="tag">AI</span>
                        ) : null}
                      </p>
                      {event.detail ? (
                        <p className="history-detail">{event.detail}</p>
                      ) : null}
                    </div>
                    <span className="tag">{projectCode(event.projectId)}</span>
                    <span className="meta">{timeLabel(event.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
