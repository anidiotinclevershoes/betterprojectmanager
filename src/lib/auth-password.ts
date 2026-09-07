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
  if (
    raw.includes("already registered") ||
    raw.includes("already been registered") ||
    raw.includes("user already exists") ||
    raw.includes("already exists")
  ) {
    return "An account with that email already exists. Try signing in.";
  }
  if (raw.includes("same as the old") || raw.includes("different from the old")) {
    return "Choose a password you have not used before.";
  }
  if (raw.includes("reset link") || raw.includes("invalid or expired")) {
    return "That link is invalid or has expired. Request a new reset email.";
  }
  if (
    raw.includes("password should be") ||
    raw.includes("password is known") ||
    raw.includes("least 8") ||
    raw.includes("weak password")
  ) {
    return "That password doesn’t meet the requirements. Use at least 8 characters.";
  }
  if (raw.includes("rate") || raw.includes("too many")) {
    return "Too many attempts. Please wait a moment and try again.";
  }
  if (raw.includes("expired") || raw.includes("otp") || raw.includes("token has expired")) {
    return "That link has expired. Request a new one.";
  }
  return "Something went wrong. Please try again.";
}
