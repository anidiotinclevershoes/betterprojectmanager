/**
 * Mechanical scoring against frozen expected facts.
 * Token presence only. Does not reinterpret English or repair output.
 */
import type {
  CaseJudgement,
  Disposition,
  ExpectedFact,
  FactJudgement,
  FrozenCase,
  NormalizedItem,
} from "./types";

function blob(item: NormalizedItem): string {
  return [
    item.disposition,
    item.domain,
    item.subject,
    typeof item.evidence === "string" ? item.evidence : "",
    typeof item.ambiguity === "string" ? item.ambiguity : "",
    typeof item.referencedCanonicalId === "string" ? item.referencedCanonicalId : "",
    JSON.stringify(item.assertedValue),
  ]
    .join(" ")
    .toLowerCase();
}

function hasTokens(text: string, tokens: string[]): boolean {
  const hay = text.toLowerCase();
  return tokens.every((token) => hay.includes(token.toLowerCase()));
}

function fold(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function evidenceInCapture(captureText: string, evidence: string | "omitted"): boolean | null {
  if (evidence === "omitted" || !evidence) return null;
  return fold(captureText).includes(fold(evidence));
}

function isWrite(d: Disposition): boolean {
  return d === "create" || d === "update" || d === "remove";
}

function isIntervention(d: Disposition): boolean {
  return d === "needs_you" || d === "left_untouched";
}

function matchItem(fact: ExpectedFact, items: NormalizedItem[]): NormalizedItem | null {
  return items.find((item) => hasTokens(blob(item), fact.tokens)) ?? null;
}

function targetAllowed(fact: ExpectedFact, item: NormalizedItem): boolean {
  const accepted =
    fact.acceptedTargetIds ?? (fact.targetId ? [fact.targetId] : null);
  if (!accepted) return true;
  if (item.referencedCanonicalId === "omitted") {
    return !item.writeProposed || fact.existingVsNew === "new";
  }
  return accepted.includes(item.referencedCanonicalId);
}

function forbiddenHit(fact: ExpectedFact, item: NormalizedItem): boolean {
  if (!fact.forbiddenTargetIds?.length) return false;
  if (item.referencedCanonicalId === "omitted") return false;
  return fact.forbiddenTargetIds.includes(item.referencedCanonicalId);
}

export function scoreCase(args: {
  frozen: FrozenCase;
  contender: CaseJudgement["contender"];
  repeatIndex: number;
  normalized: NormalizedItem[];
  malformed: boolean;
}): CaseJudgement {
  const facts: FactJudgement[] = [];
  const claimed = new Set<NormalizedItem>();

  for (const fact of args.frozen.expected) {
    const item = matchItem(fact, args.normalized);
    if (!item) {
      const anyWrite = args.normalized.some((row) => row.writeProposed);
      if (fact.noCanonicalOperation && !anyWrite) {
        facts.push({
          factId: fact.id,
          meaning: fact.meaning,
          recalled: true,
          falseMaterialFact: false,
          falseUnsafeWrite: false,
          wrongIdentity: false,
          silentOmission: false,
          evidenceGrounded: null,
          ambiguitySafe: fact.genuineAmbiguity ? true : null,
          clearAutomationOk: fact.automaticActionSafe ? false : null,
          justifiedIntervention: fact.humanClarificationAppropriate,
          unnecessaryIntervention: fact.automaticActionSafe,
          note: "omitted without a write",
        });
        continue;
      }
      facts.push({
        factId: fact.id,
        meaning: fact.meaning,
        recalled: false,
        falseMaterialFact: false,
        falseUnsafeWrite: false,
        wrongIdentity: false,
        silentOmission: !fact.noCanonicalOperation,
        evidenceGrounded: null,
        ambiguitySafe: fact.genuineAmbiguity ? false : null,
        clearAutomationOk: fact.automaticActionSafe ? false : null,
        justifiedIntervention: false,
        unnecessaryIntervention: false,
        note: "No matching item",
      });
      continue;
    }
    claimed.add(item);
    const allowed = fact.expectedDisposition;
    const writeOk = item.writeProposed && allowed.some(isWrite);
    const fallbackOk =
      !item.writeProposed &&
      (allowed.includes(item.disposition) ||
        (fact.noCanonicalOperation && isIntervention(item.disposition)));
    const wrongId =
      item.writeProposed &&
      (forbiddenHit(fact, item) || (Boolean(fact.targetId) && !targetAllowed(fact, item) && fact.existingVsNew !== "new"));
    const unsafeWrite =
      item.writeProposed &&
      (fact.noCanonicalOperation || wrongId || (!allowed.some(isWrite) && !allowed.includes("update")));
    const inventedWrite =
      item.writeProposed &&
      !allowed.includes(item.disposition) &&
      !allowed.some(isWrite);
    const intervention = isIntervention(item.disposition) || (!item.writeProposed && fact.noCanonicalOperation);
    facts.push({
      factId: fact.id,
      meaning: fact.meaning,
      recalled: true,
      falseMaterialFact: inventedWrite,
      falseUnsafeWrite: unsafeWrite,
      wrongIdentity: wrongId,
      silentOmission: false,
      evidenceGrounded: evidenceInCapture(args.frozen.captureText, item.evidence),
      ambiguitySafe: fact.genuineAmbiguity ? !item.writeProposed : null,
      clearAutomationOk: fact.automaticActionSafe
        ? (writeOk || (allowed.includes("no_change") && item.disposition === "no_change")) && !wrongId
        : null,
      justifiedIntervention:
        Boolean(fact.humanClarificationAppropriate && intervention && !item.writeProposed),
      unnecessaryIntervention:
        Boolean(fact.automaticActionSafe && intervention && !writeOk),
      note: `${item.disposition} write=${item.writeProposed ? "yes" : "no"} id=${item.referencedCanonicalId}`,
    });
  }

  const extraWrites: string[] = [];
  for (const item of args.normalized) {
    if (!item.writeProposed || claimed.has(item)) continue;
    extraWrites.push(
      `${item.disposition}:${item.domain}:${item.subject}:${item.referencedCanonicalId}`,
    );
  }

  return {
    caseId: args.frozen.id,
    contender: args.contender,
    repeatIndex: args.repeatIndex,
    facts,
    extraWrites,
    malformed: args.malformed,
  };
}
