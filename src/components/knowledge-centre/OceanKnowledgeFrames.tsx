"use client";

import { useMemo, useState } from "react";
import { KnowledgeItemDetailDrawer } from "@/components/knowledge-centre/KnowledgeItemDetailDrawer";
import { KnowledgeTagFilter } from "@/components/knowledge-centre/KnowledgeTagFilter";
import { KcTimeline } from "@/components/knowledge-centre/KcTimeline";
import {
  MeetingCatchUpPanel,
  NextMeetingCue,
} from "@/components/knowledge-centre/MeetingCatchUp";
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
import { composeTimelineProjection } from "@/lib/knowledge-centre/timeline-projection";
import { useMission } from "@/lib/store";

const ALL_PREVIEW = 6;

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
              <p className="compact-change-type">{item.typeLabel}</p>
              <h4 className="compact-change-title">{item.title}</h4>
            </div>
          </div>
        </header>
        {item.supporting ? (
          <p className="kc-item-support">{item.supporting}</p>
        ) : null}
        {item.needsYou ? (
          <p className="np-needs-you-inline">
            <span className="np-needs-you-dot" aria-hidden />
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
  preview,
  onShowAll,
}: {
  bucket: KcBucketId;
  items: KcComposedItem[];
  selected: KnowledgeItemRef | null;
  onSelect: (ref: KnowledgeItemRef) => void;
  preview?: boolean;
  onShowAll?: () => void;
}) {
  if (!items.length) return null;
  const shown = preview ? items.slice(0, ALL_PREVIEW) : items;
  const more = preview && items.length > ALL_PREVIEW ? items.length - ALL_PREVIEW : 0;
  return (
    <section className="kc-bucket-group" data-testid={`kc-group-${bucket}`}>
      <header className="kc-bucket-group-head">
        <span className="compact-change-ico" aria-hidden>
          {KC_BUCKET_ICON[bucket]}
        </span>
        <h3>
          {bucketLabel(bucket)} · {items.length}
        </h3>
      </header>
      <div className="kc-bucket-group-body">
        {shown.map((item) => (
          <KcItemCard
            key={item.id}
            item={item}
            selected={item.ref ? knowledgeDetailEquals(selected, item.ref) : false}
            onSelect={item.ref ? () => onSelect(item.ref!) : undefined}
          />
        ))}
        {more > 0 && onShowAll ? (
          <button type="button" className="kc-more-link" onClick={onShowAll}>
            Show all {items.length} in {bucketLabel(bucket)}
          </button>
        ) : null}
      </div>
    </section>
  );
}

/**
 * Ocean Knowledge Centre — four-bucket presentation over existing truth.
 * Slice 2C drawer still opens from stable item refs (not index).
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
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [catchUpId, setCatchUpId] = useState<string | null>(null);

  // Keep these symbols in this module — item-detail / people UI contracts.
  void refForTodo;
  void refForRisk;
  void refForStructuredItem;

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

  const timeline = useMemo(
    () => composeTimelineProjection(state, projectId),
    [state, projectId],
  );

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
            BUCKET_IDS.map((id) => (
              <BucketGroup
                key={id}
                bucket={id}
                items={view.grouped[id]}
                selected={selected}
                onSelect={select}
                preview
                onShowAll={() => setBucket(id)}
              />
            ))
          ) : (
            <p className="kc-zero">
              {searching ? "No matches in this project." : "Nothing recorded yet."}
            </p>
          )
        ) : view.items.length ? (
          <div className="kc-bucket-list" data-testid={`kc-list-${bucket}`}>
            {view.items.map((item) => (
              <KcItemCard
                key={item.id}
                item={item}
                selected={item.ref ? knowledgeDetailEquals(selected, item.ref) : false}
                onSelect={item.ref ? () => select(item.ref!) : undefined}
              />
            ))}
          </div>
        ) : showCrossCue ? null : (
          <p className="kc-zero">
            {searching ? "No matches in this view." : "Nothing here yet."}
          </p>
        )}
      </div>

      {bucket === "knowledge" || bucket === "all" ? (
        <>
          <NextMeetingCue
            projectId={projectId}
            onOpen={(id) => setCatchUpId(id)}
          />
          {timeline.empty ? null : (
            <div className="kc-feature" data-testid="ocean-frame-timeline">
              <button
                type="button"
                className="kc-feature-toggle"
                aria-expanded={timelineOpen}
                data-testid="kc-timeline-toggle"
                onClick={() => setTimelineOpen((v) => !v)}
              >
                {timelineOpen ? "Timeline ▾" : "View timeline"}
              </button>
              {timelineOpen ? (
                <KcTimeline
                  projectId={projectId}
                  onMeetingPrep={(id) => setCatchUpId(id)}
                />
              ) : null}
            </div>
          )}
        </>
      ) : null}

      {catchUpId ? (
        <MeetingCatchUpPanel
          projectId={projectId}
          meetingId={catchUpId}
          onClose={() => setCatchUpId(null)}
        />
      ) : null}

      <KnowledgeItemDetailDrawer
        projectId={projectId}
        selected={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
