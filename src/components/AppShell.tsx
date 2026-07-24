"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const NAV = [
  { href: "/", label: "Today" },
  { href: "/capture", label: "Capture" },
  { href: "/meetings", label: "Meetings" },
  { href: "/memory", label: "Memory" },
  { href: "/releases", label: "Releases" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <div className="relative min-h-screen">
      <div className="pointer-events-none absolute inset-0 atmosphere-grid" />
      <header
        className={`relative z-20 border-b border-line/60 ${isHome ? "bg-transparent" : "bg-paper/70 backdrop-blur-md"}`}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 md:px-8">
          <Link href="/" className="group flex items-baseline gap-2">
            <span className="brand-mark text-xl font-extrabold tracking-tight text-ink md:text-2xl">
              Mission Control
            </span>
            <span className="hidden text-xs uppercase tracking-[0.18em] text-ink-soft sm:inline">
              CPO
            </span>
          </Link>
          <nav className="flex flex-wrap items-center justify-end gap-1 text-sm md:gap-2">
            {NAV.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-md px-2.5 py-1.5 transition-colors md:px-3 ${
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
        </div>
      </header>
      <main className="relative z-10">{children}</main>
    </div>
  );
}
