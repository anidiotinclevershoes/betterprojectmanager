import type { ReactNode } from "react";
import type { SuggestionKind } from "@/lib/capture/suggestions";
import type { ReviewOpFamily } from "@/lib/capture/review/reviewLanguage";

const cap = {
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

function IconFrame({
  size,
  children,
}: {
  size: number;
  children: ReactNode;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      {...cap}
      aria-hidden
    >
      {children}
    </svg>
  );
}

/** Lucide-equivalent domain marks. Neutral colour is applied by CSS. */
export function DomainMark({
  kind,
  title,
  size = 22,
}: {
  kind: SuggestionKind;
  title?: string;
  size?: number;
}) {
  return (
    <span className="lume-review-domain-mark" title={title} aria-hidden>
      <IconFrame size={size}>
        <DomainGlyph kind={kind} />
      </IconFrame>
    </span>
  );
}

function DomainGlyph({ kind }: { kind: SuggestionKind }) {
  switch (kind) {
    case "stakeholder":
    case "availability":
      // UserRound
      return (
        <>
          <circle cx="12" cy="8" r="5" />
          <path d="M20 21a8 8 0 0 0-16 0" />
        </>
      );
    case "action":
      // SquareCheck
      return (
        <>
          <rect width="18" height="18" x="3" y="3" rx="2" />
          <path d="m9 12 2 2 4-4" />
        </>
      );
    case "nudge":
      // Bell — reminder
      return (
        <>
          <path d="M10.268 21a2 2 0 0 0 3.464 0" />
          <path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326" />
        </>
      );
    case "milestone":
      // Flag
      return (
        <>
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
          <line x1="4" x2="4" y1="22" y2="15" />
        </>
      );
    case "meeting":
      // CalendarDays
      return (
        <>
          <path d="M8 2v4" />
          <path d="M16 2v4" />
          <rect width="18" height="18" x="3" y="4" rx="2" />
          <path d="M3 10h18" />
          <path d="M8 14h.01" />
          <path d="M12 14h.01" />
          <path d="M16 14h.01" />
          <path d="M8 18h.01" />
          <path d="M12 18h.01" />
          <path d="M16 18h.01" />
        </>
      );
    case "risk":
      // ShieldAlert — not a warning triangle
      return (
        <>
          <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
          <path d="M12 8v4" />
          <path d="M12 16h.01" />
        </>
      );
    case "decision":
      // Diamond
      return (
        <path d="M2.7 10.3a2.41 2.41 0 0 0 0 3.41l7.59 7.59a2.41 2.41 0 0 0 3.41 0l7.59-7.59a2.41 2.41 0 0 0 0-3.41L13.7 2.71a2.41 2.41 0 0 0-3.41 0z" />
      );
    case "knowledge":
    case "memory":
      // BookOpen
      return (
        <>
          <path d="M12 7v14" />
          <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
        </>
      );
    default:
      return <circle cx="12" cy="12" r="9" />;
  }
}

/** Lucide-equivalent operation/state marks. Colour comes from the header band. */
export function OperationMark({
  family,
  size = 20,
}: {
  family: ReviewOpFamily;
  size?: number;
}) {
  return (
    <span className="lume-review-op-mark" aria-hidden>
      <IconFrame size={size}>
        <OperationGlyph family={family} />
      </IconFrame>
    </span>
  );
}

function OperationGlyph({ family }: { family: ReviewOpFamily }) {
  switch (family) {
    case "create":
      // CirclePlus
      return (
        <>
          <circle cx="12" cy="12" r="10" />
          <path d="M8 12h8" />
          <path d="M12 8v8" />
        </>
      );
    case "remove":
      // CircleMinus
      return (
        <>
          <circle cx="12" cy="12" r="10" />
          <path d="M8 12h8" />
        </>
      );
    case "needs_you":
      // CircleHelp
      return (
        <>
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <path d="M12 17h.01" />
        </>
      );
    default:
      // Pencil — Update, including Complete-as-status-update
      return (
        <>
          <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z" />
          <path d="m15 5 4 4" />
        </>
      );
  }
}
