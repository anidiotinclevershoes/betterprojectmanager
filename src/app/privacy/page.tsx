import { AuthLinkRow, AuthNavLink, AuthShell } from "@/components/auth/AuthShell";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/support";

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
        <p>
          Signed-in users can download a JSON export of their workspace from
          Account, and can delete their hosted account from the same page.
        </p>
        <p className="meta">
          A reviewed legal privacy policy is still required before inviting
          people who are not already trusted testers. Contact{" "}
          <a className="auth-text-link" href={SUPPORT_MAILTO}>
            {SUPPORT_EMAIL}
          </a>{" "}
          with privacy questions until that policy is inserted below.
        </p>
      </div>
      <div className="account-block">
        <p className="meta">Lawyer-reviewed policy</p>
        <p>
          Not yet inserted. Tom — legal review required. Do not treat the
          paragraphs above as a finished privacy notice.
        </p>
      </div>
    </AuthShell>
  );
}
