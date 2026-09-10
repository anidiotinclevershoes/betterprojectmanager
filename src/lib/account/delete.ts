/** Exact phrase the signed-in user must type to delete their account. */
export const DELETE_CONFIRMATION = "DELETE MY ACCOUNT";

export function isAccountDeleteConfirmation(value: unknown): boolean {
  return typeof value === "string" && value.trim() === DELETE_CONFIRMATION;
}
