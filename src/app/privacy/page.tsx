import { AuthLinkRow, AuthNavLink, AuthShell } from "@/components/auth/AuthShell";

export default function PrivacyPage() {
  return (
    <AuthShell
      title="Privacy"
      lede="How Lume treats project memory today. This is a product description, not a lawyer-reviewed policy."
      footer={
        <>
          <AuthLinkRow>
            <AuthNavLink href="/support">Support</AuthNavLink>
          </AuthLinkRow>
          <AuthLinkRow>
              <AuthNavLink href="/welcome">What is Lume?</AuthNavLink>
          </AuthLinkRow>
        </>
      }
    >
      <div className="account-block">
        <p>
          Project notes, Capture text, Knowledge, and meeting facts live in your
          signed-in Lume workspace. Other accounts cannot read them.
        </p>
        <p>
          Product analytics, when enabled, records only behavioural events such
          as “signed up” or “Capture used”. It must not receive project contents,
          passwords, or session tokens.
        </p>
        <p className="meta">
          A reviewed legal privacy policy is still required before inviting
          people who are not already trusted testers.
        </p>
      </div>
    </AuthShell>
  );
}
