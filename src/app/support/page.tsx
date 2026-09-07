import { AuthLinkRow, AuthNavLink, AuthShell } from "@/components/auth/AuthShell";

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
        <p className="meta">
          If you were invited, ask the person who invited you. Lume does not
          publish a public support inbox in the product yet.
        </p>
      </div>
    </AuthShell>
  );
}
