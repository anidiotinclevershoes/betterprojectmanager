"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MeetingCatchUpPanel,
  NextMeetingCue,
} from "@/components/knowledge-centre/MeetingCatchUp";
import { KnowledgeItemDetailDrawer } from "@/components/knowledge-centre/KnowledgeItemDetailDrawer";
import { KnowledgeTagFilter } from "@/components/knowledge-centre/KnowledgeTagFilter";
import { TimelineFrame } from "@/components/frames/TimelineFrame";
import {
  knowledgeDetailEquals,
  refForRisk,
  refForStructuredItem,
  refForTodo,
  type KnowledgeItemRef,
} from "@/lib/knowledge-centre/knowledge-item-detail";
import {
  BUCKET_IDS,
  KC_BUCKET_ICON,
  bucketLabel,
  composeKnowledgeCentreItems,
  filterKnowledgeCentreItems,
  type KcBucket,
  type KcBucketId,
  type KcComposedItem,
  type KcKnowledgeSubtype,
} from "@/lib/knowledge-centre/four-bucket";
import { useMission } from "@/lib/store";
import "./kc-four-bucket.css";
import "./kc-meeting-catch-up.css";

const OCEAN_FRAME_TESTID: Record<KcBucketId, string> = {
  issues: "ocean-frame-risks",
  people: "ocean-frame-people",
  todo: "ocean-frame-todo",
  knowledge: "ocean-frame-knowledge",
};

function KcItemCard({
  item,
  selected,
  onSelect,
}: {
  item: KcComposedItem;
  selected: boolean;
  onSelect?: () => void;
}) {
  return (
    <article
      className={`kc-item compact-change-card ${item.needsYou ? "is-emphasized" : ""} ${selected ? "is-selected" : ""}`}
      data-testid={`kc-item-${item.id}`}
    >
      <button
        type="button"
        className="kc-item-hit"
        onClick={onSelect}
        disabled={!onSelect}
        aria-pressed={selected}
      >
        <header className="compact-change-head">
          <div className="compact-change-entity">
            <span className="compact-change-ico" aria-hidden>
              {item.icon}
            </span>
            <div className="compact-change-titles">
              <p className="compact-change-type">
                {bucketLabel(item.bucket)} · {item.typeLabel}
              </p>
              <h4 className="compact-change-title">{item.title}</h4>
            </div>
          </div>
        </header>
        {item.supporting ? (
          <p className="kc-item-support">{item.supporting}</p>
        ) : null}
        {item.needsYou ? (
          <p className="kc-needs-you">
            <span className="kc-needs-you-dot" aria-hidden />
            <span>{item.needsYou}</span>
          </p>
        ) : null}
        {item.tagNames.length ? (
          <p className="kc-item-tags">
            {item.tagNames.map((name) => (
              <span key={name} className="tag-chip">
                {name}
              </span>
            ))}
          </p>
        ) : null}
      </button>
    </article>
  );
}

function BucketGroup({
  bucket,
  items,
  selected,
  onSelect,
  oceanTestId,
  heading,
  alwaysRender = false,
}: {
  bucket: KcBucketId;
  items: KcComposedItem[];
  selected: KnowledgeItemRef | null;
  onSelect: (ref: KnowledgeItemRef) => void;
  oceanTestId?: string;
  heading?: string;
  alwaysRender?: boolean;
}) {
  if (!items.length && !alwaysRender) return null;
  const label = heading ?? bucketLabel(bucket);
  return (
    <section
      className="kc-bucket-group"
      data-testid={oceanTestId ?? `kc-group-${bucket}`}
      data-kc-group={bucket}
    >
      <header className="kc-bucket-group-head">
        <span className="compact-change-ico" aria-hidden>
          {KC_BUCKET_ICON[bucket]}
        </span>
        <h3>
          {label} · {items.length}
        </h3>
      </header>
      <div className="kc-bucket-group-body">
        {items.map((item) => (
          <KcItemCard
            key={item.id}
            item={item}
            selected={item.ref ? knowledgeDetailEquals(selected, item.ref) : false}
            onSelect={item.ref ? () => onSelect(item.ref!) : undefined}
          />
        ))}
      </div>
    </section>
  );
}

/**
 * Ocean Knowledge Centre — four-bucket presentation over existing truth.
 * Slice 2C drawer still opens from stable item refs (not index).
 * Search stays searchAuthoritativeProject in the ask bar; this list is a
 * presentation filter of the same query string, not a second store.
 */
