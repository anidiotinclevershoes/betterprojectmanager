"use client";

import { AppearanceToggle } from "@/components/app-shell/AppearanceToggle";

export function TopHeader({
  title,
  subtitle,
  onOpenCoach,
  onOpenMobileNav,
  userName,
  onSignOut,
}: {
  title: string;
  subtitle?: string;
  onOpenCoach: () => void;
  onOpenMobileNav: () => void;
  userName?: string | null;
  onSignOut?: () => void;
}) {
  return (
    <header className="top-header">
      <div className="top-header-left">
        <button
          type="button"
          className="icon-btn mobile-nav-btn"
          aria-label="Open navigation"
          onClick={onOpenMobileNav}
        >
          ☰
        </button>
        <div className="min-w-0">
          <h1 className="page-title">{title}</h1>
          {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
        </div>
      </div>

      <div className="top-header-right">
        <label className="header-search">
          <span className="sr-only">Search</span>
          <input type="search" placeholder="Search…" disabled title="Coming soon" />
        </label>
        <AppearanceToggle />
        <button type="button" className="primary-btn coach-trigger" onClick={onOpenCoach}>
          Coach
        </button>
        {userName ? (
          <div className="header-user">
            <span className="header-user-name">{userName}</span>
            {onSignOut ? (
              <button type="button" className="ghost-btn" onClick={onSignOut}>
                Sign out
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}
