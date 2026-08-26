import React, { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeftIcon, ChevronRightIcon, XIcon } from "lucide-react";
import { useKnowledge } from "../contexts/KnowledgeContext";
import { TrustMark } from "./TrustMark";
import { PersonMark } from "./PersonMark";
import { typeLabel } from "../utils/labels";
import type { Connection, Entity, Fact } from "../types/knowledge";

const EASE = [0.23, 1, 0.32, 1] as const;

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="m-0 mb-2 text-[0.68rem] font-semibold tracking-[0.12em] text-[var(--text-muted)]">
      {children}
    </h4>
  );
}

/** A RIGHT NOW row. The value opens the object it refers to, quietly. */
function FactRow({ fact }: { fact: Fact }) {
  const { navigate } = useKnowledge();
  return (
    <div className="grid grid-cols-[6.75rem_1fr] items-baseline gap-3">
      <dt className="text-[0.79rem] leading-[1.5] text-[var(--text-muted)]">{fact.label}</dt>
      <dd className="m-0 min-w-0">
        {fact.ref ? (
          <button
            type="button"
            onClick={() => navigate(fact.ref as string)}
            className="rounded text-left text-[0.86rem] leading-[1.5] text-[var(--text-primary)] underline decoration-dotted decoration-[rgba(255,255,255,0.22)] underline-offset-[3px] transition-colors duration-150 hover:text-[#d7e0ff] hover:decoration-[rgba(140,170,255,0.7)]"
          >
            {fact.value}
          </button>
        ) : (
          <span className="text-[0.86rem] leading-[1.5] text-[var(--text-primary)]">
            {fact.value}
          </span>
        )}
      </dd>
    </div>
  );
}

function ConnectionRow({ connection }: { connection: Connection }) {
  const { get, navigate } = useKnowledge();
  const target = get(connection.targetId);
  if (!target) return null;
  return (
    <button
      type="button"
      onClick={() => navigate(connection.targetId)}
      className="group -mx-2 grid w-[calc(100%+1rem)] grid-cols-[6.75rem_1fr_auto] items-baseline gap-3 rounded-lg px-2 py-1.5 text-left transition-colors duration-150 hover:bg-white/[0.05]"
    >
      <span className="text-[0.79rem] leading-[1.5] text-[var(--text-muted)]">
        {connection.label}
      </span>
      <span className="flex min-w-0 items-baseline gap-1.5">
        {target.kind === "person" ? <PersonMark initials={target.initials} /> : null}
        <span className="min-w-0 text-[0.86rem] leading-[1.5] text-[var(--text-primary)] group-hover:text-[#d7e0ff]">
          {target.name}
        </span>
      </span>
      <ChevronRightIcon className="h-3.5 w-3.5 self-center text-[var(--text-muted)] opacity-0 transition-opacity duration-150 group-hover:opacity-70" />
    </button>
  );
}

function NeedsYouBlock({ entity }: { entity: Entity }) {
  return (
    <div className="border-b border-[var(--border-subtle)] bg-[rgba(228,162,59,0.06)] px-5 py-4">
      <SectionLabel>NEEDS YOU</SectionLabel>
      <p className="m-0 text-[0.86rem] leading-[1.65] text-[var(--text-secondary)]">
        {entity.needsYou?.statement}
      </p>
      <p className="mt-2 text-[0.9rem] font-medium leading-snug text-[var(--text-primary)]">
        {entity.needsYou?.question}
      </p>
    </div>
  );
}

function SourceSection({ entity }: { entity: Entity }) {
  if (!entity.source) return null;
  return (
    <section className="border-t border-[var(--border-subtle)] px-5 py-4">
      <SectionLabel>SOURCE</SectionLabel>
      <p className="m-0 text-[0.84rem] text-[var(--text-secondary)]">
        {entity.source.name}
        <span className="text-[var(--text-muted)]"> · {entity.source.when}</span>
      </p>
    </section>
  );
}

