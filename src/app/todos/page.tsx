"use client";

import { TodoFrame } from "@/components/frames/TodoFrame";
import { WorkspaceFrame } from "@/components/workspace/WorkspaceFrame";
import { useMission } from "@/lib/store";

/**
 * Cross-project Master To Do — Ocean V1 sidebar destination.
 * Does not redesign TodoFrame behaviour.
 */
export default function MasterTodoPage() {
  const { hydrated, state } = useMission();

  if (!hydrated && state.projects.length === 0) {
    return (
      <div className="workspace-page">
        <p className="empty-copy">Loading workspace…</p>
      </div>
    );
  }

  return (
    <div className="workspace-page ocean-master-todo" data-testid="ocean-master-todo">
      <header className="ocean-utility-header">
        <h1>Master To Do</h1>
        <p className="ocean-utility-lede">
          Open actions across your projects.
        </p>
      </header>
      <WorkspaceFrame type="todo" title="To Do">
        <TodoFrame size="wide" />
      </WorkspaceFrame>
    </div>
  );
}
