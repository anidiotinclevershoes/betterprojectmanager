/** Sensible password rules aligned with typical Supabase defaults. */
export const PASSWORD_MIN_LENGTH = 8;

export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  return null;
}

export function passwordRequirementsCopy() {
  return `At least ${PASSWORD_MIN_LENGTH} characters.`;
}

/** Map Supabase auth errors to calm user-facing copy. */
export function friendlyAuthError(message: string | undefined | null): string {
  const raw = (message || "").toLowerCase();
  if (!raw) return "Something went wrong. Please try again.";
  if (raw.includes("invalid login") || raw.includes("invalid credentials")) {
    return "Those credentials don’t match an account.";
  }
  if (raw.includes("email not confirmed")) {
    return "Please confirm your email before signing in. Check your inbox for the link.";
  }
  if (raw.includes("already registered") || raw.includes("already been registered")) {
    return "An account with that email already exists. Try signing in.";
  }
  if (raw.includes("password")) {
    return "That password doesn’t meet the requirements. Use at least 8 characters.";
  }
  if (raw.includes("rate") || raw.includes("too many")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (raw.includes("expired") || raw.includes("otp")) {
    return "That link has expired. Request a new one.";
  }
  return "Something went wrong. Please try again.";
}
