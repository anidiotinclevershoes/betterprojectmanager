"use client";

import Link from "next/link";
import { useEffect } from "react";
import { LumeLogo } from "@/components/brand/LumeLogo";
import { ANALYTICS_EVENTS, trackAnalyticsEvent } from "@/lib/analytics";
import "./public-landing.css";

/**
 * Thin public sales surface. Not a second product, not a marketing-site rewrite.
 */
export function PublicLanding() {
  useEffect(() => {
    trackAnalyticsEvent(ANALYTICS_EVENTS.landing_viewed, {
      path: "/welcome",
      surface: "welcome",
    });
  }, []);

  return (
    <div className="login-page auth-page public-landing" data-testid="public-landing">
      <div className="login-card auth-card public-landing-card">
        <div className="auth-brand">
          <LumeLogo size={28} className="auth-brand-logo" />
          <p className="auth-brand-name">lume</p>
        </div>
        <p className="eyebrow">Project memory</p>
        <h1>You can&apos;t keep an entire project in your head. Lume can.</h1>
        <p className="lede">
          Tell Lume what changed. It proposes updates. Nothing becomes project
          truth until you review it.
        </p>

        <ul className="public-landing-points">
          <li>Capture meeting notes, updates, or a few sentences.</li>
          <li>Review what Lume understood. Needs You is success when it is unsure.</li>
          <li>Apply writes the canonical project. Knowledge Centre stays current.</li>
        </ul>

        <div className="public-landing-actions">
          <Link href="/signup" className="primary-btn login-submit">
            Create an account
          </Link>
          <Link href="/login" className="ghost-btn public-landing-signin">
            Sign in
          </Link>
        </div>

        <p className="auth-next-step">
          After you confirm your email, you describe your first project. Lume
          organises a starting structure for you to review.
        </p>
      </div>
    </div>
  );
}
