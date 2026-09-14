import type {
  AggregateScore,
  CaseScore,
  ExpectedFact,
  FactScore,
  Gate1V2Item,
  Gate1V2Operation,
  ScoreBucket,
} from "./types";

function blob(item: Gate1V2Item): string {
  return [
    item.operation,
    item.domain,
    item.subject,
    item.understood,
    item.evidence,
    item.question ?? "",
    item.leftUntouchedReason ?? "",
    item.targetCanonicalId ?? "",
    JSON.stringify(item.proposedValues),
  ]
    .join(" ")
    .toLowerCase();
}

function hasTokens(text: string, tokens: string[]): boolean {
  const hay = text.toLowerCase();
  return tokens.every((token) => hay.includes(token.toLowerCase()));
}

function matchItem(fact: ExpectedFact, items: Gate1V2Item[]): Gate1V2Item | null {
  return items.find((item) => hasTokens(blob(item), fact.tokens)) ?? null;
}

function allowedOps(fact: ExpectedFact): Gate1V2Operation[] {
  return Array.isArray(fact.expectedOperation)
    ? fact.expectedOperation
    : [fact.expectedOperation];
}

function isWrite(op: Gate1V2Operation): boolean {
  return op === "create" || op === "update" || op === "remove";
}

function targetOk(fact: ExpectedFact, item: Gate1V2Item): boolean {
  const accepted = fact.acceptedTargetIds ?? (
    fact.expectedTargetId ? [fact.expectedTargetId] : null
  );
  if (!accepted) return true;
  if (fact.expectedTargetId === null) return !item.targetCanonicalId;
  if (!item.targetCanonicalId) {
    return !isWrite(item.operation);
  }
  return accepted.includes(item.targetCanonicalId);
}

function forbiddenHit(fact: ExpectedFact, item: Gate1V2Item): boolean {
  if (!fact.forbiddenTargetIds?.length) return false;
  return Boolean(
    item.targetCanonicalId &&
      fact.forbiddenTargetIds.includes(item.targetCanonicalId),
  );
}

export function scoreItems(
  items: Gate1V2Item[],
  expected: ExpectedFact[],
  malformed: boolean,
): CaseScore {
  if (malformed && items.length === 0) {
    return {
      malformed: true,
      extraInvented: [],
      facts: expected.map((fact) => ({
        factId: fact.id,
        meaning: fact.meaning,
        bucket: "malformed_unusable",
        note: "Envelope unusable",
      })),
    };
  }

  const facts: FactScore[] = [];
  const claimed = new Set<Gate1V2Item>();

  for (const fact of expected) {
    const item = matchItem(fact, items);
    if (!item) {
      const ops = allowedOps(fact);
      const fallbackOnly = ops.every(
        (op) =>
          op === "left_untouched" || op === "no_change" || op === "needs_you",
      );
      const anyWrite = items.some((row) => isWrite(row.operation));
      if (fallbackOnly && !anyWrite) {
        facts.push({
          factId: fact.id,
          meaning: fact.meaning,
          bucket:
            ops.includes("left_untouched")
              ? "appropriate_left_untouched"
              : "appropriate_needs_you",
          note: "omitted without a write",
        });
        continue;
      }
      facts.push({
        factId: fact.id,
        meaning: fact.meaning,
        bucket: "silent_omission",
        note: "No matching item",
      });
      continue;
    }
    claimed.add(item);
    const ops = allowedOps(fact);

    if (forbiddenHit(fact, item) && isWrite(item.operation)) {
      facts.push({
        factId: fact.id,
        meaning: fact.meaning,
        bucket: "wrong_target",
        note: `write bound to forbidden ${item.targetCanonicalId}`,
      });
      continue;
    }

    if (!ops.includes(item.operation)) {
      if (isWrite(item.operation) && ops.every((op) => !isWrite(op))) {
        facts.push({
          factId: fact.id,
          meaning: fact.meaning,
          bucket:
            item.operation === "remove"
              ? "unsupported_invented_operation"
              : "incorrect_proposed_truth",
          note: `expected ${ops.join("|")}, got ${item.operation}`,
        });
        continue;
      }
      if (ops.includes("no_change") && item.operation === "update") {
        // restatement as update is incorrect proposed mutation
        facts.push({
          factId: fact.id,
          meaning: fact.meaning,
          bucket: "incorrect_proposed_truth",
          note: "restatement proposed as update",
        });
        continue;
      }
      facts.push({
        factId: fact.id,
        meaning: fact.meaning,
        bucket: "incorrect_proposed_truth",
        note: `expected ${ops.join("|")}, got ${item.operation}`,
      });
      continue;
    }

    if (isWrite(item.operation) && !targetOk(fact, item)) {
      facts.push({
        factId: fact.id,
        meaning: fact.meaning,
        bucket: "wrong_target",
        note: `expected ${fact.expectedTargetId ?? "new"}, got ${item.targetCanonicalId ?? "none"}`,
      });
      continue;
    }

    let bucket: ScoreBucket = "correct_explicit_truth";
    if (item.operation === "needs_you") bucket = "appropriate_needs_you";
    else if (item.operation === "left_untouched") bucket = "appropriate_left_untouched";
    else if (item.operation === "no_change") bucket = "correct_no_change";
    facts.push({
      factId: fact.id,
      meaning: fact.meaning,
      bucket,
      note: `${item.operation} ${item.domain} ${item.targetCanonicalId ?? "unbound"}`,
    });
  }

  const extraInvented: string[] = [];
  for (const item of items) {
    if (claimed.has(item)) continue;
    if (!isWrite(item.operation)) continue;
    extraInvented.push(
      `${item.operation} ${item.domain} ${item.targetCanonicalId ?? "new"} :: ${item.understood || item.subject}`,
    );
  }

  return { facts, extraInvented, malformed };
}

export function aggregateScores(rows: CaseScore[]): AggregateScore {
  const facts = rows.flatMap((row) => row.facts);
  const count = (bucket: ScoreBucket) =>
    facts.filter((f) => f.bucket === bucket).length;
  return {
    cases: rows.length,
    factsScored: facts.length,
    correctExplicitFacts: count("correct_explicit_truth"),
    falseWrites:
      count("incorrect_proposed_truth") +
      rows.reduce((n, row) => n + row.extraInvented.length, 0),
    wrongTargets: count("wrong_target"),
    silentLoss: count("silent_omission"),
    appropriateHumanFallback:
      count("appropriate_needs_you") + count("appropriate_left_untouched"),
    correctNoChange: count("correct_no_change"),
    inventedOperations:
      count("unsupported_invented_operation") +
      rows.reduce((n, row) => n + row.extraInvented.length, 0),
    malformedCases: rows.filter((row) => row.malformed).length,
  };
}

export function rates(agg: AggregateScore): Record<string, string> {
  const facts = agg.factsScored || 1;
  const cases = agg.cases || 1;
  const pct = (n: number, d: number) => `${n}/${d} (${Math.round((n / d) * 100)}%)`;
  return {
    correctExplicit: pct(agg.correctExplicitFacts, facts),
    falseWrites: pct(agg.falseWrites, facts),
    wrongTarget: pct(agg.wrongTargets, facts),
    silentLoss: pct(agg.silentLoss, facts),
    humanFallback: pct(agg.appropriateHumanFallback, facts),
    noChange: pct(agg.correctNoChange, facts),
    invented: pct(agg.inventedOperations, facts),
    malformed: pct(agg.malformedCases, cases),
  };
}
