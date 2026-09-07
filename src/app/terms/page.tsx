import { AuthLinkRow, AuthNavLink, AuthShell } from "@/components/auth/AuthShell";

export default function TermsPage() {
  return (
    <AuthShell
      title="Terms"
      lede="Lume is currently offered to invited testers. This is not a finished legal agreement."
      footer={
        <>
          <AuthLinkRow>
            <AuthNavLink href="/privacy">Privacy</AuthNavLink>
          </AuthLinkRow>
          <AuthLinkRow>
            <AuthNavLink href="/support">Support</AuthNavLink>
          </AuthLinkRow>
        </>
      }
    >
      <div className="account-block">
        <p>
          Use Lume only if you were invited. Do not store secrets you are not
          allowed to keep in a project-memory tool.
        </p>
        <p className="meta">
          Commercial terms for paying strangers still need an owner decision
          before public launch.
        </p>
      </div>
    </AuthShell>
  );
}
