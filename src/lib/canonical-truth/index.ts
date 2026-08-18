export { isCanonicalTruthEnabled } from "@/lib/canonical-truth/flag";
export {
  serializeCanonicalTruth,
  deriveLegacyStructured,
} from "@/lib/canonical-truth/serialize";
export {
  confirmResponsibilityOwner,
  findConfirmedOwner,
} from "@/lib/canonical-truth/confirm-responsibility";
export {
  buildCanonicalSuggestions,
  CANONICAL_SUGGESTIONS_NO_AI,
} from "@/lib/canonical-truth/suggestions";
export type {
  CanonicalTruthItem,
  CanonicalTruthBundle,
  EpistemicStatus,
  LifecycleStatus,
  NeedsConfirmationItem,
} from "@/lib/canonical-truth/types";
