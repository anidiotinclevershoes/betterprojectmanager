import { AuthLinkRow, AuthNavLink, AuthShell } from "@/components/auth/AuthShell";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/support";

export default function SupportPage() {
  return (
    <AuthShell
      title="Support"
      lede="If something is stuck, start here."
      footer={
        <>
          <AuthLinkRow>
            <AuthNavLink href="/login">Sign in</AuthNavLink>
          </AuthLinkRow>
          <AuthLinkRow>
            <AuthNavLink href="/forgot-password">Reset password</AuthNavLink>
          </AuthLinkRow>
        </>
      }
    >
      <div className="account-block">
        <p>No confirmation email? Check spam, then try signing in again.</p>
        <p>Reset link expired? Request a new one. Old links are refused.</p>
        <p>
          Cannot open a project? Sign out and sign in again. A short loading
          screen during the switch is expected.
        </p>
        <p>
          Email{" "}
          <a className="auth-text-link" href={SUPPORT_MAILTO}>
            {SUPPORT_EMAIL}
          </a>{" "}
          if you still need help. This is the early-access inbox, not a ticket
          system.
        </p>
      </div>
    </AuthShell>
  );
}
