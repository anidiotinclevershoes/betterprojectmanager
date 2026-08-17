"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { EvalWorldFixture } from "@/lib/evals/types";

export function EvalsWorldsClient() {
  const [worlds, setWorlds] = useState<EvalWorldFixture[]>([]);
  const [label, setLabel] = useState("");

  useEffect(() => {
    void fetch("/api/evals/fixtures")
      .then((r) => r.json())
      .then((data: { active?: { label: string; worlds: EvalWorldFixture[] } }) => {
        setWorlds(data.active?.worlds ?? []);
        setLabel(data.active?.label ?? "");
      });
  }, []);

  return (
    <div className="evals-stack">
      <section className="evals-panel">
        <h2>Project Worlds</h2>
        <p className="evals-meta">{label}</p>
        <div className="evals-card-grid">
          {worlds.map((w) => (
            <article key={w.id} className="evals-card">
              <p className="evals-kicker">{w.code}</p>
              <h3>
                <Link href={`/evals/worlds/${w.id}`}>{w.name}</Link>
              </h3>
              <p>{w.description}</p>
              <p className="evals-meta">
                {w.stages.length} stages · {w.cases.length} questions ·{" "}
                {w.captures.length} captures
              </p>
              <p className="evals-meta">Purpose: {w.purpose}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
