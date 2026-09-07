/**
 * Deliberate product-analytics catalog.
 * Behavioural metadata only — never project contents or secrets.
 */

export const ANALYTICS_EVENTS = {
  page_viewed: "page_viewed",
  landing_viewed: "landing_viewed",
  signup_started: "signup_started",
  signup_completed: "signup_completed",
  signup_check_email: "signup_check_email",
  login_completed: "login_completed",
  logout_completed: "logout_completed",
  password_reset_requested: "password_reset_requested",
  password_updated: "password_updated",
  first_project_created: "first_project_created",
  project_created: "project_created",
  capture_used: "capture_used",
  review_reached: "review_reached",
  apply_completed: "apply_completed",
  apply_needs_you: "apply_needs_you",
  billing_checkout_started: "billing_checkout_started",
} as const;

export type AnalyticsEventName =
  (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];

/** Properties the catalog is allowed to send. */
export const ALLOWED_ANALYTICS_PROPERTIES = [
  "path",
  "source",
  "surface",
  "first_run_surface",
  "has_project_scope",
  "reliability",
  "outcome",
  "domain",
  "notice",
  "billing_configured",
] as const;

export type AllowedAnalyticsProperty =
  (typeof ALLOWED_ANALYTICS_PROPERTIES)[number];

export type AnalyticsProps = Partial<
  Record<AllowedAnalyticsProperty, string | boolean | number>
>;
