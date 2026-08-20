"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMission } from "@/lib/store";
import { ResetDemoDataButton } from "@/components/dev/ResetDemoDataButton";
import { EvalsNavLink } from "@/components/evals/EvalsNavLink";

/**
 * Ocean V1 sidebar.
 * Modes (Capture / Knowledge Centre / Advise) live in the project workspace —
 * not here. No Overview page, no Coach nav, no health dots.
 */
export function Sidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
  userName,
}: {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  userName?: string | null;
}) {
  const pathname = usePathname();
  const { state } = useMission();

  const projectMatch = pathname.match(/^\/projects\/([^/]+)/);
  const routeId = projectMatch?.[1] ?? null;
  const onNew = routeId === "new";
  const activeProjectId = routeId && routeId !== "new" ? routeId : null;

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={onCloseMobile}
        />
      ) : null}
      <aside
        className={`app-sidebar ocean-sidebar ${collapsed ? "is-collapsed" : ""} ${mobileOpen ? "is-mobile-open" : ""}`}
        aria-label="Primary"
        data-testid="ocean-sidebar"
      >
        <div className="sidebar-top">
          <Link
            href={state.projects[0] ? `/projects/${state.projects[0].id}` : "/"}
            className="sidebar-brand ocean-brand"
            onClick={onCloseMobile}
            title="Lume"
          >
            {!collapsed ? (
              <span className="ocean-wordmark" data-testid="ocean-wordmark">
                lu<span className="ocean-wordmark-me">me</span>
              </span>
            ) : (
              <span className="ocean-wordmark-compact">L</span>
            )}
          </Link>
        </div>

        <nav className="sidebar-nav" data-testid="ocean-sidebar-nav">
          <div className="ocean-sidebar-projects-head">
            <p className="sidebar-label">{collapsed ? "P" : "PROJECTS"}</p>
            {!collapsed ? (
              <Link
                href="/projects/new"
                className={`ocean-new-project ${onNew ? "is-active" : ""}`}
                onClick={onCloseMobile}
                data-testid="ocean-new-project"
              >
                <span aria-hidden>+</span> New Project
              </Link>
            ) : (
              <Link
                href="/projects/new"
                className={`sidebar-link ${onNew ? "is-active" : ""}`}
                onClick={onCloseMobile}
                title="New Project"
              >
                <span className="sidebar-ico" aria-hidden>
                  +
                </span>
              </Link>
            )}
          </div>

          {state.projects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              title={project.name}
              className={`sidebar-link sidebar-project ${activeProjectId === project.id ? "is-active is-project-owned" : ""}`}
              onClick={onCloseMobile}
              data-testid={`ocean-project-link-${project.id}`}
            >
              {!collapsed ? (
                <span className="sidebar-project-meta">
                  <span className="truncate font-semibold">{project.name}</span>
                </span>
              ) : (
                <span className="sidebar-ico truncate">
                  {project.name.slice(0, 1)}
                </span>
              )}
            </Link>
          ))}

          <p className="sidebar-label">{collapsed ? "·" : ""}</p>
          <Link
            href="/todos"
            className={`sidebar-link ${pathname.startsWith("/todos") ? "is-active" : ""}`}
            onClick={onCloseMobile}
            data-testid="ocean-nav-master-todo"
          >
            <span className="sidebar-ico" aria-hidden>
              ✓
            </span>
            {!collapsed ? <span>Master To Do</span> : null}
          </Link>
          <Link
            href="/history"
            className={`sidebar-link ${pathname.startsWith("/history") ? "is-active" : ""}`}
            onClick={onCloseMobile}
            data-testid="ocean-nav-history"
          >
            <span className="sidebar-ico" aria-hidden>
              ⏱
            </span>
            {!collapsed ? <span>History</span> : null}
          </Link>
          <Link
            href="/captures"
            className={`sidebar-link ${pathname.startsWith("/captures") ? "is-active" : ""}`}
            onClick={onCloseMobile}
            data-testid="ocean-nav-captures"
            title="Capture sessions"
          >
            <span className="sidebar-ico" aria-hidden>
              ⎚
            </span>
            {!collapsed ? <span>Captures</span> : null}
          </Link>

          {/* Internal / dev only — never for normal product nav */}
          <EvalsNavLink collapsed={collapsed} onNavigate={onCloseMobile} />
          {process.env.NODE_ENV === "development" ? (
            <>
              <Link
                href="/dev/golden-test"
                className={`sidebar-link ${pathname.startsWith("/dev/golden-test") ? "is-active" : ""}`}
                onClick={onCloseMobile}
                title="Golden Test (development only)"
              >
                <span className="sidebar-ico" aria-hidden>
                  🧪
                </span>
                {!collapsed ? <span>Golden Test</span> : null}
              </Link>
              <Link
                href="/dev/ai-cockpit"
                className={`sidebar-link ${pathname.startsWith("/dev/ai-cockpit") ? "is-active" : ""}`}
                onClick={onCloseMobile}
                title="AI Cockpit (development only)"
              >
                <span className="sidebar-ico" aria-hidden>
                  🧠
                </span>
                {!collapsed ? <span>AI Cockpit</span> : null}
              </Link>
              <ResetDemoDataButton
                collapsed={collapsed}
                onAfterReset={onCloseMobile}
              />
            </>
          ) : null}
        </nav>

        <div className="sidebar-bottom ocean-sidebar-bottom">
          <Link
            href="/account"
            className={`sidebar-link ${pathname.startsWith("/account") ? "is-active" : ""}`}
            onClick={onCloseMobile}
            data-testid="ocean-nav-account"
          >
            <span className="sidebar-ico" aria-hidden>
              ◉
            </span>
            {!collapsed ? (
              <span className="ocean-account-label">
                {userName?.trim() || "Account"}
              </span>
            ) : null}
          </Link>
          <a
            className="sidebar-link"
            href="mailto:support@lume.app?subject=Lume%20help"
            onClick={onCloseMobile}
            data-testid="ocean-nav-help"
          >
            <span className="sidebar-ico" aria-hidden>
              ?
            </span>
            {!collapsed ? <span>Help & support</span> : null}
          </a>
          <button
            type="button"
            className="sidebar-link sidebar-btn"
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            <span className="sidebar-ico" aria-hidden>
              {collapsed ? "»" : "«"}
            </span>
            {!collapsed ? <span>Collapse</span> : null}
          </button>
        </div>
      </aside>
    </>
  );
}
