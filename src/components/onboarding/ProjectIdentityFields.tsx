"use client";

import {
  isProjectCodeTaken,
  projectCodeTakenMessage,
  suggestCode,
} from "@/lib/create-project";

export function ProjectIdentityFields({
  name,
  code,
  onNameChange,
  onCodeChange,
  existingCodes,
  nameId = "project-name",
  codeId = "project-code",
  nameTestId,
  codeTestId,
}: {
  name: string;
  code: string;
  onNameChange: (name: string, nextCode: string) => void;
  onCodeChange: (code: string) => void;
  existingCodes: Array<{ id?: string; code: string }>;
  nameId?: string;
  codeId?: string;
  nameTestId?: string;
  codeTestId?: string;
}) {
  const derived = suggestCode(name);
  const codeTaken = Boolean(code.trim()) && isProjectCodeTaken(existingCodes, code);
  const codeNote = !code.trim()
    ? "A short identifier. Derived from the name until you edit it."
    : codeTaken
      ? ""
      : "Available. Valid is normal.";

  return (
    <div
      role="group"
      aria-label="Project identity"
      className="np-identity-group"
    >
      <div className="np-identity-name">
        <label className="field" htmlFor={nameId}>
          <span>Project name</span>
          <input
            id={nameId}
            value={name}
            onChange={(e) => {
              const nextName = e.target.value;
              onNameChange(
                nextName,
                code.trim() ? code : suggestCode(nextName),
              );
            }}
            placeholder="Aurora migration"
            autoComplete="off"
            spellCheck={false}
            data-testid={nameTestId}
          />
        </label>
      </div>
      <div className="np-identity-code">
        <label
          className={`field${codeTaken ? " is-invalid" : ""}`}
          htmlFor={codeId}
        >
          <span>Code</span>
          <input
            id={codeId}
            value={code}
            onChange={(e) =>
              onCodeChange(e.target.value.toUpperCase().slice(0, 12))
            }
            placeholder={derived || "AUR"}
            autoComplete="off"
            spellCheck={false}
            data-testid={codeTestId}
            aria-invalid={codeTaken || undefined}
          />
        </label>
        {codeTaken ? (
          <p className="np-identity-error" role="alert">
            {projectCodeTakenMessage(code)}
          </p>
        ) : (
          <p className="np-identity-meta" aria-live="polite">
            {codeNote}
          </p>
        )}
      </div>
    </div>
  );
}
