"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { PageHeader, Panel } from "@/components/DashboardChrome";
import { formatWhen } from "@/lib/selectors";
import { useMission } from "@/lib/store";

export default function MeetingDetailPage() {
  const params = useParams<{ id: string }>();
  const { state } = useMission();
  const meeting = state.meetings.find((m) => m.id === params.id);

  if (!meeting) {
    return (
      <div className="panel p-8">
        <p className="text-ink-soft">Meeting not found.</p>
        <Link href="/meetings" className="mt-3 inline-block text-sm text-teal">
          ← Back to meetings
        </Link>
      </div>
    );
  }

  const project = state.projects.find((p) => p.id === meeting.projectId);
  const prep = meeting.prep;

  return (
    <div>
      <PageHeader
        eyebrow={`${project?.code ?? "Project"} · Before`}
        title={meeting.title}
        description={`${formatWhen(meeting.startsAt)} · ${meeting.attendees.join(", ")}`}
        actions={
          <Link
            href={project ? `/projects/${project.id}` : "/"}
            className="rounded-lg border border-line px-3 py-2 text-sm text-ink-soft hover:bg-mist"
          >
            Project dashboard
          </Link>
        }
      />

      <Panel title="Opening script" className="mb-5">
        <p className="coach-voice text-xl leading-snug text-ink md:text-2xl">
          {prep.openingScript}
        </p>
      </Panel>

      <div className="grid gap-5 md:grid-cols-2">
        <PrepPanel title="Objectives" items={prep.objectives} />
        <PrepPanel title="Decisions to obtain" items={prep.decisionsToObtain} />
        <PrepPanel title="Key talking points" items={prep.talkingPoints} />
        <PrepPanel title="Questions to ask" items={prep.questionsToAsk} />
        <PrepPanel title="Risks to discuss" items={prep.risksToDiscuss} />
        <PrepPanel title="People to engage" items={prep.peopleToEngage} />
        <PrepPanel
          title="Leadership opportunities"
          items={prep.leadershipOpportunities}
        />
        <PrepPanel
          title="Stakeholder concerns"
          items={prep.stakeholderConcerns}
        />
        <PrepPanel
          title="Ownership moments"
          items={prep.ownershipMoments}
        />
      </div>

      <Panel title="During the meeting" className="mt-5">
        <div className="grid gap-3 sm:grid-cols-2">
          {meeting.duringPrompts.map((prompt) => (
            <div
              key={prompt.id}
              className="rounded-lg border border-line bg-canvas/50 px-4 py-3"
            >
              <p className="brand-mark text-base font-bold">{prompt.prompt}</p>
              <p className="mt-1.5 text-sm text-ink-soft">{prompt.context}</p>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="After the meeting" className="mt-5">
        <p className="text-sm text-ink-soft">
          Capture notes and Lume will file summary, actions,
          decisions, risks and follow-ups into institutional memory.
        </p>
        <Link
          href="/capture"
          className="mt-4 inline-block rounded-lg bg-ink px-4 py-2 text-sm font-medium text-paper"
        >
          Capture the debrief
        </Link>
      </Panel>
    </div>
  );
}

function PrepPanel({ title, items }: { title: string; items: string[] }) {
  return (
    <Panel title={title}>
      <ul className="space-y-2 text-sm leading-relaxed text-ink">
        {items.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </Panel>
  );
}
