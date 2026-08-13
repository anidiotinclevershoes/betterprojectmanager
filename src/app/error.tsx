"use client";

import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[lume:app-error]", error.message);
  }, [error]);

  return (
    <div className="login-page">
      <div className="login-card">
        <p className="eyebrow">Lume</p>
        <h1>Something went wrong</h1>
        <p className="lede">
          We hit a problem loading this screen. Your data should still be safe.
        </p>
        <button type="button" className="primary-btn" onClick={reset}>
          Try again
        </button>
      </div>
    </div>
  );
}
