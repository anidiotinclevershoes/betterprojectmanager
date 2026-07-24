"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useMission } from "@/lib/store";

export default function MeetingDetailPage() {
  const params = useParams<{ id: string }>();
  const { state } = useMission();
  const meeting = state.meetings.find((m) => m.id === params.id);

  if (!meeting) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-16">
        <p className="text-ink-soft">Meeting not found.</p>
        <Link href="/meetings" className="mt-4 inline-block text-teal">
          ← Back to meetings
        </Link>
      </div>
    );
  }

  const project = state.projects.find((p) => p.id === meeting.projectId);
  const prep = meeting.prep;

  return (
    <div className="mx-auto max-w-5xl px-5 py-12 md:px-8 md:py-16">
      <Link
        href="/meetings"
        className="text-sm text-ink-soft transition hover:text-ink"
      >
        ← Meetings
      </Link>
      <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-teal">
        {project?.name ?? "Project"} · Before the meeting
      </p>
      <h1 className="brand-mark mt-3 text-4xl font-extrabold tracking-tight md:text-5xl">
        {meeting.title}
      </h1>
      <p className="mt-3 text-ink-soft">
        {new Date(meeting.startsAt).toLocaleString(undefined, {
          weekday: "long",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}{" "}
        · {meeting.attendees.join(", ")}
      </p>

      <section className="mt-12">
        <h2 className="text-xs font-semibold uppercase tracking-[0.16em] text-signal">
          Opening script
        </h2>
        <p className="coach-voice mt-4 max-w-3xl text-2xl leading-snug text-ink">
          {prep.openingScript}
        </p>
      </section>

      <div className="mt-14 grid gap-12 md:grid-cols-2">
        <PrepList title="Objectives" items={prep.objectives} />
        <PrepList title="Decisions to obtain" items={prep.decisionsToObtain} />
        <PrepList title="Key talking points" items={prep.talkingPoints} />
        <PrepList title="Questions to ask" items={prep.questionsToAsk} />
        <PrepList title="Risks to discuss" items={prep.risksToDiscuss} />
        <PrepList title="People to engage" items={prep.peopleToEngage} />
        <PrepList
          title="Leadership opportunities"
          items={prep.leadershipOpportunities}
        />
        <PrepList
          title="Potential stakeholder concerns"
          items={prep.stakeholderConcerns}
        />
        <PrepList
          title="Areas to demonstrate ownership"
          items={prep.ownershipMoments}
        />
      </div>

      <section className="mt-16 border-t border-line pt-12">
        <h2 className="brand-mark text-3xl font-bold">During the meeting</h2>
        <p className="mt-2 max-w-2xl text-ink-soft">
          Keep these prompts visible. Lead — do not merely facilitate.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {meeting.duringPrompts.map((prompt) => (
            <div
              key={prompt.id}
              className="border-l-2 border-teal bg-teal-soft/40 px-4 py-4"
            >
              <p className="brand-mark text-lg font-bold text-ink">
                {prompt.prompt}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">
                {prompt.context}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16 border-t border-line pt-12">
        <h2 className="brand-mark text-3xl font-bold">After the meeting</h2>
        <p className="coach-voice mt-3 max-w-2xl text-lg text-ink-soft">
          When you capture notes from this meeting, Mission Control will draft
          summary, actions, decisions, risks, follow-up email and stakeholder
          update into institutional memory.
        </p>
        <Link
          href="/capture"
          className="mt-6 inline-block rounded-md bg-ink px-5 py-3 text-sm font-medium text-paper"
        >
          Capture the debrief
        </Link>
      </section>
    </div>
  );
}

function PrepList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-soft">
        {title}
      </h3>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item} className="text-[15px] leading-relaxed text-ink">
            • {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
