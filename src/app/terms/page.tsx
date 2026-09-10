import { AuthLinkRow, AuthNavLink, AuthShell } from "@/components/auth/AuthShell";

export default function TermsPage() {
  return (
    <AuthShell
      title="Terms"
      lede="Lume is currently offered as controlled early access. This is not a finished legal agreement."
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
        <p>
          Billing is not required during early access. Checkout stays off until
          the owner turns billing on in the hosted environment.
        </p>
        <p className="meta">
          Commercial terms for paying customers still need an owner and lawyer
          decision. Do not treat this page as a contract.
        </p>
      </div>
      <div className="account-block">
        <p className="meta">Lawyer-reviewed terms</p>
        <p>
          Not yet inserted. Tom — legal review required before unpaid strangers
          are invited.
        </p>
      </div>
    </AuthShell>
  );
}
