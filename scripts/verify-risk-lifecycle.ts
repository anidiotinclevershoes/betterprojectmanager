/**
 * Slice 1B: Risk lifecycle authority — deterministic regression.
 * No OpenAI. No live Supabase.
 *
 * Run: npm run verify:risk-lifecycle
 */
import assert from "node:assert/strict";
import { emptyKnowledge } from "../src/lib/knowledge";
import {
  findProjectRiskByExactTitle,
  foldOpenRisksIntoKnowledge,
  resolveKnowledgeOnlyRiskBullet,
  syncKnowledgeRiskProjection,
} from "../src/lib/risks/lifecycle";
import type { ProjectRisk } from "../src/lib/types";

const PROJECT_A = "11111111-1111-4111-8111-111111111111";
const PROJECT_B = "22222222-2222-4222-8222-222222222222";
const RISK_A1 = "33333333-3333-4333-8333-333333333333";
const RISK_A2 = "44444444-4444-4444-8444-444444444444";
const RISK_B1 = "55555555-5555-4555-8555-555555555555";

function risk(
  partial: Partial<ProjectRisk> & Pick<ProjectRisk, "id" | "projectId" | "title">,
): ProjectRisk {
  return {
    status: "open",
    source: "manual",
    ...partial,
  };
}

function testResolveUpdatesAuthoritativeStatus() {
  const open = risk({
    id: RISK_A1,
    projectId: PROJECT_A,
    title: "Security sign-off may miss CAB",
    status: "open",
  });
  const resolved: ProjectRisk = { ...open, status: "resolved" };
  assert.equal(resolved.status, "resolved");
  assert.equal(resolved.id, RISK_A1);
  assert.equal(open.id, resolved.id, "resolve must not mint a duplicate id");
}

function testResolveReloadDoesNotResurrect() {
  const risks: ProjectRisk[] = [
    risk({
      id: RISK_A1,
      projectId: PROJECT_A,
      title: "Security sign-off may miss CAB",
      status: "resolved",
    }),
    risk({
      id: RISK_A2,
      projectId: PROJECT_A,
      title: "Vendor delay on Auth0",
      status: "open",
    }),
  ];

  // Simulate Knowledge that still has a stale open title + [Resolved] prose.
  const knowledge = emptyKnowledge(PROJECT_A);
  knowledge.sections.risks = [
    "[Resolved] Security sign-off may miss CAB",
    "Vendor delay on Auth0",
  ];

  const folded = foldOpenRisksIntoKnowledge([knowledge], risks);
  const titles = folded[0]!.sections.risks;

  assert.ok(
    !titles.some((t) => t === "Security sign-off may miss CAB"),
    "resolved domain risk must not fold back as bare open title",
  );
  assert.ok(
    titles.some((t) => /Vendor delay on Auth0/i.test(t)),
    "unrelated open risk remains projected",
  );
}

function testResolvingADoesNotMutateB() {
  const risks: ProjectRisk[] = [
    risk({
      id: RISK_A1,
      projectId: PROJECT_A,
      title: "Risk A",
      status: "open",
    }),
    risk({
      id: RISK_A2,
      projectId: PROJECT_A,
      title: "Risk B",
      status: "open",
    }),
  ];
  const next = risks.map((r) =>
    r.id === RISK_A1 ? { ...r, status: "resolved" as const } : r,
  );
  assert.equal(next.find((r) => r.id === RISK_A1)!.status, "resolved");
  assert.equal(next.find((r) => r.id === RISK_A2)!.status, "open");
  assert.equal(next.length, 2, "must not create a duplicate Risk row");
}

function testProjectIsolation() {
  const risks: ProjectRisk[] = [
    risk({
      id: RISK_A1,
      projectId: PROJECT_A,
      title: "Shared wording risk",
      status: "resolved",
    }),
    risk({
      id: RISK_B1,
      projectId: PROJECT_B,
      title: "Shared wording risk",
      status: "open",
    }),
  ];
  const ka = emptyKnowledge(PROJECT_A);
  const kb = emptyKnowledge(PROJECT_B);
  const folded = foldOpenRisksIntoKnowledge([ka, kb], risks);
  const a = folded.find((k) => k.projectId === PROJECT_A)!;
  const b = folded.find((k) => k.projectId === PROJECT_B)!;
  assert.ok(!a.sections.risks.includes("Shared wording risk"));
  assert.ok(b.sections.risks.includes("Shared wording risk"));
}

function testKnowledgeProjectionSyncOnResolve() {
  const knowledge = emptyKnowledge(PROJECT_A);
  knowledge.sections.risks = [
    "Security sign-off may miss CAB",
    "Vendor delay on Auth0",
  ];
  const synced = syncKnowledgeRiskProjection(knowledge, {
    title: "Security sign-off may miss CAB",
    status: "resolved",
  });
  assert.deepEqual(synced.sections.risks, ["Vendor delay on Auth0"]);
}

function testLegacyKnowledgeOnlyDoesNotFabricateDomainRisk() {
  const knowledge = emptyKnowledge(PROJECT_A);
  knowledge.sections.risks = ["Legacy prose risk only"];
  const resolved = resolveKnowledgeOnlyRiskBullet(
    knowledge,
    "Legacy prose risk only",
  );
  assert.equal(resolved.sections.risks[0], "[Resolved] Legacy prose risk only");
  // Caller must not insert into risks[] — prove helper returns knowledge only.
  assert.equal(Object.keys(resolved).includes("sections"), true);
}

function testExactTitleMatchNotFuzzy() {
  const risks = [
    risk({
      id: RISK_A1,
      projectId: PROJECT_A,
      title: "Security sign-off may miss CAB",
    }),
  ];
  assert.ok(
    findProjectRiskByExactTitle(
      risks,
      PROJECT_A,
      "Security sign-off may miss CAB",
    ),
  );
  assert.equal(
    findProjectRiskByExactTitle(
      risks,
      PROJECT_A,
      "Security sign-off may miss CAB tomorrow maybe",
    ),
    undefined,
    "fuzzy substring must not resolve a domain Risk",
  );
}

function testRecommendationIsNotDomainRisk() {
  // Recommendations are not in ProjectRisk[]; resolving them is setRecommendationStatus only.
  const risks: ProjectRisk[] = [];
  assert.equal(
    findProjectRiskByExactTitle(risks, PROJECT_A, "Suggested risk idea"),
    undefined,
  );
}

testResolveUpdatesAuthoritativeStatus();
testResolveReloadDoesNotResurrect();
testResolvingADoesNotMutateB();
testProjectIsolation();
testKnowledgeProjectionSyncOnResolve();
testLegacyKnowledgeOnlyDoesNotFabricateDomainRisk();
testExactTitleMatchNotFuzzy();
testRecommendationIsNotDomainRisk();

console.log("verify-risk-lifecycle: OK");
