"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { LumeLogo } from "@/components/brand/LumeLogo";
import "./auth-first-run.css";

export function AuthShell({
  title,
  lede,
  children,
  footer,
}: {
  title: string;
  lede?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="login-page auth-page">
      <div className="login-card auth-card">
        <div className="auth-brand">
          <LumeLogo size={28} className="auth-brand-logo" />
          <p className="auth-brand-name">lume</p>
        </div>
        <h1>{title}</h1>
        {lede ? <p className="lede">{lede}</p> : null}
        {children}
        {footer ? <div className="auth-footer">{footer}</div> : null}
        <p className="auth-legal">
          <Link href="/privacy" className="auth-text-link">
            Privacy
          </Link>
          <span aria-hidden="true"> · </span>
          <Link href="/terms" className="auth-text-link">
            Terms
          </Link>
          <span aria-hidden="true"> · </span>
          <Link href="/support" className="auth-text-link">
            Support
          </Link>
        </p>
      </div>
    </div>
  );
}

export function AuthLinkRow({ children }: { children: ReactNode }) {
  return <p className="auth-links">{children}</p>;
}

export function AuthNavLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className="auth-text-link">
      {children}
    </Link>
  );
}
