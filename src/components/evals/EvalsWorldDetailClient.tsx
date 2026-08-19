"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { EvalWorldFixture } from "@/lib/evals/types";

export function EvalsWorldDetailClient() {
  const params = useParams();
  const worldId = String(params.worldId ?? "");
  const [world, setWorld] = useState<EvalWorldFixture | null>(null);

  useEffect(() => {
    if (!worldId) return;
    void fetch(`/api/evals/fixtures?worldId=${encodeURIComponent(worldId)}`)
      .then((r) => r.json())
      .then((data: { world?: EvalWorldFixture }) => setWorld(data.world ?? null));
  }, [worldId]);

  if (!world) {
    return <p className="evals-meta">Loading world…</p>;
  }

  return (
    <div className="evals-stack">
      <section className="evals-panel">
        <p className="evals-kicker">{world.code}</p>
        <h2>{world.name}</h2>
        <p>{world.description}</p>
        <p className="evals-meta">
          <strong>Purpose:</strong> {world.purpose}
        </p>
        <p className="evals-meta">
          Categories: {world.categories.join(", ")}
        </p>
      </section>

      <section className="evals-panel">
        <h3>Capture / stage timeline</h3>
        <ol className="evals-timeline">
          {world.stages.map((stage) => (
            <li key={stage.id}>
              <strong>{stage.label}</strong>
              <p>{stage.summary}</p>
              <details>
                <summary>Known truth at this stage</summary>
                <ul>
                  {stage.knownTruth.map((t) => (
                    <li key={t}>{t}</li>
                  ))}
                </ul>
              </details>
              <details>
                <summary>Raw captures ({stage.captureIds.length})</summary>
                {stage.captureIds.map((id) => {
                  const cap = world.captures.find((c) => c.id === id);
                  if (!cap) return null;
                  return (
                    <div key={id} className="evals-raw-block">
                      <p className="evals-meta">
                        {cap.at} — {cap.title}
                      </p>
                      <pre>{cap.content}</pre>
                    </div>
                  );
                })}
              </details>
            </li>
          ))}
        </ol>
      </section>

      <section className="evals-panel">
        <h3>Evaluation questions</h3>
        <div className="evals-table-wrap">
          <table className="evals-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Stage</th>
                <th>Question</th>
                <th>Categories</th>
              </tr>
            </thead>
            <tbody>
              {world.cases.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/evals/cases/${c.id}`}>{c.id}</Link>
                  </td>
                  <td>{c.stageId}</td>
                  <td>{c.question}</td>
                  <td className="evals-meta">{c.categories.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
