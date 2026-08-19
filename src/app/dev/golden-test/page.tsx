import { notFound } from "next/navigation";
import { GoldenTestClient } from "@/components/dev/GoldenTestClient";
import { listGoldenScenarios } from "@/lib/dev/golden";

export const dynamic = "force-dynamic";

export default async function GoldenTestPage({
  searchParams,
}: {
  searchParams?: Promise<{ scenario?: string }>;
}) {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const params = (await searchParams) ?? {};
  const scenarios = listGoldenScenarios();
  return (
    <GoldenTestClient
      scenarios={scenarios}
      initialScenarioId={params.scenario}
    />
  );
}
