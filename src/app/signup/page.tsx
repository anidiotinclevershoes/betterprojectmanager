"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import {
  AuthLinkRow,
  AuthNavLink,
  AuthShell,
} from "@/components/auth/AuthShell";
import {
  friendlyAuthError,
  passwordRequirementsCopy,
  validatePassword,
} from "@/lib/auth-password";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const pwError = validatePassword(password);
    if (pwError) {
      setError(pwError);
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = (await response.json()) as {
        error?: string;
        needsEmailConfirmation?: boolean;
      };
      if (!response.ok) {
        throw new Error(friendlyAuthError(data.error));
      }
      if (data.needsEmailConfirmation) {
        setCheckEmail(true);
        return;
      }
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create account");
    } finally {
      setBusy(false);
    }
  }

  if (checkEmail) {
    return (
      <AuthShell
        title="Check your email"
        lede={`We've sent a confirmation link to ${email}.`}
        footer={
          <AuthLinkRow>
            Already confirmed? <AuthNavLink href="/login">Sign in</AuthNavLink>
          </AuthLinkRow>
        }
      >
        <p className="auth-notice" role="status">
          Open the link in that email, then come back and sign in. Next you
          describe the project — Lume organises a starting structure for you to
          review.
        </p>
        <p className="auth-next-step">
          No email yet? Check spam, or ask whoever invited you.
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create account"
      lede="Start a personal Lume workspace. After you confirm your email, you can describe your first project."
      footer={
        <AuthLinkRow>
          Already have an account?{" "}
          <AuthNavLink href="/login">Sign in</AuthNavLink>
        </AuthLinkRow>
      }
    >
      <form onSubmit={onSubmit} className="login-form">
        <label className="field">
          <span>Name</span>
          <input
            type="text"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your name"
            required
          />
        </label>
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            minLength={8}
          />
          <span className="field-hint">{passwordRequirementsCopy()}</span>
        </label>

        {error ? <p className="login-error">{error}</p> : null}

        <button type="submit" className="primary-btn login-submit" disabled={busy}>
          {busy ? "Creating account…" : "Create account"}
        </button>
      </form>
    </AuthShell>
  );
}
