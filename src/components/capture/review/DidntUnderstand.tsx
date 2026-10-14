"use client";

import type { CaptureObservation } from "@/lib/capture/review/observations";

/** Uninterpreted observations. They are not Apply operations. */
export function DidntUnderstand({
  observations,
}: {
  observations: CaptureObservation[];
}) {
  const items = observations.filter(
    (obs) => obs.actionStatus === "no_change" || obs.actionStatus === "ignored",
  );
  if (items.length === 0) return null;

  return (
    <section
      className="p09-didnt"
      aria-labelledby="p09-didnt-title"
      data-testid="review-didnt-understand"
    >
      <h3 id="p09-didnt-title" className="p09-didnt-title">
        Didn't understand
      </h3>
      <ul className="p09-didnt-list">
        {items.map((obs) => (
          <li key={obs.id} className="p09-didnt-item">
            <p className="p09-didnt-quote">“{obs.text}”</p>
            <p className="p09-didnt-explain">
              Lume couldn’t safely interpret this part as a project change.
            </p>
            <p className="p09-didnt-safe">
              This wording won’t be added to project data.
            </p>
            <p className="p09-didnt-meta">No change proposed</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
