"use client";

import { useState } from "react";
import { AddItemDrawer } from "@/components/knowledge-centre/AddItemDrawer";
import { CaptureWorkspace } from "@/components/capture/CaptureWorkspace";
import { KnowledgeItemDetailDrawer } from "@/components/knowledge-centre/KnowledgeItemDetailDrawer";
import { KnowledgeSearchAskBar } from "@/components/knowledge-centre/KnowledgeSearchAskBar";
import { OceanHomeProjection } from "@/components/knowledge-centre/OceanHomeProjection";
import { OceanKnowledgeFrames } from "@/components/knowledge-centre/OceanKnowledgeFrames";
import {
  ProjectModeSelector,
  type OceanProjectMode,
} from "@/components/knowledge-centre/ProjectModeSelector";
import { ProjectScanView } from "@/components/knowledge-centre/ProjectScanView";
import { ProjectWorkspaceHeader } from "@/components/knowledge-centre/ProjectWorkspaceHeader";
import { SuggestionAddModal } from "@/components/knowledge-centre/SuggestionAddModal";
import type { KnowledgeItemRef } from "@/lib/knowledge-centre/knowledge-item-detail";
import type { Project } from "@/lib/types";

/**
 * Approved workspace: Home is default. Capture / KC / Scan expand over Home.
 * Catch Me Up stays a derived briefing, not a tab.
 */
export function OceanProjectWorkspace({ project }: { project: Project }) {
  const [mode, setMode] = useState<OceanProjectMode>("home");
  const [kcQuery, setKcQuery] = useState("");
  const [selected, setSelected] = useState<KnowledgeItemRef | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [suggestionId, setSuggestionId] = useState<string | null>(null);

  function selectMode(next: OceanProjectMode) {
    setMode(next);
    setSelected(null);
  }

  return (
    <div
      className="ocean-project-workspace"
      data-testid="ocean-project-workspace"
      data-project-id={project.id}
      data-project-mode={mode}
    >
      <ProjectWorkspaceHeader project={project} />
      <ProjectModeSelector mode={mode} onChange={selectMode} />

      {mode === "knowledge" ? (
        <div
          className="ocean-expanded-mode"
          data-testid="ocean-knowledge-centre"
        >
          <div className="ocean-kc-toolbar">
            <h2 className="kc-heading">Knowledge Centre</h2>
            <button
              type="button"
              className="primary-btn"
              data-testid="ocean-add-item"
              onClick={() => setAddOpen(true)}
            >
              + Add item
            </button>
          </div>
          <KnowledgeSearchAskBar
            projectId={project.id}
            search={kcQuery}
            onSearchChange={setKcQuery}
          />
          <OceanKnowledgeFrames
            projectId={project.id}
            searchQuery={kcQuery}
            selected={selected}
            onSelect={setSelected}
          />
        </div>
      ) : null}

      {mode === "capture" ? (
        <div
          className="ocean-capture-mode is-active ocean-expanded-mode"
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
        <div className="ocean-expanded-mode" data-testid="ocean-scan-mode">
          <ProjectScanView
            projectId={project.id}
            onOpenDetails={setSelected}
          />
        </div>
      ) : null}

      <OceanHomeProjection
        projectId={project.id}
        onOpenDetails={setSelected}
        onAddSuggestion={setSuggestionId}
      />

      <KnowledgeItemDetailDrawer
        projectId={project.id}
        selected={selected}
        onClose={() => setSelected(null)}
      />
      <AddItemDrawer
        projectId={project.id}
        open={addOpen}
        onClose={() => setAddOpen(false)}
      />
      <SuggestionAddModal
        recommendationId={suggestionId}
        onClose={() => setSuggestionId(null)}
      />
    </div>
  );
}
