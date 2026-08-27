"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { FirstProjectGuidance } from "@/components/onboarding/FirstRunCue";
import { OceanProjectWorkspace } from "@/components/knowledge-centre/OceanProjectWorkspace";
import { useMission } from "@/lib/store";

export default function ProjectDashboardPage() {
  const params = useParams<{ id: string }>();
  const { state } = useMission();
  const project = state.projects.find((p) => p.id === params.id);

  if (!project) {
    return (
      <div className="workspace-frame p-6">
        <p className="empty-copy">Project not found.</p>
        <Link href="/todos" className="ghost-btn mt-2 inline-flex">
          ← Master To Do
        </Link>
      </div>
    );
  }

  return (
    <div
      className="workspace-page project-scroll ocean-project-page"
      data-project-id={project.id}
      data-project-code={project.code}
    >
      <FirstProjectGuidance />
      <OceanProjectWorkspace project={project} />
    </div>
  );
}
