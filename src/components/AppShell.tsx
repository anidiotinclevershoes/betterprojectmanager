"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { CoachBanner, CoachButton } from "@/components/CoachButton";
import { useMission } from "@/lib/store";

const TOOL_NAV = [
  { href: "/meetings", label: "Meetings" },
  { href: "/memory", label: "Memory" },
  { href: "/releases", label: "Releases" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { state } = useMission();
  const [coachOpen, setCoachOpen] = useState(false);
  const [user, setUser] = useState<{ email: string; name: string } | null>(
    null,
  );

  const onLogin = pathname === "/login";

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

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    router.replace("/login");
    router.refresh();
  }

  if (onLogin) {
    return <>{children}</>;
  }

  const projectMatch = pathname.match(/^\/projects\/([^/]+)/);
  const routeProjectId = projectMatch?.[1] ?? null;
  const onNewProject = routeProjectId === "new";
  const activeProjectId =
    routeProjectId && routeProjectId !== "new" ? routeProjectId : null;
  const onOverview = pathname === "/";

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 md:px-6">
          <Link href="/" className="flex shrink-0 items-baseline gap-2">
            <span className="brand-mark text-lg font-extrabold tracking-tight md:text-xl">
              Mission Control
            </span>
            <span className="hidden text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-soft sm:inline">
              CPO
            </span>
          </Link>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <CoachButton open={coachOpen} onOpenChange={setCoachOpen} />
            <nav className="flex flex-wrap items-center justify-end gap-1 text-sm">
              {TOOL_NAV.map((item) => {
                const active = pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`rounded-lg px-2.5 py-1.5 transition-colors md:px-3 ${
                      active
                        ? "bg-ink text-paper"
                        : "text-ink-soft hover:bg-mist hover:text-ink"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            {user ? (
              <div className="flex items-center gap-2 border-l border-line pl-2">
                <span className="hidden max-w-[10rem] truncate text-xs text-ink-soft sm:inline">
                  {user.name}
                </span>
                <button
                  type="button"
                  className="muted-btn"
                  onClick={() => void signOut()}
                >
                  Sign out
                </button>
              </div>
            ) : null}
          </div>
        </div>

        <div className="border-t border-line bg-paper">
          <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 md:px-6">
            <ProjectTab href="/" label="Overview" active={onOverview} />
            {state.projects.map((project) => (
              <ProjectTab
                key={project.id}
                href={`/projects/${project.id}`}
                label={project.code}
                subtitle={project.name}
                active={activeProjectId === project.id}
                status={project.status}
              />
            ))}
            <ProjectTab
              href="/projects/new"
              label="+ New"
              subtitle="Create a project"
              active={onNewProject}
            />
          </div>
        </div>

        <CoachBanner open={coachOpen} onOpenChange={setCoachOpen} />
      </header>

      <main className="mx-auto max-w-7xl px-3 py-3 md:px-5 md:py-4">
        {children}
      </main>
    </div>
  );
}

function ProjectTab({
  href,
  label,
  subtitle,
  active,
  status,
}: {
  href: string;
  label: string;
  subtitle?: string;
  active: boolean;
  status?: "healthy" | "watch" | "at_risk";
}) {
  return (
    <Link
      href={href}
      title={subtitle}
      className={`relative flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-sm transition-colors md:px-4 ${
        active
          ? "border-teal text-ink"
          : "border-transparent text-ink-soft hover:text-ink"
      }`}
    >
      {status ? (
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            status === "at_risk"
              ? "bg-signal"
              : status === "watch"
                ? "bg-amber-500"
                : "bg-teal"
          }`}
          aria-hidden
        />
      ) : null}
      <span className={`font-semibold ${active ? "text-ink" : ""}`}>
        {label}
      </span>
    </Link>
  );
}
