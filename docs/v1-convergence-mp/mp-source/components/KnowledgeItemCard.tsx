import React from "react";
import { useKnowledge } from "../contexts/KnowledgeContext";
import { TrustMark } from "./TrustMark";
import { PersonMark } from "./PersonMark";
import { DatePopover } from "./DatePopover";
import type { Severity } from "../types/knowledge";

function PriorityDot({ severity }: { severity?: Severity }) {
  const colors: Record<string, string> = {
    high: "#e45b5b",
    medium: "#e4a23b",
    low: "#35b97f",
  };
  return (
    <span
      className="mt-[0.42rem] h-[0.45rem] w-[0.45rem] shrink-0 rounded-full"
      style={{ background: severity ? colors[severity] : "#6b7280" }}
      aria-hidden
    />
  );
}

/**
 * The approved Ocean knowledge item, now openable. Additions are quiet: a trust
 * mark only when the state is not ordinary, and a calendar affordance where a
 * date can simply be changed in place.
 */
export function KnowledgeItemCard({
  id,
  showDot = false,
  showDate = false,
  showPerson = false,
}: {
  id: string;
  showDot?: boolean;
  showDate?: boolean;
  showPerson?: boolean;
}) {
  const { get, currentId, open, trustOf, isDone } = useKnowledge();
  const entity = get(id);
  if (!entity) return null;

  const selected = currentId === id;
  const trust = trustOf(id);
  const done = isDone(id);

  return (
    <div
      className={`ocean-knowledge-item flex w-full gap-2.5 rounded-lg border border-[var(--border-subtle)] bg-white/[0.02] p-2.5 text-left transition-colors duration-150 hover:border-[var(--border-strong)] hover:bg-white/[0.04]${
        selected ? " is-selected" : ""
      }`}
    >
      <button
        type="button"
        onClick={() => open(id)}
        className="flex min-w-0 flex-1 gap-2.5 text-left"
      >
        {showDot ? <PriorityDot severity={entity.severity} /> : null}
        {showPerson ? (
          <span className="mt-[0.1rem]">
            <PersonMark initials={entity.initials} size="md" active={selected} />
          </span>
        ) : null}

        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span
            className={`text-[0.88rem] leading-snug text-[var(--text-primary)]${
              done ? " line-through opacity-50" : ""
            }`}
          >
            {entity.name}
          </span>
          {entity.meta ? (
            <span className="text-[0.75rem] leading-snug text-[var(--text-muted)]">
              {entity.meta}
            </span>
          ) : null}
          {trust !== "known" ? <TrustMark trust={trust} className="mt-1" /> : null}
        </span>
      </button>

      {showDate ? <DatePopover id={id} /> : null}
    </div>
  );
}
