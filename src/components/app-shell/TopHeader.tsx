"use client";

import { AppearanceToggle } from "@/components/app-shell/AppearanceToggle";
import { HeaderCoachButton } from "@/components/coach/HeaderCoachButton";

export function TopHeader({
  title,
  subtitle,
  onOpenMobileNav,
  userName,
  onSignOut,
  quiet = false,
}: {
  title: string;
  subtitle?: string;
  onOpenMobileNav: () => void;
  userName?: string | null;
  onSignOut?: () => void;
  /** Hide page title block (project pages place identity below Capture). */
  quiet?: boolean;
}) {
  return (
    <header className={`top-header ${quiet ? "is-quiet" : ""}`}>
      <div className="top-header-left">
        <button
          type="button"
          className="icon-btn mobile-nav-btn"
          aria-label="Open navigation"
          onClick={onOpenMobileNav}
        >
          ☰
        </button>
        {!quiet && title ? (
          <div className="min-w-0">
            <h1 className="page-title">{title}</h1>
            {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
          </div>
        ) : null}
      </div>

      <div className="top-header-right">
        <HeaderCoachButton />
        <AppearanceToggle />
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
