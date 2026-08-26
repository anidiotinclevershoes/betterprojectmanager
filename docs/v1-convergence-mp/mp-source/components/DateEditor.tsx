import React from "react";
import { useKnowledge } from "../contexts/KnowledgeContext";
import { TODAY_ISO, WEEKDAYS, formatLong, monthGrid, relativeSuffix } from "../utils/dates";

/** An ordinary, deterministic date edit — click a day, the date changes. */
export function DateEditor({ id, compact = false }: { id: string; compact?: boolean }) {
  const { dateOf, setDate, get } = useKnowledge();
  const iso = dateOf(id);
  if (!iso) return null;
  const { title, cells } = monthGrid(iso);
  const entity = get(id);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="m-0 text-[0.84rem] font-medium text-[var(--text-primary)]">
          {entity?.dateSemantic ? (
            <span className="mr-1.5 text-[var(--text-muted)]">{entity.dateSemantic}</span>
          ) : null}
          {formatLong(iso)}
        </p>
        <span className="shrink-0 text-[0.74rem] text-[var(--text-muted)]">
          {relativeSuffix(iso)}
        </span>
      </div>

      <div className={`rounded-xl bg-white/[0.03] p-2.5 ${compact ? "mt-2" : "mt-2.5"}`}>
        <p className="m-0 px-1 pb-2 text-[0.72rem] font-medium text-[var(--text-secondary)]">
          {title}
        </p>
        <div className="grid grid-cols-7 gap-y-0.5">
          {WEEKDAYS.map((d, i) => (
            <span
              key={`${d}-${i}`}
              className="pb-1 text-center text-[0.62rem] font-medium text-[var(--text-muted)]"
            >
              {d}
            </span>
          ))}
          {cells.map((c) => {
            const selected = c.iso === iso;
            const isToday = c.iso === TODAY_ISO;
            return (
              <button
                key={c.iso}
                type="button"
                onClick={() => setDate(id, c.iso)}
                aria-pressed={selected}
                className={`mx-auto flex h-[1.7rem] w-[1.7rem] items-center justify-center rounded-md text-[0.75rem] tabular-nums transition-colors duration-150 ${
                  selected
                    ? "bg-[var(--info)] font-semibold text-[#0b1020]"
                    : c.outside
                      ? "text-[var(--text-muted)] opacity-40 hover:bg-white/[0.05]"
                      : "text-[var(--text-secondary)] hover:bg-white/[0.08]"
                } ${isToday && !selected ? "shadow-[inset_0_0_0_1px_rgba(108,140,255,0.5)]" : ""}`}
              >
                {c.day}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
