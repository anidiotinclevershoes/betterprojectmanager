/** People-frame display line. Responsibilities stay visible when present. */
export function composePersonLine(person: {
  name: string;
  role?: string;
  responsibilities?: string[];
}): string {
  const scopes = (person.responsibilities ?? [])
    .map((scope) => scope.trim())
    .filter(Boolean);
  const role = person.role?.trim();
  const extra =
    scopes.length > 0
      ? scopes.join(", ")
      : role && role.toLowerCase() !== "stakeholder"
        ? role
        : "";
  return extra ? `${person.name} — ${extra}` : person.name;
}
