import { notFound } from "next/navigation";
import { GoldenTestClient } from "@/components/dev/GoldenTestClient";
import { listGoldenScenarios } from "@/lib/dev/golden";

export const dynamic = "force-dynamic";

export default function GoldenTestPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const scenarios = listGoldenScenarios();
  return <GoldenTestClient scenarios={scenarios} />;
}
