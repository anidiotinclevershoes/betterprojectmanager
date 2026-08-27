"use client";

import "@/components/capture/capture-experience.css";
import {
  annotateTranscript,
  TRANSCRIPT_CATEGORY_META,
  type TranscriptAnnotationCategory,
  type TranscriptAnnotationSource,
} from "@/lib/capture/review/annotateTranscript";

export function AnnotatedTranscript({
  transcript,
  sources,
  onFocusReviewCard,
}: {
  transcript: string;
  sources: TranscriptAnnotationSource[];
  onFocusReviewCard?: (reviewCardId: string) => void;
}) {
  const annotated = annotateTranscript(transcript, sources);

  return (
    <figure
      className="annotated-transcript"
      data-testid="annotated-transcript"
    >
      <p className="annotated-transcript-body">
        {annotated.segments.map((segment, index) => {
          if (segment.type === "text") {
            return (
              <span key={`t-${index}`} data-transcript-text="">
                {segment.text}
              </span>
            );
          }
          const meta = TRANSCRIPT_CATEGORY_META[segment.category];
          const clickable = Boolean(segment.reviewCardId && onFocusReviewCard);
          const className = `annotated-transcript-mark is-${segment.category}`;
          const label = `${meta.label}: ${segment.text}`;
          const inner = (
            <>
              {segment.text}
              <span className="annotated-transcript-glyph" aria-hidden>
                {meta.glyph}
              </span>
            </>
          );
          if (clickable) {
            return (
              <button
                key={`m-${segment.sourceId}-${index}`}
                type="button"
                className={className}
                data-testid="transcript-mark"
                data-category={segment.category}
                data-source-id={segment.sourceId}
                aria-label={label}
                onClick={() => onFocusReviewCard?.(segment.reviewCardId!)}
              >
                {inner}
              </button>
            );
          }
          return (
            <mark
              key={`m-${segment.sourceId}-${index}`}
              className={className}
              data-testid="transcript-mark"
              data-category={segment.category}
              data-source-id={segment.sourceId}
              aria-label={label}
            >
              {inner}
            </mark>
          );
        })}
      </p>
      {annotated.categoriesUsed.length > 0 ? (
        <ul className="annotated-transcript-legend" aria-label="Annotation key">
          {annotated.categoriesUsed.map((category: TranscriptAnnotationCategory) => {
            const meta = TRANSCRIPT_CATEGORY_META[category];
            return (
              <li
                key={category}
                className={`annotated-transcript-legend-item is-${category}`}
              >
                <span aria-hidden>{meta.glyph}</span>
                <span>{meta.label}</span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </figure>
  );
}
