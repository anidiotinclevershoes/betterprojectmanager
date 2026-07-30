"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LumeLogo } from "@/components/brand/LumeLogo";
import {
  attentionLabel,
  projectAttentionCount,
} from "@/lib/workspace/attention";
import { useMission } from "@/lib/store";

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
            title="Lume Overview"
          >
            <LumeLogo size={22} className="lume-logo" />
            {!collapsed ? (
              <span className="sidebar-brand-text-wrap">
                <span className="sidebar-brand-text">Lume</span>
                <span className="sidebar-tagline">Lighting your way.</span>
              </span>
            ) : null}
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
            {!collapsed ? <span>Lume Overview</span> : null}
          </Link>

          <p className="sidebar-label">{collapsed ? "P" : "Projects"}</p>
          {state.projects.map((project) => {
            const count = projectAttentionCount(state, project.id);
            return (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                title={`${project.name} — ${attentionLabel(count)}`}
                className={`sidebar-link sidebar-project ${activeProjectId === project.id ? "is-active" : ""}`}
                onClick={onCloseMobile}
              >
                {!collapsed ? (
                  <span className="sidebar-project-meta">
                    <span className="truncate font-semibold">{project.code}</span>
                    <span className="sidebar-attention">
                      {attentionLabel(count)}
                    </span>
                  </span>
                ) : (
                  <span className="sidebar-ico truncate">{project.code.slice(0, 1)}</span>
                )}
              </Link>
            );
          })}
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
              #
            </span>
            {!collapsed ? <span>Knowledge</span> : null}
          </Link>
          <Link
            href="/history"
            className={`sidebar-link ${pathname.startsWith("/history") ? "is-active" : ""}`}
            onClick={onCloseMobile}
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
            title="Capture sessions"
          >
            <span className="sidebar-ico" aria-hidden>
              ⎚
            </span>
            {!collapsed ? <span>Captures</span> : null}
          </Link>
          <Link
            href="/coaching"
            className={`sidebar-link ${pathname.startsWith("/coaching") ? "is-active" : ""}`}
            onClick={onCloseMobile}
            title="Coach sessions"
          >
            <span className="sidebar-ico" aria-hidden>
              ✶
            </span>
            {!collapsed ? <span>Coaching</span> : null}
          </Link>
          {process.env.NODE_ENV === "development" ? (
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
          ) : null}
        </nav>

        <div className="sidebar-bottom">
          {userName && !collapsed ? (
            <p className="sidebar-user">{userName}</p>
          ) : null}
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
