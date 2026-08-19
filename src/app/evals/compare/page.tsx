import { Suspense } from "react";
import { EvalsCompareClient } from "@/components/evals/EvalsCompareClient";

export default function EvalsComparePage() {
  return (
    <Suspense fallback={<p className="evals-meta">Loading compare…</p>}>
      <EvalsCompareClient />
    </Suspense>
  );
}
