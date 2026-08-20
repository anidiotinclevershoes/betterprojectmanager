"use client";

import { useState } from "react";
import { CaptureWorkspace } from "@/components/capture/CaptureWorkspace";
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
 * Knowledge Centre is the default central mode.
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
        </div>
        <ProjectModeSelector mode={mode} onChange={setMode} />
      </header>

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
          className="ocean-capture-mode"
          data-testid="ocean-capture-mode"
        >
          <CaptureWorkspace defaultProjectId={project.id} />
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
