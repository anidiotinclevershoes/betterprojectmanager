export type FrameSize = "compact" | "standard" | "wide" | "full";

export type WorkspaceFrameConfig = {
  id: string;
  type: "todo" | "meetingPrep" | "risks" | "timeline" | "nudge";
  title?: string;
  visible: boolean;
  order: number;
  size: FrameSize;
  projectScope?: string | null;
  settings?: Record<string, unknown>;
};

export type WorkspaceLayout = {
  frames: WorkspaceFrameConfig[];
};

/**
 * Default frames — Nudge Me retired from the visible workspace.
 * Waiting/Chase semantics live on To Do metadata instead.
 * Risks is a first-class frame (not buried in Knowledge).
 */
export const DEFAULT_OVERVIEW_LAYOUT: WorkspaceLayout = {
  frames: [
    {
      id: "todo",
      type: "todo",
      title: "To Do",
      visible: true,
      order: 0,
      size: "wide",
    },
    {
      id: "risks",
      type: "risks",
      title: "Risks",
      visible: true,
      order: 1,
      size: "standard",
    },
    {
      id: "meetingPrep",
      type: "meetingPrep",
      title: "Meeting Prep",
      visible: true,
      order: 2,
      size: "standard",
    },
    {
      id: "timeline",
      type: "timeline",
      title: "Timeline",
      visible: false,
      order: 3,
      size: "full",
    },
    // Retained for Customiser migration of older layouts; not shown by default.
    {
      id: "nudge",
      type: "nudge",
      title: "Nudge Me",
      visible: false,
      order: 4,
      size: "compact",
    },
  ],
};

/** Bumped so retired Nudge / new Risks apply for existing localStorage users. */
const LAYOUT_KEY = "mc-workspace-layout-v3";

function migrateLayout(parsed: WorkspaceLayout): WorkspaceLayout {
  const byType = new Map(parsed.frames.map((f) => [f.type, f]));
  const frames = DEFAULT_OVERVIEW_LAYOUT.frames.map((def) => {
    const existing = byType.get(def.type);
    if (!existing) return { ...def };
    return {
      ...def,
      ...existing,
      // Force Nudge retired unless user re-enables in customiser after v3.
      visible: def.type === "nudge" ? false : (existing.visible ?? def.visible),
      title: def.title ?? existing.title,
      order: def.order,
    };
  });
  // Keep any unknown custom frames
  for (const f of parsed.frames) {
    if (!DEFAULT_OVERVIEW_LAYOUT.frames.some((d) => d.type === f.type)) {
      frames.push(f);
    }
  }
  return { frames };
}

export function readWorkspaceLayout(scope = "overview"): WorkspaceLayout {
  const fallback =
    scope === "overview" ? DEFAULT_OVERVIEW_LAYOUT : defaultProjectLayout(scope);
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(`${LAYOUT_KEY}:${scope}`);
    if (!raw) {
      // One-time migrate from v2 if present
      const legacy = window.localStorage.getItem(`mc-workspace-layout-v2:${scope}`);
      if (legacy) {
        const parsed = JSON.parse(legacy) as WorkspaceLayout;
        if (parsed?.frames?.length) {
          const migrated = migrateLayout(parsed);
          writeWorkspaceLayout(migrated, scope);
          return migrated;
        }
      }
      return fallback;
    }
    const parsed = JSON.parse(raw) as WorkspaceLayout;
    if (!parsed?.frames?.length) return fallback;
    return migrateLayout(parsed);
  } catch {
    return fallback;
  }
}

export function writeWorkspaceLayout(
  layout: WorkspaceLayout,
  scope = "overview",
) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${LAYOUT_KEY}:${scope}`, JSON.stringify(layout));
  } catch {
    /* ignore */
  }
}

export function visibleFrames(layout: WorkspaceLayout) {
  return [...layout.frames]
    .filter((f) => f.visible)
    .sort((a, b) => a.order - b.order);
}

export const FRAME_LABELS: Record<string, string> = {
  todo: "To Do",
  meetingPrep: "Meeting Prep",
  risks: "Risks",
  timeline: "Timeline",
  nudge: "Nudge Me",
};

export function defaultProjectLayout(projectId: string): WorkspaceLayout {
  return {
    frames: DEFAULT_OVERVIEW_LAYOUT.frames.map((frame) => ({
      ...frame,
      id: `${projectId}-${frame.id}`,
      projectScope: projectId,
    })),
  };
}
