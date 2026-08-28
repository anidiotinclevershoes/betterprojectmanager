"use client";

import { useState } from "react";
import { CatchMeUpPanel } from "@/components/catch-me-up/CatchMeUpPanel";
import { CaptureWorkspace } from "@/components/capture/CaptureWorkspace";
import { DeleteProjectButton } from "@/components/knowledge-centre/DeleteProjectButton";
import { KnowledgeSearchAskBar } from "@/components/knowledge-centre/KnowledgeSearchAskBar";
import { OceanKnowledgeFrames } from "@/components/knowledge-centre/OceanKnowledgeFrames";
import { ProjectIntelligenceStrip } from "@/components/knowledge-centre/ProjectIntelligenceStrip";
import {
  ProjectModeSelector,
  type OceanProjectMode,
} from "@/components/knowledge-centre/ProjectModeSelector";
import type { Project } from "@/lib/types";

/**
 * Ocean V1 selected-project workspace.
 * Capture, Knowledge Centre, and Catch Me Up are modes of one shell.
 */
export function OceanProjectWorkspace({ project }: { project: Project }) {
  const [mode, setMode] = useState<OceanProjectMode>("knowledge");

  return (
    <div
      className="ocean-project-workspace"
      data-testid="ocean-project-workspace"
      data-project-id={project.id}
      data-project-mode={mode}
    >
      <ProjectIntelligenceStrip projectId={project.id} />

      <header className="ocean-project-header">
        <div className="ocean-project-identity">
          <h1 className="ocean-project-title">{project.name}</h1>
          <p className="ocean-project-subtitle">
            {project.currentFocus?.trim() ||
              project.summary?.trim() ||
              "Project intelligence at a glance."}
          </p>
          <DeleteProjectButton project={project} />
        </div>
      </header>

      <ProjectModeSelector mode={mode} onChange={setMode} />

      {mode === "knowledge" ? (
        <div
          className="ocean-knowledge-centre"
          data-testid="ocean-knowledge-centre"
        >
          <KnowledgeSearchAskBar projectId={project.id} />
          <OceanKnowledgeFrames projectId={project.id} />
        </div>
      ) : null}

      {mode === "capture" ? (
        <div
          className="ocean-capture-mode is-active"
          data-testid="ocean-capture-mode"
          data-mode="capture"
        >
          <CaptureWorkspace
            defaultProjectId={project.id}
            variant="ocean"
          />
        </div>
      ) : null}

      {mode === "catch-me-up" ? (
        <div
          className="ocean-catch-me-up-mode"
          data-testid="ocean-catch-me-up-mode"
          data-mode="catch-me-up"
        >
          <CatchMeUpPanel projectId={project.id} />
        </div>
      ) : null}

      {mode === "advise" ? (
        <div
          className="ocean-advise-soon"
          data-testid="ocean-advise-soon"
        >
          <p>Advise is coming soon.</p>
        </div>
      ) : null}
    </div>
  );
}
