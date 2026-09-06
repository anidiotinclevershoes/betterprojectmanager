"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMission } from "@/lib/store";

/**
 * Retired Meeting Prep detail bookmark.
 * Never paints stored Meeting.prep. Sends the visitor to that meeting's
 * project Knowledge Centre — the current meeting-scoped Catch Me Up surface.
 * Visiting does not write or delete meeting / prep records.
 */
export default function RetiredMeetingDetailRoute() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { hydrated, state } = useMission();

  useEffect(() => {
    if (!hydrated) return;
    const meeting = state.meetings.find((m) => m.id === params.id);
    const projectId = meeting?.projectId ?? state.projects[0]?.id;
    router.replace(projectId ? `/projects/${projectId}` : "/");
  }, [hydrated, params.id, router, state.meetings, state.projects]);

  return (
    <div className="workspace-page">
      <p className="empty-copy">Opening Knowledge Centre…</p>
    </div>
  );
}
