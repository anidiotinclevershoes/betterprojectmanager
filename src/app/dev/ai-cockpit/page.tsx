import { notFound } from "next/navigation";
import { AiCockpitClient } from "@/components/dev/AiCockpitClient";

export const dynamic = "force-dynamic";

export default function AiCockpitPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }
  return <AiCockpitClient />;
}
