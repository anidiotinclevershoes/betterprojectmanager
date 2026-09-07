"use client";

import { usePathname } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import {
  ANALYTICS_EVENTS,
  analyticsPathname,
  identifyAnalyticsUser,
  trackAnalyticsEvent,
} from "@/lib/analytics";

/**
 * Privacy-safe product analytics. No autocapture, no session replay.
 * Page views send pathname only — never query strings or project contents.
 */
export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data: { user?: { id?: string } | null }) => {
        if (cancelled) return;
        identifyAnalyticsUser(data.user?.id);
      })
      .catch(() => {
        /* ignore */
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  useEffect(() => {
    const path = analyticsPathname(pathname);
    trackAnalyticsEvent(ANALYTICS_EVENTS.page_viewed, { path });
  }, [pathname]);

  return <>{children}</>;
}
