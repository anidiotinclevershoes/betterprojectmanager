"use client";

import Link from "next/link";
import { LumeLogo } from "@/components/brand/LumeLogo";

export function TopHeader({
  title = "",
  subtitle,
  onOpenMobileNav,
  userName,
  userEmail,
  onSignOut,
  quiet = false,
  projectMobile = false,
  brandHref = "/",
}: {
  title?: string;
  subtitle?: string;
  onOpenMobileNav: () => void;
  userName?: string | null;
  userEmail?: string | null;
  onSignOut?: () => void;
  /** Hide page title block (project pages place identity below Capture). */
  quiet?: boolean;
  /**
   * Project routes below the sidebar breakpoint. Desktop project pages do not
   * lay this band out. Account stays in the sidebar.
   */
  projectMobile?: boolean;
  brandHref?: string;
}) {
  if (projectMobile) {
    return (
      <header
        className="top-header is-project-mobile"
        data-testid="ocean-project-mobile-header"
      >
        <div className="top-header-left">
          <button
            type="button"
            className="icon-btn mobile-nav-btn"
            aria-label="Open navigation"
            onClick={onOpenMobileNav}
          >
            ☰
          </button>
          <Link href={brandHref} className="ocean-mobile-brand">
            <LumeLogo size={18} className="lume-logo" />
            <span>Lume</span>
          </Link>
        </div>
      </header>
    );
  }

  return (
    <header
      className={`top-header ${quiet ? "is-quiet" : ""}`}
      data-testid="app-top-header"
    >
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
        {userName ? (
          <div className="header-user">
            <Link
              href="/account"
              className="header-user-name"
              title={userEmail || userName}
            >
              {userName}
            </Link>
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
