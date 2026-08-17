"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Nav entry shown only when server allowlist grants eval access. */
export function EvalsNavLink({
  collapsed,
  onNavigate,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/evals/access")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { allowed?: boolean } | null) => {
        if (!cancelled) setAllowed(Boolean(data?.allowed));
      })
      .catch(() => {
        if (!cancelled) setAllowed(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!allowed) return null;

  return (
    <Link
      href="/evals"
      className={`sidebar-link ${pathname.startsWith("/evals") ? "is-active" : ""}`}
      onClick={onNavigate}
      title="Intelligence evaluations (internal)"
    >
      <span className="sidebar-ico" aria-hidden>
        ▦
      </span>
      {!collapsed ? <span>Evals</span> : null}
    </Link>
  );
}
