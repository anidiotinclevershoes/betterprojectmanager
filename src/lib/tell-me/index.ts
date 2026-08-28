export type {
  ProjectIntelligenceSnapshot,
  TellMeAnswer,
  TellMeAskRequest,
  TellMeConversationTurn,
  TellMeFreshness,
  TellMeSourceRef,
  TellMeSuggestedQuestion,
} from "@/lib/tell-me/types";

export { answerTellMeQuestion, pickSources, filterRelevantSources } from "@/lib/tell-me/answer";
export { buildTellMeContext } from "@/lib/tell-me/context";
export {
  TellMeServerTruthError,
  filterMissionStateToProject,
  loadServerCurrentTruthForTellMe,
} from "@/lib/tell-me/server-truth";
export {
  assessFreshness,
  questionImpliesLatest,
} from "@/lib/tell-me/freshness";
export {
  highlightMatches,
  matchRangesFor,
  searchProjectKnowledge,
  sectionsMatchingQuery,
} from "@/lib/tell-me/knowledge-search";
export {
  computeProjectRevision,
  estimateMeaningfulChangeCount,
} from "@/lib/tell-me/revision";
export {
  questionLooksAdvisory,
  resolveTellMeScope,
} from "@/lib/tell-me/scope";
export {
  buildDeterministicSnapshot,
  refreshSnapshotWithAi,
} from "@/lib/tell-me/snapshot";
export {
  buildPersonalisedHint,
  buildSuggestedQuestions,
} from "@/lib/tell-me/suggestions";
