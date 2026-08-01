import { notFound } from "next/navigation";
import { ReliabilityPreviewClient } from "@/components/dev/ReliabilityPreviewClient";

export const dynamic = "force-dynamic";

/** Development-only preview of Capture reliability notice states. */
export default function ReliabilityPreviewPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }
  return <ReliabilityPreviewClient />;
}
