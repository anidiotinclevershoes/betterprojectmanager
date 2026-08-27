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

    return (
      <div className="evals-shell">
        <main className="evals-main">
          <div className="evals-panel" role="alert">
            <p className="evals-kicker">Internal only</p>
            <h1 className="evals-title">Evals access denied</h1>
            <p className="evals-sub">{access.error}</p>
            {access.reason === "allowlist_empty" ? (
              <ol className="evals-notes">
                <li>
                  Vercel → Project → Settings → Environment Variables
                </li>
                <li>
                  Add <code>LUME_EVAL_ALLOWED_EMAILS</code> with the operator
                  email(s), for Production (and Preview if you use it)
                </li>
                <li>Redeploy the Production deployment</li>
                <li>
                  Sign in with an allowlisted email, then open{" "}
                  <code>/evals</code>
                </li>
              </ol>
            ) : null}
            {access.reason === "not_allowlisted" ? (
              <p className="evals-meta">
                Add your signed-in email to{" "}
                <code>LUME_EVAL_ALLOWED_EMAILS</code> in Vercel, redeploy, then
                retry.
              </p>
            ) : null}
            <p className="evals-meta">
              <Link href="/">← Back to Lume</Link>
            </p>
          </div>
        </main>
      </div>
    );
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
