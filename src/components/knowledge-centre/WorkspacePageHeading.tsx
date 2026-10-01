import "./workspace-page-heading.css";

/**
 * Page 09 P09/Common/PageHeading.
 * Callers pass copy only. Desktop and narrow type live in the stylesheet.
 */
export function WorkspacePageHeading({
  title,
  support,
  narrowSupport,
}: {
  title: string;
  support: string;
  narrowSupport?: string;
}) {
  return (
    <header className="lume-page-heading" data-testid="lume-page-heading">
      <h2 className="lume-page-heading-title">{title}</h2>
      <p className="lume-page-heading-support">{support}</p>
      {narrowSupport ? (
        <p className="lume-page-heading-support is-narrow">{narrowSupport}</p>
      ) : null}
    </header>
  );
}

/** Approved Home / Knowledge Centre / Project Scan copy. Capture is separate. */
export const WORKSPACE_PAGE_HEADINGS = {
  home: {
    title: "Home",
    support: "What needs your attention next.",
    narrowSupport: "What needs your attention now.",
  },
  knowledge: {
    title: "Knowledge Centre",
    support: "Search and work with the project information Lume has saved.",
    narrowSupport: "Search, ask and work with saved project information.",
  },
  scan: {
    title: "Project Scan",
    support:
      "Lume scanned the project for things worth attention. Nothing changes until you act.",
    narrowSupport: "Things in the project that may need your attention.",
  },
} as const;
