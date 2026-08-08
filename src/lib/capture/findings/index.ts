export type {
  CaptureFinding,
  FindingTarget,
  FindingType,
  FindingsValidationReport,
  IndexedContextRecord,
  ProposedOperation,
} from "./types";
export { FINDING_TYPES } from "./types";
export {
  buildContextRecordIndex,
  findingMeaningLabel,
  formatContextRecordsForPrompt,
  normalizeEntityType,
  validateCaptureFindings,
} from "./validate";
export {
  mapFindingToOperation,
  mapFindingsToOperations,
} from "./map";
export {
  classifyFindingDisposition,
  dedupeProposedOperations,
  isMateriallyActionable,
  reconcileFindingCoverage,
} from "./coverage";
export type {
  FindingCoverageItem,
  FindingCoverageReport,
  FindingDisposition,
} from "./coverage";
export {
  extractLocalFindings,
  runFindingsPipeline,
} from "./pipeline";
export type { FindingsPipelineResult } from "./pipeline";
export {
  attachFindingsToResult,
  knowledgePatchFromOperations,
  recommendationsFromOperations,
} from "./toResult";
