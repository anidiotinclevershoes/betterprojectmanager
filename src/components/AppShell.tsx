"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/app-shell/Sidebar";
import { TopHeader } from "@/components/app-shell/TopHeader";
import { CoachDrawer } from "@/components/coach/CoachDrawer";
import { useMission } from "@/lib/store";

const SIDEBAR_KEY = "mc-sidebar-collapsed-v1";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { state } = useMission();
  const [coachOpen, setCoachOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<{ email: string; name: string } | null>(
    null,
  );

  const onLogin = pathname === "/login";

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(SIDEBAR_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (onLogin) return;
    let cancelled = false;
    fetch("/api/auth/me")
      .then((res) => res.json())
      .then(
        (data: {
          user?: { email: string; name: string } | null;
        }) => {
          if (!cancelled) setUser(data.user ?? null);
        },
      )
      .catch(() => {
        if (!cancelled) setUser(null);
      });
    return () => {
      cancelled = true;
    };
  }, [onLogin, pathname]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.replace("/login");
    router.refresh();
  }

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const header = useMemo(() => {
    if (pathname === "/") {
      return {
        title: "Mission Control",
        subtitle: "What needs attention across your projects",
      };
    }
    if (pathname.startsWith("/memory")) {
      return { title: "Knowledge", subtitle: "Organisational and project memory" };
    }
    if (pathname.startsWith("/releases")) {
      return { title: "Timeline", subtitle: "Milestones, releases and dated work" };
    }
    if (pathname.startsWith("/meetings")) {
      return { title: "Meetings", subtitle: "Briefs and preparation" };
    }
    if (pathname === "/projects/new") {
      return { title: "New project", subtitle: "Create a workspace" };
    }
    const match = pathname.match(/^\/projects\/([^/]+)/);
    if (match?.[1]) {
      const project = state.projects.find((p) => p.id === match[1]);
      if (project) {
        return {
          title: project.code,
          subtitle: project.name,
        };
      }
    }
    return { title: "Mission Control", subtitle: undefined };
  }, [pathname, state.projects]);

  if (onLogin) {
    return <>{children}</>;
  }

  return (
    <div
      className={`app-shell ${collapsed ? "sidebar-collapsed" : ""} ${coachOpen ? "coach-open" : ""}`}
    >
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="app-main">
        <TopHeader
          title={header.title}
          subtitle={header.subtitle}
          onOpenCoach={() => setCoachOpen(true)}
          onOpenMobileNav={() => setMobileOpen(true)}
          userName={user?.name}
          onSignOut={() => void signOut()}
        />
        <main className="app-content">{children}</main>
      </div>

      <CoachDrawer open={coachOpen} onClose={() => setCoachOpen(false)} />
    </div>
  );
}
