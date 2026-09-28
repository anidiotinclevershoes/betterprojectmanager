import {
  LUME_DOMAIN_ICON_SRC,
  type LumeDomain,
} from "@/lib/domain/lume-domain";
import "./domain-identity.css";

/** Page 09 canonical 22px domain icon. Callers pass a domain, not a colour. */
export function DomainIcon({ domain }: { domain: LumeDomain }) {
  return (
    <span
      className="lume-domain-icon"
      data-domain={domain}
      data-testid={`lume-domain-icon-${domain}`}
      aria-hidden
    >
      <img src={LUME_DOMAIN_ICON_SRC[domain]} alt="" width={15} height={15} />
    </span>
  );
}

/**
 * Page 09 signed domain badge. Home and Knowledge Centre sections use the
 * icon plus a neutral heading, not this badge.
 */
export function DomainBadge({
  domain,
  label,
}: {
  domain: LumeDomain;
  label: string;
}) {
  return (
    <span className="lume-domain-badge" data-domain={domain}>
      <DomainIcon domain={domain} />
      {label}
    </span>
  );
}
