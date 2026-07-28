"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMission } from "@/lib/store";

export function Sidebar({
  collapsed,
  onToggleCollapse,
  mobileOpen,
  onCloseMobile,
}: {
  collapsed: boolean;
  onToggleCollapse: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const pathname = usePathname();
  const { state } = useMission();

  const onOverview = pathname === "/";
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
        className={`app-sidebar ${collapsed ? "is-collapsed" : ""} ${mobileOpen ? "is-mobile-open" : ""}`}
        aria-label="Primary"
      >
        <div className="sidebar-top">
          <Link
            href="/"
            className="sidebar-brand"
            onClick={onCloseMobile}
            title="Mission Control"
          >
            <span className="brand-mark">MC</span>
            {!collapsed ? <span className="sidebar-brand-text">Mission Control</span> : null}
          </Link>
        </div>

        <nav className="sidebar-nav">
          <Link
            href="/"
            className={`sidebar-link ${onOverview ? "is-active" : ""}`}
            onClick={onCloseMobile}
          >
            <span className="sidebar-ico" aria-hidden>
              ⌂
            </span>
            {!collapsed ? <span>Mission Control</span> : null}
          </Link>

          <p className="sidebar-label">{collapsed ? "P" : "Projects"}</p>
          {state.projects.map((project) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              title={project.name}
              className={`sidebar-link ${activeProjectId === project.id ? "is-active" : ""}`}
              onClick={onCloseMobile}
            >
              <span
                className={`status-dot status-${project.status}`}
                aria-hidden
              />
              {!collapsed ? <span className="truncate">{project.code}</span> : null}
            </Link>
          ))}
          <Link
            href="/projects/new"
            className={`sidebar-link ${onNew ? "is-active" : ""}`}
            onClick={onCloseMobile}
          >
            <span className="sidebar-ico" aria-hidden>
              +
            </span>
            {!collapsed ? <span>New Project</span> : null}
          </Link>

          <p className="sidebar-label">{collapsed ? "·" : "Workspace"}</p>
          <Link
            href="/memory"
            className={`sidebar-link ${pathname.startsWith("/memory") ? "is-active" : ""}`}
            onClick={onCloseMobile}
          >
            <span className="sidebar-ico" aria-hidden>
              ⌗
            </span>
            {!collapsed ? <span>Knowledge</span> : null}
          </Link>
          <Link
            href="/releases"
            className={`sidebar-link ${pathname.startsWith("/releases") ? "is-active" : ""}`}
            onClick={onCloseMobile}
            title="Timeline & releases"
          >
            <span className="sidebar-ico" aria-hidden>
              ⧉
            </span>
            {!collapsed ? <span>Timeline</span> : null}
          </Link>
        </nav>

        <div className="sidebar-bottom">
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
