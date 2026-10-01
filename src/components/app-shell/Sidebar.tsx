"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LumeLogo } from "@/components/brand/LumeLogo";
import { useMission } from "@/lib/store";

/**
 * Page 09 / Page 07 desktop sidebar (`P09/Shell/Sidebar`, 900px `601:836`).
 * Brand is the signed lightbulb plus plain “Lume”. The stale Page 09 `me`
 * treatment is not recreated.
 *
 * BLOCKED — PRODUCT SURFACE: signed sidebar requires Settings, but no Settings
 * route/surface exists. Account is the last mounted row until that exists.
 */
export function Sidebar({
  mobileOpen,
  onCloseMobile,
  userName,
}: {
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
  const accountTitle = userName?.trim() || "Account";

  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={onCloseMobile}
          data-testid="ocean-sidebar-backdrop"
        />
      ) : null}
      <aside
        className={`app-sidebar ocean-sidebar${mobileOpen ? " is-mobile-open" : ""}`}
        aria-label="Primary"
        data-testid="ocean-sidebar"
      >
        <div className="sidebar-top">
          <Link
            href={state.projects[0] ? `/projects/${state.projects[0].id}` : "/"}
            className="sidebar-brand ocean-brand"
            onClick={onCloseMobile}
            title="Lume"
            data-testid="ocean-wordmark"
          >
            <LumeLogo size={18} className="lume-logo ocean-brand-bulb" />
            <span className="ocean-brand-name">Lume</span>
          </Link>
        </div>

        <Link
          href="/projects/new"
          className={`ocean-new-project${onNew ? " is-active" : ""}`}
          onClick={onCloseMobile}
          data-testid="ocean-new-project"
        >
          + New project
        </Link>

        <nav className="ocean-sidebar-projects" data-testid="ocean-sidebar-nav">
          {state.projects.map((project) => {
            const active = activeProjectId === project.id;
            return (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                title={project.name}
                className={`ocean-project-link${active ? " is-active" : ""}`}
                aria-current={active ? "page" : undefined}
                onClick={onCloseMobile}
                data-testid={`ocean-project-link-${project.id}`}
              >
                <span>{project.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="sidebar-bottom ocean-sidebar-bottom">
          <Link
            href="/account"
            className="ocean-account-row"
            onClick={onCloseMobile}
            title={accountTitle}
            data-testid="ocean-nav-account"
          >
            <span className="ocean-account-mark" aria-hidden>
              •
            </span>
            <span>Account</span>
          </Link>
        </div>
      </aside>
    </>
  );
}
