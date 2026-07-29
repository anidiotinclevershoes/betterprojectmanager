"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/app-shell/Sidebar";
import { TopHeader } from "@/components/app-shell/TopHeader";
import { CaptureSessionProvider } from "@/components/capture/CaptureSessionContext";
import { CoachDrawer } from "@/components/coach/CoachDrawer";
import { CoachResultsCard } from "@/components/coach/CoachResultsCard";
import {
  CoachSessionProvider,
  useCoachSession,
} from "@/components/coach/CoachSessionContext";
import { useMission } from "@/lib/store";
import { MISSION_MESSAGE } from "@/lib/mission";

const SIDEBAR_KEY = "mc-sidebar-collapsed-v1";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <CaptureSessionProvider>
      <CoachSessionProvider>
        <AppShellInner>{children}</AppShellInner>
      </CoachSessionProvider>
    </CaptureSessionProvider>
  );
}

function AppShellInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { state } = useMission();
  const { drawerOpen, openDrawer } = useCoachSession();
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

  useEffect(() => {
    const open = () => openDrawer();
    window.addEventListener("lume:open-coach", open);
    return () => window.removeEventListener("lume:open-coach", open);
  }, [openDrawer]);

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
        title: "Lume Overview",
        subtitle: MISSION_MESSAGE,
      };
    }
    if (pathname.startsWith("/memory")) {
      return { title: "Knowledge", subtitle: "Organisational and project memory" };
    }
    if (pathname.startsWith("/history")) {
      return { title: "History", subtitle: "Everything that happened in Lume" };
    }
    if (pathname.startsWith("/captures")) {
      return {
        title: "Captures",
        subtitle: "Previous Capture sessions",
      };
    }
    if (pathname.startsWith("/coaching")) {
      return {
        title: "Coaching",
        subtitle: "Previous Coach sessions",
      };
    }
    if (pathname.startsWith("/meetings")) {
      return { title: "Meetings", subtitle: "Briefs and preparation" };
    }
    if (pathname === "/projects/new") {
      return { title: "New project", subtitle: "Guided setup or interview wizard" };
    }
    if (pathname.startsWith("/releases")) {
      return { title: "Release playbook", subtitle: "Release stages and risks" };
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
    return { title: "Lume", subtitle: undefined };
  }, [pathname, state.projects]);

  if (onLogin) {
    return <>{children}</>;
  }

  return (
    <div
      className={`app-shell ${collapsed ? "sidebar-collapsed" : ""} ${drawerOpen ? "coach-open" : ""}`}
    >
      <Sidebar
        collapsed={collapsed}
        onToggleCollapse={toggleCollapse}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
        userName={user?.name}
      />

      <div className="app-main">
        <TopHeader
          title={header.title}
          subtitle={header.subtitle}
          onOpenMobileNav={() => setMobileOpen(true)}
          userName={user?.name}
          onSignOut={() => void signOut()}
        />
        <main className="app-content">
          <div className="mb-4">
            <CoachResultsCard />
          </div>
          {children}
        </main>
      </div>

      <CoachDrawer />
    </div>
  );
}

export function openCoachDrawer() {
  window.dispatchEvent(new Event("lume:open-coach"));
}