function WhyBlock({ entity }: { entity: Entity }) {
  const { trustOf, accept } = useKnowledge();
  const noticed = trustOf(entity.id) === "noticed";
  if (!entity.noticedBecause && !entity.evidence?.length) return null;

  return (
    <section className="border-t border-[var(--border-subtle)] px-5 py-4">
      <SectionLabel>WHY LUME BELIEVES THIS</SectionLabel>
      {entity.noticedBecause ? (
        <p className="m-0 mb-3 text-[0.84rem] leading-[1.65] text-[var(--text-secondary)]">
          {entity.noticedBecause}
        </p>
      ) : null}
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {(entity.evidence ?? []).map((e, i) => (
          <li key={`${e.source}-${i}`}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[0.82rem] text-[var(--text-secondary)]">{e.source}</span>
              <span className="shrink-0 text-[0.75rem] tabular-nums text-[var(--text-muted)]">
                {e.when}
              </span>
            </div>
            {e.quote ? (
              <p className="mt-1 border-l border-[var(--border-strong)] pl-2.5 text-[0.82rem] leading-relaxed text-[var(--text-muted)]">
                “{e.quote}”
              </p>
            ) : null}
          </li>
        ))}
      </ul>
      {noticed ? (
        <button
          type="button"
          onClick={() => accept(entity.id)}
          className="mt-3.5 rounded-lg border border-[var(--border-subtle)] bg-white/[0.03] px-2.5 py-1.5 text-[0.79rem] font-medium text-[var(--text-secondary)] transition-colors duration-150 hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
        >
          Accept as known
        </button>
      ) : null}
    </section>
  );
}

