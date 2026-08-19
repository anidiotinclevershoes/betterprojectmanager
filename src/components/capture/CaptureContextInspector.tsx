"use client";

import { useState } from "react";
import type { CaptureContextManifest } from "@/lib/capture/context";

/** Development-only inspector for Phase 1 context + Phase 1.5 prompt assembly. */
export function CaptureContextInspector({
  manifest,
}: {
  manifest: CaptureContextManifest | null | undefined;
}) {
  const [open, setOpen] = useState(false);

  if (process.env.NODE_ENV !== "development") return null;
  if (!manifest) return null;

  const projectLabel =
    manifest.projectCode ||
    manifest.projectName ||
    (manifest.projectId ? manifest.projectId : "None");

  const prompt = manifest.promptAssembly;

  return (
    <>
      <button
        type="button"
        className="ghost-btn capture-context-btn"
        onClick={() => setOpen(true)}
        title="Development: inspect Capture project context"
      >
        Context used
      </button>
      {open ? (
        <div
          className="capture-context-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Capture context used"
        >
          <button
            type="button"
            className="capture-context-backdrop"
            aria-label="Close"
            onClick={() => setOpen(false)}
          />
          <div className="capture-context-panel">
            <header className="capture-context-head">
              <div>
                <p className="eyebrow">Development</p>
                <h3>Context used</h3>
              </div>
              <button
                type="button"
                className="ghost-btn"
                onClick={() => setOpen(false)}
              >
                Close
              </button>
            </header>

            <dl className="capture-context-meta">
              <div>
                <dt>Project</dt>
                <dd>{projectLabel}</dd>
              </div>
              <div>
                <dt>Built at</dt>
                <dd>{new Date(manifest.builtAt).toLocaleString()}</dd>
              </div>
              <div>
                <dt>Records</dt>
                <dd>{manifest.records.length}</dd>
              </div>
              <div>
                <dt>Approx size</dt>
                <dd>
                  {manifest.approximateCharacterCount.toLocaleString()} chars
                </dd>
              </div>
              {manifest.requestId ? (
                <div>
                  <dt>Request ID</dt>
                  <dd className="mono">{manifest.requestId}</dd>
                </div>
              ) : null}
            </dl>

            {prompt ? (
              <>
                <h4>Prompt sections</h4>
                <ul className="capture-context-counts">
                  {prompt.sections.map((s) => (
                    <li key={s.id}>
                      <span>{s.label}</span>
                      <span>{s.present ? "✓" : "✗"}</span>
                    </li>
                  ))}
                </ul>
                <dl className="capture-context-meta">
                  <div>
                    <dt>Prompt chars</dt>
                    <dd>{prompt.approximateCharacters.toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt>Est. tokens</dt>
                    <dd>{prompt.estimatedTokens.toLocaleString()}</dd>
                  </div>
                  <div>
                    <dt>Context records</dt>
                    <dd>{prompt.contextRecordCount}</dd>
                  </div>
                  <div>
                    <dt>Dictionary entries</dt>
                    <dd>{prompt.dictionaryEntryCount}</dd>
                  </div>
                </dl>
              </>
            ) : null}

            <h4>Counts by type</h4>
            <ul className="capture-context-counts">
              {Object.entries(manifest.counts).map(([label, count]) => (
                <li key={label}>
                  <span>{label}</span>
                  <span>{count}</span>
                </li>
              ))}
            </ul>

            {manifest.limitsReached.length ? (
              <>
                <h4>Context limit reached</h4>
                <ul className="capture-context-limits">
                  {manifest.limitsReached.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="meta">No configured limits were reached.</p>
            )}

            <h4>Included records</h4>
            <ul className="capture-context-records">
              {manifest.records.length === 0 ? (
                <li className="meta">No project context records.</li>
              ) : (
                manifest.records.map((r) => (
                  <li key={`${r.type}-${r.id}`}>
                    <span className="tag">{r.type}</span>
                    <span className="capture-context-title">{r.title}</span>
                    <span className="meta mono">{r.id}</span>
                    {r.status ? <span className="meta">{r.status}</span> : null}
                    {r.date ? (
                      <span className="meta">{r.date.slice(0, 10)}</span>
                    ) : null}
                  </li>
                ))
              )}
            </ul>

            {manifest.excludedByLimit.length ? (
              <>
                <h4>Excluded by limit</h4>
                <ul className="capture-context-records">
                  {manifest.excludedByLimit.map((r) => (
                    <li key={`ex-${r.bucket}-${r.id}`}>
                      <span className="tag">{r.bucket}</span>
                      <span className="capture-context-title">{r.title}</span>
                      <span className="meta mono">{r.id}</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
