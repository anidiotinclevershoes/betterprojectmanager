import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { requireEvalAccess } from "@/lib/evals/access";
import Link from "next/link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function EvalsLayout({
  children,
}: {
  children: ReactNode;
}) {
  const access = await requireEvalAccess();
  if (!access.ok) {
    if (access.status === 401) {
      redirect(`/login?next=${encodeURIComponent("/evals")}`);
    }
    redirect("/");
  }

  return (
    <div className="evals-shell">
      <header className="evals-topbar">
        <div className="evals-topbar-brand">
          <p className="evals-kicker">Internal only</p>
          <h1 className="evals-title">
            <Link href="/evals">Lume Intelligence Evaluation</Link>
          </h1>
          <p className="evals-sub">
            Signed in as {access.email} · Benchmark regression environment
          </p>
        </div>
        <nav className="evals-nav" aria-label="Evaluation">
          <Link href="/evals">Home</Link>
          <Link href="/evals/worlds">Project Worlds</Link>
          <Link href="/evals/runs">Run history</Link>
          <Link href="/evals/compare">Compare</Link>
          <Link href="/">← Back to Lume</Link>
        </nav>
      </header>
      <main className="evals-main">{children}</main>
    </div>
  );
}
