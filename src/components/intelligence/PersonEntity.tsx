"use client";

/** Compact person entity — scoped responsibility, never global "Owner". */
export function PersonEntity({
  name,
  scope,
}: {
  name: string;
  scope?: string | null;
}) {
  return (
    <span className="lume-person-entity" title={scope ? `${name} · ${scope}` : name}>
      <span className="lume-person-at">@{name}</span>
      {scope ? <span className="lume-person-scope"> · {scope}</span> : null}
    </span>
  );
}
