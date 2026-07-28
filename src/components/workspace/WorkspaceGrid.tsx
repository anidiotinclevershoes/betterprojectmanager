"use client";

import type { ComponentType } from "react";
import type { WorkspaceFrameConfig, FrameSize } from "@/lib/workspace/layout";
import { FRAME_LABELS } from "@/lib/workspace/layout";
import { WorkspaceFrame } from "@/components/workspace/WorkspaceFrame";
import { TodoFrame } from "@/components/frames/TodoFrame";
import { MeetingPrepFrame } from "@/components/frames/MeetingPrepFrame";
import { NudgeFrame } from "@/components/frames/NudgeFrame";
import { TimelineFrame } from "@/components/frames/TimelineFrame";

type FrameProps = {
  projectId?: string | null;
  size?: FrameSize;
};

export const frameRegistry: Record<string, ComponentType<FrameProps>> = {
  todo: TodoFrame,
  meetingPrep: MeetingPrepFrame,
  nudge: NudgeFrame,
  timeline: TimelineFrame,
};

function spanFor(frame: WorkspaceFrameConfig): string {
  if (frame.size === "full") return "lg:col-span-12";
  if (frame.size === "wide") return "lg:col-span-8";
  if (frame.size === "compact") return "lg:col-span-3";
  if (frame.type === "todo") return "lg:col-span-5";
  if (frame.type === "meetingPrep") return "lg:col-span-4";
  if (frame.type === "nudge") return "lg:col-span-3";
  return "lg:col-span-4";
}

export function WorkspaceFrameRow({
  frames,
  projectId,
}: {
  frames: WorkspaceFrameConfig[];
  projectId?: string | null;
}) {
  const visible = [...frames]
    .filter((f) => f.visible && f.type !== "timeline")
    .sort((a, b) => a.order - b.order);

  const timeline = [...frames]
    .filter((f) => f.visible && f.type === "timeline")
    .sort((a, b) => a.order - b.order)[0];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {visible.map((frame) => {
          const Component = frameRegistry[frame.type];
          if (!Component) return null;
          return (
            <div key={frame.id} className={`min-w-0 ${spanFor(frame)}`}>
              <WorkspaceFrame
                type={frame.type}
                title={frame.title ?? FRAME_LABELS[frame.type]}
              >
                <Component
                  projectId={projectId ?? frame.projectScope}
                  size={frame.size}
                />
              </WorkspaceFrame>
            </div>
          );
        })}
      </div>
      {timeline ? (
        <WorkspaceFrame
          type="timeline"
          title={timeline.title ?? FRAME_LABELS.timeline}
        >
          <TimelineFrame
            projectId={projectId ?? timeline.projectScope}
            size={timeline.size}
            snapshot={!projectId}
          />
        </WorkspaceFrame>
      ) : null}
    </div>
  );
}
