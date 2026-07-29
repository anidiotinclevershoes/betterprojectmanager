export type FrameSize = "compact" | "standard" | "wide" | "full";

export type WorkspaceFrameConfig = {
  id: string;
  type: "todo" | "meetingPrep" | "nudge" | "timeline";
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
      id: "meetingPrep",
      type: "meetingPrep",
      title: "Meeting Prep",
      visible: true,
      order: 1,
      size: "standard",
    },
    {
      id: "nudge",
      type: "nudge",
      title: "Nudge Me",
      visible: true,
      order: 2,
      size: "compact",
    },
    {
      id: "timeline",
      type: "timeline",
      title: "Timeline",
      visible: false,
      order: 3,
      size: "full",
    },
  ],
};

const LAYOUT_KEY = "mc-workspace-layout-v2";

export function readWorkspaceLayout(scope = "overview"): WorkspaceLayout {
  if (typeof window === "undefined") return DEFAULT_OVERVIEW_LAYOUT;
  try {
    const raw = window.localStorage.getItem(`${LAYOUT_KEY}:${scope}`);
    if (!raw) return DEFAULT_OVERVIEW_LAYOUT;
    const parsed = JSON.parse(raw) as WorkspaceLayout;
    if (!parsed?.frames?.length) return DEFAULT_OVERVIEW_LAYOUT;
    return parsed;
  } catch {
    return DEFAULT_OVERVIEW_LAYOUT;
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
  nudge: "Nudge Me",
  timeline: "Timeline",
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
