/**
 * Confirm scoped responsibility owner — pure state patch (no AI).
 * Slice 1C: implementation lives in `@/lib/people/identity` (UUID person +
 * shared/time-varying ownership). This module re-exports for existing imports.
 */
export {
  confirmResponsibilityOwner,
  findConfirmedOwner,
  findConfirmedOwners,
  getPersonBundle,
  ensurePersonOnProject,
  findStakeholderInProject,
  normalisePersonName,
  namesMatchExact,
  scopesMatchExact,
  newPeopleUuid,
  type ConfirmResponsibilityOwnerInput,
  type ConfirmResponsibilityOwnerResult,
  type ConfirmedOwnerHit,
  type PersonBundle,
  type AvailabilityMeta,
} from "@/lib/people/identity";
