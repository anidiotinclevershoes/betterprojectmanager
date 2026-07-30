"use client";

import type { ComponentType } from "react";
import type { WorkspaceFrameConfig, FrameSize } from "@/lib/workspace/layout";
import { FRAME_LABELS } from "@/lib/workspace/layout";
import { packWorkspaceFrames } from "@/lib/workspace/packing";
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

const SPAN_CLASS: Record<number, string> = {
  1: "lg:col-span-1",
  2: "lg:col-span-2",
  3: "lg:col-span-3",
  4: "lg:col-span-4",
  5: "lg:col-span-5",
  6: "lg:col-span-6",
  7: "lg:col-span-7",
  8: "lg:col-span-8",
  9: "lg:col-span-9",
  10: "lg:col-span-10",
  11: "lg:col-span-11",
  12: "lg:col-span-12",
};

export function WorkspaceFrameRow({
  frames,
  projectId,
}: {
  frames: WorkspaceFrameConfig[];
  projectId?: string | null;
}) {
  const visible = frames.filter((f) => f.visible);
  const packed = packWorkspaceFrames(visible);

  return (
    <div className="workspace-grid grid grid-cols-1 gap-4 md:grid-cols-6 lg:grid-cols-12 lg:items-stretch">
      {packed.map(({ frame, span }) => {
        const Component = frameRegistry[frame.type];
        if (!Component) return null;
        const spanClass = SPAN_CLASS[span] ?? "lg:col-span-4";
        const mdSpan =
          frame.size === "full" || span >= 6
            ? "md:col-span-6"
            : "md:col-span-3";
        return (
          <div key={frame.id} className={`min-w-0 ${mdSpan} ${spanClass}`}>
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
  );
}
