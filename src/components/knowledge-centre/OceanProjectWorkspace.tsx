"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { CaptureWorkspace } from "@/components/capture/CaptureWorkspace";
import { HomeWorkspace } from "@/components/home/HomeWorkspace";
import { ProjectScanPanel } from "@/components/home/ProjectScanPanel";
import { DeleteProjectButton } from "@/components/knowledge-centre/DeleteProjectButton";
import { KnowledgeSearchAskBar } from "@/components/knowledge-centre/KnowledgeSearchAskBar";
import { OceanKnowledgeFrames } from "@/components/knowledge-centre/OceanKnowledgeFrames";
import { ProjectIntelligenceStrip } from "@/components/knowledge-centre/ProjectIntelligenceStrip";
import {
  ProjectModeSelector,
  type OceanProjectMode,
} from "@/components/knowledge-centre/ProjectModeSelector";
import type { Project } from "@/lib/types";
import "@/components/home/home-workspace.css";

const MODES: OceanProjectMode[] = ["home", "capture", "knowledge", "scan"];

function initialMode(raw: string | null): OceanProjectMode {
  if (raw && MODES.includes(raw as OceanProjectMode)) {
    return raw as OceanProjectMode;
  }
  return "home";
}

/**
 * Selected-project workspace.
 * Home is the resting mode. Capture, Knowledge Centre, and Project Scan
 * replace it in the same shell. The component remounts per project id.
 */
export function OceanProjectWorkspace({ project }: { project: Project }) {
  const search = useSearchParams();
  const [mode, setMode] = useState<OceanProjectMode>(() =>
    initialMode(search.get("mode")),
  );
  const [kcQuery, setKcQuery] = useState("");

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

      {mode === "home" ? (
        <HomeWorkspace projectId={project.id} />
      ) : null}

      {mode === "knowledge" ? (
        <div
          className="ocean-knowledge-centre"
          data-testid="ocean-knowledge-centre"
        >
          <h2 className="kc-heading">Knowledge Centre</h2>
          <KnowledgeSearchAskBar
            projectId={project.id}
            search={kcQuery}
            onSearchChange={setKcQuery}
          />
          <OceanKnowledgeFrames
            projectId={project.id}
            searchQuery={kcQuery}
          />
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

      {mode === "scan" ? (
        <ProjectScanPanel projectId={project.id} />
      ) : null}
    </div>
  );
}
