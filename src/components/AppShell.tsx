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
import { TellMePanel } from "@/components/tell-me/TellMePanel";
import { TellMeSessionProvider } from "@/components/tell-me/TellMeSessionContext";
import { EntitlementGate } from "@/components/billing/EntitlementGate";
import { clearAuthenticatedBrowserState } from "@/lib/session-cleanup";
import { useMission } from "@/lib/store";
import { MISSION_MESSAGE } from "@/lib/mission";

const SIDEBAR_KEY = "mc-sidebar-collapsed-v1";

function isAuthChromePath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname === "/account"
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <CaptureSessionProvider>
      <CoachSessionProvider>
        <AppShellWithTellMe>{children}</AppShellWithTellMe>
      </CoachSessionProvider>
    </CaptureSessionProvider>
  );
}

function AppShellWithTellMe({ children }: { children: ReactNode }) {
  const [userName, setUserName] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/auth/me");
        const data = (await res.json()) as {
          user?: { name?: string } | null;
        };
        if (!cancelled) setUserName(data.user?.name ?? null);
      } catch {
        if (!cancelled) setUserName(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <TellMeSessionProvider userDisplayName={userName}>
      <AppShellInner>{children}</AppShellInner>
      <TellMePanel />
    </TellMeSessionProvider>
  );
}

function AppShellInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { state } = useMission();
  const { drawerOpen, openDrawer } = useCoachSession();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<{
    email: string;
    name: string;
  } | null>(null);

  const onAuthPage = isAuthChromePath(pathname);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(SIDEBAR_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (onAuthPage) return;
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
  }, [onAuthPage, pathname]);

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
    clearAuthenticatedBrowserState();
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
    if (
      process.env.NODE_ENV === "development" &&
      pathname.startsWith("/dev/golden-test")
    ) {
      return {
        title: "Golden Test",
        subtitle: "Development capture scenario checker",
      };
    }
    if (
      process.env.NODE_ENV === "development" &&
      pathname.startsWith("/dev/ai-cockpit")
    ) {
      return {
        title: "AI Cockpit",
        subtitle: "Measured Capture health and prompt evolution",
      };
    }
    if (pathname.startsWith("/meetings")) {
      return { title: "Meetings", subtitle: "Briefs and preparation" };
    }
    if (pathname === "/projects/new") {
      return {
        title: "New project",
        subtitle: "Tell Lume what you know — then review before creating",
      };
    }
    if (pathname.startsWith("/releases")) {
      return { title: "Release playbook", subtitle: "Release stages and risks" };
    }
    const match = pathname.match(/^\/projects\/([^/]+)/);
    if (match?.[1] && match[1] !== "new") {
      // Project identity lives below Capture — do not announce it in the top chrome.
      return {
        title: "",
        subtitle: undefined,
      };
    }
    return { title: "Lume", subtitle: undefined };
  }, [pathname, state.projects]);

  if (onAuthPage) {
    return <>{children}</>;
  }

  const projectMatch = pathname.match(/^\/projects\/([^/]+)/);
  const routeId = projectMatch?.[1] ?? null;
  const activeProjectId = routeId && routeId !== "new" ? routeId : null;
  const activeProject = activeProjectId
    ? state.projects.find((p) => p.id === activeProjectId)
    : null;

  return (
    <div
      className={`app-shell ${collapsed ? "sidebar-collapsed" : ""} ${drawerOpen ? "coach-open" : ""} ${activeProject ? "has-project-workspace" : ""}`}
      data-active-project={activeProject?.code ?? undefined}
      data-project-status={activeProject?.status ?? undefined}
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
          userEmail={user?.email}
          onSignOut={() => void signOut()}
          quiet={!header.title}
        />
        <main className="app-content">
          <div className="mb-4">
            <CoachResultsCard />
          </div>
          <EntitlementGate>{children}</EntitlementGate>
        </main>
      </div>

      <CoachDrawer />
    </div>
  );
}

export function openCoachDrawer() {
  window.dispatchEvent(new Event("lume:open-coach"));
}
