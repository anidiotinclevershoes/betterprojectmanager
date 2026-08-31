import type { SuggestionKind } from "@/lib/capture/suggestions";

/** Lightweight domain marks — reusable later on Knowledge Centre / History. */
export function DomainMark({
  kind,
  title,
}: {
  kind: SuggestionKind;
  title?: string;
}) {
  return (
    <span className="lume-review-domain-mark" title={title} aria-hidden>
      <svg viewBox="0 0 16 16" width="14" height="14" fill="none">
        <DomainGlyph kind={kind} />
      </svg>
    </span>
  );
}

function DomainGlyph({ kind }: { kind: SuggestionKind }) {
  const sw = 1.5;
  const cap = { strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (kind) {
    case "stakeholder":
    case "availability":
      return (
        <g stroke="currentColor" strokeWidth={sw} {...cap}>
          <circle cx="8" cy="5.2" r="2.3" />
          <path d="M3.4 13.2c.6-2.3 2.3-3.5 4.6-3.5s4 1.2 4.6 3.5" />
        </g>
      );
    case "action":
    case "nudge":
      return (
        <g stroke="currentColor" strokeWidth={sw} {...cap}>
          <rect x="2.5" y="2.5" width="11" height="11" rx="2.2" />
          <path d="M5 8.2 7.1 10.2 11.2 5.8" />
        </g>
      );
    case "milestone":
      return (
        <g stroke="currentColor" strokeWidth={sw} {...cap}>
          <path d="M4.2 13.2V3.6h7.2L9.6 6.4l1.8 2.8H4.2" />
        </g>
      );
    case "risk":
      return (
        <g stroke="currentColor" strokeWidth={sw} {...cap}>
          <path d="M8 2.6 13.6 13H2.4L8 2.6Z" />
          <path d="M8 6.6v2.6" />
          <circle cx="8" cy="11.1" r="0.6" fill="currentColor" stroke="none" />
        </g>
      );
    case "decision":
      return (
        <g stroke="currentColor" strokeWidth={sw} {...cap}>
          <circle cx="8" cy="8" r="5.4" />
          <path d="M8 4.8v6.4M5.4 8h5.2" />
        </g>
      );
    case "meeting":
      return (
        <g stroke="currentColor" strokeWidth={sw} {...cap}>
          <rect x="2.5" y="3.4" width="11" height="10" rx="1.6" />
          <path d="M2.5 6.4h11M5.2 2.6v2.2M10.8 2.6v2.2" />
        </g>
      );
    case "knowledge":
    case "memory":
      return (
        <g stroke="currentColor" strokeWidth={sw} {...cap}>
          <path d="M3.2 3.2h6.2a2.4 2.4 0 0 1 2.4 2.4v7.2H5.6A2.4 2.4 0 0 0 3.2 10.4V3.2Z" />
          <path d="M5.6 12.8v-7" />
        </g>
      );
    default:
      return (
        <g stroke="currentColor" strokeWidth={sw} {...cap}>
          <circle cx="8" cy="8" r="5.2" />
        </g>
      );
  }
}
