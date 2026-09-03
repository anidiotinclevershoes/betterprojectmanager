export type {
  CaptureApplyDecision,
  CaptureApplyWorld,
  CaptureConfirmOwnerRequest,
  CaptureLegalDomain,
  CaptureLegalOperation,
  OwnershipSemantics,
  PlanCaptureApplyInput,
} from "./types";
export {
  CAPTURE_LEGAL_DOMAINS,
  OWNERSHIP_SEMANTICS,
  assertNever,
  hasInvalidOwnershipSemantics,
  isCaptureLegalDomain,
  isOwnershipSemantics,
} from "./types";
export { classifyCaptureLegalDomain } from "./classify";
export {
  applySupportsOperation,
  hasStructuredCessationSignal,
  isApplyExecutableSuggestion,
  unsupportedApplyReason,
} from "./executability";
export {
  SANCTIONED_NORMALIZATIONS,
  assessApplyReadiness,
  attachReviewExpectedTarget,
  isSemanticallyRepresentableSuggestion,
  writeRepresentsProposal,
  type ApplyReadinessVerdict,
  type ReviewPreflightContext,
} from "./readiness";
export { resolveCaptureProjectScope } from "./project-scope";
export { planCaptureApply, bindResolvedReplacement, currentOwners } from "./dispatch";
export { reviewedCreateIdentity } from "./reviewed-identity";
export { captureApplyWorldFromState } from "./world";
export {
  executeCaptureApply,
  type CaptureApplyHooks,
  type CaptureExecuteResult,
} from "./execute";
export {
  applySessionSuggestionPatch,
  expectedTargetMismatchReason,
  fingerprintExpectedTarget,
  parseExpectedTarget,
  proposalTargetId,
  reconcileExpectedTarget,
  staleExpectedTargetReason,
  type CaptureExpectedTarget,
} from "./expected-target";
