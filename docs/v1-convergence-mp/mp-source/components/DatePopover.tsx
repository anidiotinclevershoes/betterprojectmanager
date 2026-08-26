import React, { useEffect, useRef, useState } from "react";
import { CalendarIcon } from "lucide-react";
import { useKnowledge } from "../contexts/KnowledgeContext";
import { DateEditor } from "./DateEditor";
import { formatRange } from "../utils/dates";

/**
 * A lightweight, deterministic date change. Not AI, not the inspector — a date
 * is a date, so the calendar affordance edits it in place.
 */
export function DatePopover({ id, label }: { id: string; label?: string }) {
  const { dateOf, get } = useKnowledge();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const iso = dateOf(id);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!iso) return null;
  const entity = get(id);
  const semantic = label ?? entity?.dateSemantic ?? "";
  const shown = formatRange(iso, entity?.dateEndISO);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={`${semantic} ${shown} — change date`}
        className={`group/date inline-flex items-center gap-1 whitespace-nowrap rounded-md px-1.5 py-1 text-[0.72rem] tabular-nums transition-colors duration-150 ${
          open
            ? "bg-[rgba(108,140,255,0.16)] text-[#d7e0ff]"
            : "text-[var(--text-muted)] hover:bg-white/[0.06] hover:text-[var(--text-secondary)]"
        }`}
      >
        <CalendarIcon
          className={`h-3 w-3 transition-opacity duration-150 ${
            open ? "opacity-90" : "opacity-0 group-hover/date:opacity-70"
          }`}
        />
        {semantic ? <span className="opacity-80">{semantic}</span> : null}
        <span>{shown}</span>
      </button>

      {open ? (
        <div className="absolute right-0 top-[calc(100%+0.35rem)] z-40 w-[16.5rem] rounded-xl border border-[var(--border-strong)] bg-[var(--bg-raised)] p-3 shadow-[0_18px_44px_-18px_rgba(0,0,0,0.85)]">
          <DateEditor id={id} compact />
          <div className="mt-2 flex justify-end">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg bg-white/[0.06] px-2.5 py-1 text-[0.75rem] text-[var(--text-secondary)] transition-colors duration-150 hover:bg-white/[0.1]"
            >
              Done
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
