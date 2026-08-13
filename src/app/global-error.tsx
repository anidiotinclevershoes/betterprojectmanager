"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[lume:global-error]", error.message);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="login-page">
          <div className="login-card">
            <p className="eyebrow">Lume</p>
            <h1>Something went wrong</h1>
            <p className="lede">
              Please try again. If this keeps happening, sign out and sign back
              in.
            </p>
            <button type="button" className="primary-btn" onClick={reset}>
              Try again
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
