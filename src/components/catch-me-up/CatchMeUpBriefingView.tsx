"use client";

import type { CatchMeUpBriefing, CatchMeUpItem } from "@/lib/catch-me-up/types";

function factsForItem(
  item: CatchMeUpItem,
  briefing: CatchMeUpBriefing,
): Array<{ id: string; summary: string }> {
  return item.factIds
    .map((id) => briefing.facts.find((f) => f.id === id))
    .filter((row): row is { id: string; summary: string } => Boolean(row));
}

function ItemCard({
  item,
  briefing,
}: {
  item: CatchMeUpItem;
  briefing: CatchMeUpBriefing;
}) {
  const support = factsForItem(item, briefing);
  return (
    <li
      className="ocean-catch-me-up-item"
      data-testid="catch-me-up-item"
      data-epistemic={item.epistemic}
    >
      {item.epistemic === "inferred" ? (
        <p className="ocean-catch-me-up-epistemic">I noticed</p>
      ) : (
        <p className="ocean-catch-me-up-epistemic">From the project</p>
      )}
      <p className="ocean-catch-me-up-prose">{item.prose}</p>
      {support.length > 0 ? (
        <details className="ocean-catch-me-up-facts">
          <summary>Supporting facts</summary>
          <ul>
            {support.map((fact) => (
              <li key={fact.id}>{fact.summary}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </li>
  );
}

function Section({
  testId,
  title,
  kicker,
  items,
  briefing,
  inferred,
}: {
  testId: string;
  title: string;
  kicker?: string;
  items: CatchMeUpItem[];
  briefing: CatchMeUpBriefing;
  inferred?: boolean;
}) {
  if (!items.length) return null;
  return (
    <section
      className={`ocean-catch-me-up-section${inferred ? " is-inferred" : ""}`}
      data-testid={testId}
    >
      {kicker ? <p className="ocean-catch-me-up-kicker">{kicker}</p> : null}
      <h3>{title}</h3>
      <ul className="ocean-catch-me-up-list">
        {items.map((item, index) => (
          <ItemCard
            key={`${item.epistemic}-${index}`}
            item={item}
            briefing={briefing}
          />
        ))}
      </ul>
    </section>
  );
}

export function CatchMeUpBriefingView({
  briefing,
}: {
  briefing: CatchMeUpBriefing;
}) {
  return (
    <div
      className="ocean-catch-me-up-briefing"
      data-testid="catch-me-up-briefing"
      data-thin={briefing.thinProject ? "true" : "false"}
    >
      {briefing.whereWeAre ? (
        <section
          className="ocean-catch-me-up-section"
          data-testid="catch-me-up-where-we-are"
        >
          <p className="ocean-catch-me-up-kicker">What Lume knows</p>
          <h3>Where we are</h3>
          <div
            className="ocean-catch-me-up-item"
            data-testid="catch-me-up-item"
            data-epistemic={briefing.whereWeAre.epistemic}
          >
            <p className="ocean-catch-me-up-prose">{briefing.whereWeAre.prose}</p>
          </div>
        </section>
      ) : null}

      <Section
        testId="catch-me-up-attention"
        title="Needs your attention"
        items={briefing.needsAttention}
        briefing={briefing}
      />
      <Section
        testId="catch-me-up-missed"
        title="Things you might have missed"
        items={briefing.mightHaveMissed}
        briefing={briefing}
      />
      <Section
        testId="catch-me-up-connections"
        title="Connections I noticed"
        kicker="What Lume notices"
        items={briefing.connections}
        briefing={briefing}
        inferred
      />
    </div>
  );
}
