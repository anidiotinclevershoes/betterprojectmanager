import type { ReactNode } from "react";

export function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel flex flex-col ${className}`}>
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 md:px-5">
        <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-soft">
          {title}
        </h2>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="flex-1 p-4 md:p-5">{children}</div>
    </section>
  );
}

export function StatTile({
  label,
  value,
  hint,
  tone = "default",
  className = "",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "signal" | "teal" | "watch";
  className?: string;
}) {
  const valueColor =
    tone === "signal"
      ? "text-signal"
      : tone === "teal"
        ? "text-teal"
        : tone === "watch"
          ? "text-amber-600"
          : "text-ink";

  return (
    <div className={`panel px-4 py-4 md:px-5 ${className}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-soft">
        {label}
      </p>
      <p className={`stat-value mt-3 text-3xl md:text-4xl ${valueColor}`}>
        {value}
      </p>
      {hint ? (
        <p className="mt-2 text-sm leading-snug text-ink-soft">{hint}</p>
      ) : null}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-teal">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="brand-mark mt-1 text-2xl font-extrabold tracking-tight md:text-3xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1.5 max-w-2xl text-sm text-ink-soft md:text-[15px]">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function StatusPill({
  status,
}: {
  status: "healthy" | "watch" | "at_risk";
}) {
  const styles = {
    healthy: "bg-teal-soft text-teal",
    watch: "bg-amber-100 text-amber-800",
    at_risk: "bg-signal-soft text-signal",
  } as const;
  const labels = {
    healthy: "Healthy",
    watch: "Watch",
    at_risk: "At risk",
  } as const;

  return (
    <span
      className={`rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}