export function OceanKnowledgeFrames({
  projectId,
  searchQuery = "",
}: {
  projectId: string;
  searchQuery?: string;
}) {
  const { state } = useMission();
  const [selected, setSelected] = useState<KnowledgeItemRef | null>(null);
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [bucket, setBucket] = useState<KcBucket>("all");
  const [subtype, setSubtype] = useState<KcKnowledgeSubtype>("all");
  const [catchUpId, setCatchUpId] = useState<string | null>(null);

  // Keep these symbols in this module — item-detail / people UI contracts.
  void refForTodo;
  void refForRisk;
  void refForStructuredItem;

  useEffect(() => {
    setSelected(null);
  }, [projectId]);

  const composed = useMemo(
    () => composeKnowledgeCentreItems(state, projectId),
    [state, projectId],
  );

  const view = useMemo(
    () =>
      filterKnowledgeCentreItems(
        composed,
        {
          query: searchQuery,
          bucket,
          tagIds: tagFilter,
          knowledgeSubtype: subtype,
        },
        { itemTags: state.itemTags, projectId },
      ),
    [composed, searchQuery, bucket, tagFilter, subtype, state.itemTags, projectId],
  );

  const projectTags = state.projectTags ?? [];
  const usedTagIds = useMemo(() => {
    return new Set(
      (state.itemTags ?? [])
        .filter((row) => row.projectId === projectId)
        .map((row) => row.tagId),
    );
  }, [state.itemTags, projectId]);

  const select = (ref: KnowledgeItemRef) => {
    setSelected((prev) => (knowledgeDetailEquals(prev, ref) ? null : ref));
  };

  const searching = Boolean(searchQuery.trim()) || tagFilter.length > 0;
  const showCrossCue =
    Boolean(searchQuery.trim()) &&
    bucket !== "all" &&
    view.globalCount > view.bucketCount;

  return (
    <div className="ocean-knowledge-frames kc-four" data-testid="ocean-knowledge-frames">
      <nav className="kc-bucket-nav" aria-label="Knowledge Centre views" data-testid="kc-bucket-nav">
        {(["all", ...BUCKET_IDS] as KcBucket[]).map((id) => {
          const count = view.counts[id];
          const selectedBucket = bucket === id;
          return (
            <button
              key={id}
              type="button"
              className={`kc-bucket-tab ${selectedBucket ? "is-selected" : ""}`}
              aria-pressed={selectedBucket}
              data-testid={`kc-bucket-${id}`}
              onClick={() => {
                setBucket(id);
                if (id !== "knowledge") setSubtype("all");
              }}
            >
              {bucketLabel(id)}
              <span className="kc-bucket-count">{count}</span>
            </button>
          );
        })}
      </nav>

      <NextMeetingCue projectId={projectId} onOpen={setCatchUpId} />

      {catchUpId ? (
        <MeetingCatchUpPanel
          projectId={projectId}
          meetingId={catchUpId}
          onClose={() => setCatchUpId(null)}
        />
      ) : null}

      <KnowledgeTagFilter
        projectId={projectId}
        projectTags={projectTags}
        usedTagIds={usedTagIds}
        selectedTagIds={tagFilter}
        onChange={setTagFilter}
      />

      {bucket === "knowledge" ? (
        <div className="kc-subtype-nav" data-testid="kc-knowledge-subtypes">
          {(
            [
              ["all", "All"],
              ["dates", "Dates & milestones"],
              ["decisions", "Decisions"],
              ["information", "Information"],
            ] as Array<[KcKnowledgeSubtype, string]>
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`kc-subtype-tab ${subtype === id ? "is-selected" : ""}`}
              aria-pressed={subtype === id}
              data-testid={`kc-subtype-${id}`}
              onClick={() => setSubtype(id)}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {showCrossCue ? (
        <p className="kc-cross-cue" data-testid="kc-cross-cue">
          {view.bucketCount} result{view.bucketCount === 1 ? "" : "s"} in{" "}
          {bucketLabel(bucket)} · {view.globalCount} across the project{" "}
          <button
            type="button"
            className="kc-more-link"
            data-testid="kc-show-all-results"
            onClick={() => setBucket("all")}
          >
            Show all {view.globalCount}
          </button>
        </p>
      ) : null}

      <div className="kc-four-body" data-testid="kc-four-body">
        {bucket === "all" ? (
          view.globalCount ? (
            <>
              {(["issues", "people", "todo"] as const).map((id) => (
                <BucketGroup
                  key={id}
                  bucket={id}
                  items={view.grouped[id]}
                  selected={selected}
                  onSelect={select}
                  oceanTestId={OCEAN_FRAME_TESTID[id]}
                  alwaysRender
                />
              ))}
              <BucketGroup
                bucket="knowledge"
                items={view.grouped.knowledge.filter(
                  (item) => item.knowledgeSubtype === "dates",
                )}
                selected={selected}
                onSelect={select}
                oceanTestId="ocean-frame-dates"
                heading="Dates"
                alwaysRender
              />
              <BucketGroup
                bucket="knowledge"
                items={view.grouped.knowledge.filter(
                  (item) => item.knowledgeSubtype !== "dates",
                )}
                selected={selected}
                onSelect={select}
                oceanTestId={OCEAN_FRAME_TESTID.knowledge}
              />
            </>
          ) : (
            <>
              <section data-testid="ocean-frame-risks" data-kc-group="issues" />
              <section data-testid="ocean-frame-people" data-kc-group="people" />
              <section data-testid="ocean-frame-todo" data-kc-group="todo" />
              <section data-testid="ocean-frame-dates" data-kc-group="dates" />
              <p className="kc-zero">
                {searching ? "No matches in this project." : "Nothing recorded yet."}
              </p>
            </>
          )
        ) : view.items.length ? (
          <div
            className="kc-bucket-list"
            data-testid={
              bucket === "knowledge"
                ? `kc-list-${bucket}`
                : OCEAN_FRAME_TESTID[bucket]
            }
          >
            {bucket === "knowledge" ? (
              <div data-testid="ocean-frame-dates">
                {view.items
                  .filter((item) => item.knowledgeSubtype === "dates")
                  .map((item) => (
                    <KcItemCard
                      key={item.id}
                      item={item}
                      selected={item.ref ? knowledgeDetailEquals(selected, item.ref) : false}
                      onSelect={item.ref ? () => select(item.ref!) : undefined}
                    />
                  ))}
              </div>
            ) : null}
            {(bucket === "knowledge"
              ? view.items.filter((item) => item.knowledgeSubtype !== "dates")
              : view.items
            ).map((item) => (
              <KcItemCard
                key={item.id}
                item={item}
                selected={item.ref ? knowledgeDetailEquals(selected, item.ref) : false}
                onSelect={item.ref ? () => select(item.ref!) : undefined}
              />
            ))}
          </div>
        ) : showCrossCue ? (
          <>
            {bucket === "issues" ? (
              <section data-testid="ocean-frame-risks" data-kc-group="issues" />
            ) : null}
            {bucket === "people" ? (
              <section data-testid="ocean-frame-people" data-kc-group="people" />
            ) : null}
            {bucket === "todo" ? (
              <section data-testid="ocean-frame-todo" data-kc-group="todo" />
            ) : null}
            {bucket === "knowledge" ? (
              <section data-testid="ocean-frame-dates" data-kc-group="dates" />
            ) : null}
          </>
        ) : (
          <>
            {bucket === "issues" ? (
              <section data-testid="ocean-frame-risks" data-kc-group="issues" />
            ) : null}
            {bucket === "people" ? (
              <section data-testid="ocean-frame-people" data-kc-group="people" />
            ) : null}
            {bucket === "todo" ? (
              <section data-testid="ocean-frame-todo" data-kc-group="todo" />
            ) : null}
            {bucket === "knowledge" ? (
              <section data-testid="ocean-frame-dates" data-kc-group="dates" />
            ) : null}
            <p className="kc-zero">
              {searching ? "No matches in this view." : "Nothing here yet."}
            </p>
          </>
        )}
      </div>

      {bucket === "knowledge" || bucket === "all" ? (
        <div className="kc-feature" data-testid="ocean-frame-timeline">
          <p className="kc-feature-label">Timeline</p>
          <div className="kc-feature-body ocean-embed-frame">
            <TimelineFrame
              projectId={projectId}
              size="tall"
              onMeetingPrep={setCatchUpId}
            />
          </div>
        </div>
      ) : null}

      <KnowledgeItemDetailDrawer
        projectId={projectId}
        selected={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
