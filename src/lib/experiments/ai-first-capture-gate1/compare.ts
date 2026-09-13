/**
 * Basic comparison only. Not a scoring framework.
 */
import type {
  ComparisonRow,
  ExpectedFact,
  Gate1Interpretation,
} from "./types";

function blob(text: string): string {
  return text.toLowerCase();
}

function hasTokens(text: string, tokens: string[]): boolean {
  const hay = blob(text);
  return tokens.every((token) => hay.includes(token.toLowerCase()));
}

function observationText(obs: Gate1Interpretation["observations"][number]): string {
  return [
    obs.domain,
    obs.subject,
    obs.assertion,
    obs.proposedValue ?? "",
    obs.evidence,
    obs.ambiguity ?? "",
    obs.referencedCanonicalId ?? "",
    obs.referenceKind,
  ].join(" ");
}

function matchFact(
  fact: ExpectedFact,
  interpretation: Gate1Interpretation,
): Gate1Interpretation["observations"][number] | null {
  for (const obs of interpretation.observations) {
    if (hasTokens(observationText(obs), fact.tokens)) return obs;
  }
  return null;
}

export function compareInterpretation(
  interpretation: Gate1Interpretation,
  expectedFacts: ExpectedFact[],
  captureText: string,
): ComparisonRow {
  const found: string[] = [];
  const missed: string[] = [];
  const invented: string[] = [];
  const referenceNotes: string[] = [];
  const ambiguityNotes: string[] = [];
  const evidenceNotes: string[] = [];

  for (const fact of expectedFacts) {
    const obs = matchFact(fact, interpretation);
    if (!obs) {
      missed.push(fact.meaning);
      continue;
    }
    found.push(fact.meaning);

    if (fact.expectedCanonicalId) {
      if (obs.referencedCanonicalId === fact.expectedCanonicalId) {
        referenceNotes.push(`${fact.id}: correct ${fact.expectedCanonicalId}`);
      } else {
        referenceNotes.push(
          `${fact.id}: expected ${fact.expectedCanonicalId}, got ${obs.referencedCanonicalId ?? "null"}`,
        );
      }
    } else if (fact.expectedReferenceKind === "new") {
      if (obs.referencedCanonicalId) {
        referenceNotes.push(
          `${fact.id}: incorrectly bound new fact to ${obs.referencedCanonicalId}`,
        );
      } else {
        referenceNotes.push(`${fact.id}: unbound / new`);
      }
    }

    if (fact.mustSurfaceAmbiguity) {
      const flagged =
        obs.referenceKind === "ambiguous" || Boolean(obs.ambiguity);
      ambiguityNotes.push(
        flagged
          ? `${fact.id}: ambiguity surfaced (${obs.referenceKind})`
          : `${fact.id}: ambiguity not surfaced; referenceKind=${obs.referenceKind} id=${obs.referencedCanonicalId ?? "null"}`,
      );
    }

    const evidenceInCapture = captureText.includes(obs.evidence);
    evidenceNotes.push(
      evidenceInCapture
        ? `${fact.id}: evidence grounded`
        : `${fact.id}: evidence not a Capture substring`,
    );

    if (fact.unsafeIfPresent?.length) {
      const hay = blob(observationText(obs));
      for (const token of fact.unsafeIfPresent) {
        if (hay.includes(token.toLowerCase()) && token.toLowerCase() === "resolved") {
          invented.push(`${fact.id} looks resolved — not expected`);
        }
      }
    }
  }

  for (const obs of interpretation.observations) {
    if (obs.domain === "commentary") continue;
    const matched = expectedFacts.some((fact) =>
      hasTokens(observationText(obs), fact.tokens),
    );
    if (matched) continue;
    const hay = blob(observationText(obs));
    if (hay.includes("biscuit") || hay.includes("plant")) {
      invented.push(`irrelevant treated as project truth: ${obs.assertion}`);
      continue;
    }
    invented.push(`unmatched observation: ${obs.domain} ${obs.assertion}`);
  }

  const existingWrong = referenceNotes.some(
    (note) => note.includes("incorrectly") || note.includes("expected "),
  );
  const existingOk =
    referenceNotes.length > 0 &&
    referenceNotes.every(
      (note) => note.includes("correct ") || note.includes("unbound / new"),
    );

  const ambiguityUnsafe = ambiguityNotes.some((note) =>
    note.includes("not surfaced"),
  );
  const evidenceBad = evidenceNotes.some((note) =>
    note.includes("not a Capture"),
  );

  return {
    materialFactsExpected: expectedFacts.map((f) => f.meaning),
    materialFactsFound: found,
    materialFactsMissed: missed,
    unsupportedOrInvented: invented,
    existingEntityReferences: existingWrong
      ? `incorrect — ${referenceNotes.join("; ") || "none"}`
      : existingOk
        ? `correct — ${referenceNotes.join("; ") || "none required"}`
        : referenceNotes.join("; ") || "none required",
    ambiguityHandling: ambiguityUnsafe
      ? `unsafe — ${ambiguityNotes.join("; ") || "none"}`
      : ambiguityNotes.length
        ? `safe — ${ambiguityNotes.join("; ")}`
        : "no ambiguity-required fact",
    evidenceGrounding: evidenceBad
      ? `not grounded — ${evidenceNotes.join("; ")}`
      : evidenceNotes.length
        ? `grounded — ${evidenceNotes.join("; ")}`
        : "no matched evidence",
  };
}