export function Inspector() {
  const {
    get,
    currentId,
    trail,
    back,
    goTo,
    close,
    expanded,
    setExpanded,
    trustOf,
    markResolved,
    isResolved,
    isDone,
    toggleDone,
  } = useKnowledge();

  useEffect(() => {
    if (!currentId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (trail.length > 1) back();
      else close();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [currentId, trail.length, back, close]);

  const entity = currentId ? get(currentId) : undefined;
  const previous = trail.length > 1 ? get(trail[trail.length - 2]) : undefined;
  const earlier = trail.slice(0, -2);

  const trust = entity ? trustOf(entity.id) : "known";
  const done = entity ? isDone(entity.id) : false;
  const resolved = entity ? isResolved(entity.id) : false;

  const facts: Fact[] = entity
    ? [...entity.now, ...(expanded ? (entity.moreNow ?? []) : [])].map((f) =>
        done && f.label === "Status" ? { ...f, value: "Done" } : f,
      )
    : [];
  const connections: Connection[] = entity
    ? [...(entity.connected ?? []), ...(expanded ? (entity.moreConnected ?? []) : [])]
    : [];
  const hiddenConnections = entity && !expanded ? (entity.moreConnected?.length ?? 0) : 0;

  const runAction = (action: string) => {
    if (!entity) return;
    if (action === "Mark done") toggleDone(entity.id);
    if (action === "Resolve" || action === "Mark resolved") markResolved(entity.id);
  };

  return (
    <AnimatePresence>
      {entity ? (
        <>
          {/* Subtle dimming — the Knowledge Centre stays visible and unmoved. */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE }}
            onClick={close}
            className="fixed inset-0 z-40 bg-[rgba(6,9,14,0.4)]"
            aria-hidden
          />

          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.26, ease: EASE }}
            aria-label={`${typeLabel(entity)} details`}
            className="fixed inset-y-0 right-0 z-50 flex w-[26rem] flex-col border-l border-[var(--border-strong)] bg-[var(--bg-surface)] shadow-[-24px_0_60px_-30px_rgba(0,0,0,0.9)]"
          >
            {/* header */}
            <header className="shrink-0 border-b border-[var(--border-subtle)] px-5 pb-4 pt-3.5">
              <div className="flex items-center gap-2">
                {previous ? (
                  <button
                    type="button"
                    onClick={back}
                    className="group -ml-1.5 flex min-w-0 items-center gap-1.5 rounded-lg px-1.5 py-1 text-[0.8rem] text-[var(--text-secondary)] transition-colors duration-150 hover:bg-white/[0.05] hover:text-[var(--text-primary)]"
                  >
                    <ArrowLeftIcon className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)] transition-colors duration-150 group-hover:text-[var(--text-primary)]" />
                    <span className="truncate">{previous.name}</span>
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close"
                  className="ml-auto shrink-0 rounded-md p-1 text-[var(--text-muted)] transition-colors duration-150 hover:bg-white/[0.06] hover:text-[var(--text-primary)]"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </div>

              {earlier.length ? (
                <div className="mb-1.5 flex min-w-0 items-center gap-1 text-[0.71rem] text-[var(--text-muted)]">
                  {earlier.map((id, i) => (
                    <React.Fragment key={id}>
                      <button
                        type="button"
                        onClick={() => goTo(i)}
                        className="max-w-[8rem] truncate rounded px-1 py-0.5 transition-colors duration-150 hover:bg-white/[0.05] hover:text-[var(--text-secondary)]"
                      >
                        {get(id)?.name}
                      </button>
                      <span aria-hidden>›</span>
                    </React.Fragment>
                  ))}
                </div>
              ) : null}

              <div className="mt-1 flex items-center gap-2.5">
                <span className="text-[0.68rem] font-semibold tracking-[0.12em] text-[var(--text-muted)]">
                  {typeLabel(entity).toUpperCase()}
                </span>
                <TrustMark trust={trust} />
              </div>

              <div className="mt-1.5 flex items-start gap-3">
                {entity.kind === "person" ? (
                  <span className="mt-0.5">
                    <PersonMark initials={entity.initials} size="lg" active />
                  </span>
                ) : null}
                <div className="min-w-0">
                  <h3 className="m-0 text-[1.05rem] font-semibold leading-snug text-[var(--text-primary)]">
                    {entity.name}
                  </h3>
                  {entity.role ? (
                    <p className="mt-0.5 text-[0.82rem] text-[var(--text-muted)]">{entity.role}</p>
                  ) : null}
                </div>
              </div>
            </header>

            {/* body */}
            <div className="lume-scroll min-h-0 flex-1 overflow-y-auto">
              {trust === "needs-you" && entity.needsYou ? (
                <NeedsYouBlock entity={entity} />
              ) : null}

              {resolved ? (
                <p className="m-0 border-b border-[var(--border-subtle)] px-5 py-3 text-[0.8rem] text-[var(--text-muted)]">
                  You marked this resolved.
                </p>
              ) : null}

              <section className="px-5 py-4">
                <SectionLabel>RIGHT NOW</SectionLabel>
                <dl className="m-0 flex flex-col gap-2">
                  {facts.map((f, i) => (
                    <FactRow key={`${f.label}-${f.value}-${i}`} fact={f} />
                  ))}
                </dl>
              </section>

              {connections.length ? (
                <section className="border-t border-[var(--border-subtle)] px-5 py-4">
                  <SectionLabel>CONNECTED TO</SectionLabel>
                  <div className="flex flex-col">
                    {connections.map((c, i) => (
                      <ConnectionRow key={`${c.label}-${c.targetId}-${i}`} connection={c} />
                    ))}
                  </div>
                  {hiddenConnections ? (
                    <button
                      type="button"
                      onClick={() => setExpanded(true)}
                      className="mt-1.5 text-[0.78rem] text-[var(--text-muted)] transition-colors duration-150 hover:text-[var(--text-secondary)]"
                    >
                      More connections · {hiddenConnections}
                    </button>
                  ) : null}
                </section>
              ) : null}

              {/* Ordinary known knowledge does not need to justify itself up front —
                  its Source lives under More details. */}
              {entity.source && !expanded && trust !== "known" ? (
                <SourceSection entity={entity} />
              ) : null}

              <AnimatePresence initial={false}>
                {expanded ? (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2, ease: EASE }}
                  >
                    {entity.source ? <SourceSection entity={entity} /> : null}

                    <WhyBlock entity={entity} />

                    {entity.history?.length ? (
                      <section className="border-t border-[var(--border-subtle)] px-5 py-4">
                        <SectionLabel>WHAT CHANGED</SectionLabel>
                        <ul className="m-0 flex list-none flex-col gap-2 p-0">
                          {entity.history.map((h, i) => (
                            <li key={`${h.when}-${i}`} className="flex items-baseline gap-3">
                              <span className="w-[3.1rem] shrink-0 text-[0.75rem] tabular-nums text-[var(--text-muted)]">
                                {h.when}
                              </span>
                              <span className="text-[0.83rem] leading-relaxed text-[var(--text-secondary)]">
                                {h.text}
                                {h.was ? (
                                  <span className="ml-2 text-[var(--text-muted)] line-through">
                                    {h.was}
                                  </span>
                                ) : null}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </section>
                    ) : null}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            {/* contextual actions */}
            <footer className="flex shrink-0 items-center gap-2 border-t border-[var(--border-subtle)] px-5 py-3.5">
              {(entity.actions ?? []).slice(0, 2).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => runAction(a)}
                  className="rounded-lg border border-[var(--border-subtle)] bg-white/[0.03] px-3 py-1.5 text-[0.8rem] font-medium text-[var(--text-secondary)] transition-colors duration-150 hover:border-[var(--border-strong)] hover:bg-white/[0.07] hover:text-[var(--text-primary)]"
                >
                  {a === "Mark done" && done ? "Mark not done" : a}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setExpanded(!expanded)}
                aria-expanded={expanded}
                className="ml-auto text-[0.8rem] font-medium text-[var(--text-secondary)] transition-colors duration-150 hover:text-[var(--text-primary)]"
              >
                {expanded ? "Fewer details" : "More details"}
              </button>
            </footer>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
