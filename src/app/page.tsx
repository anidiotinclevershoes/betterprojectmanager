"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { NewProjectExperience } from "@/components/onboarding/NewProjectExperience";
import { useMission } from "@/lib/store";

/**
 * V1: no Overview dashboard. With projects, land on the first project's
 * Knowledge Centre. Zero projects keeps New Project onboarding.
 */
export default function HomePage() {
  const router = useRouter();
  const { hydrated, state, saveError, saveStatus, persistenceMode } = useMission();

  const hasCachedProjects = state.projects.length > 0;
  const zeroProjects = hydrated && state.projects.length === 0;
  const hydrateProblem =
    zeroProjects &&
    persistenceMode === "supabase" &&
    saveStatus === "error" &&
    Boolean(saveError);

  useEffect(() => {
    if (!hydrated && !hasCachedProjects) return;
    if (state.projects[0]?.id) {
      router.replace(`/projects/${state.projects[0].id}`);
    }
  }, [hydrated, hasCachedProjects, state.projects, router]);

  if (!hydrated && !hasCachedProjects) {
    return (
      <div className="workspace-page">
        <p className="empty-copy">Loading workspace…</p>
      </div>
    );
  }

  if (hydrateProblem) {
    return (
      <div className="workspace-page">
        <div className="login-card auth-card" role="alert">
          <p className="eyebrow">Workspace</p>
          <h1>Could not load your projects</h1>
          <p className="lede">{saveError}</p>
          <button
            type="button"
            className="primary-btn"
            onClick={() => window.location.reload()}
          >
            Refresh
          </button>
          <p className="empty-copy">
            Still stuck? <a href="/login">Sign in again</a>
          </p>
        </div>
      </div>
    );
  }

  if (zeroProjects) {
    return (
      <div className="workspace-page np-first-run-page">
        <NewProjectExperience variant="first-run" />
      </div>
    );
  }

  return (
    <div className="workspace-page">
      <p className="empty-copy">Opening Knowledge Centre…</p>
    </div>
  );
}
