import { notFound } from "next/navigation";
import { ResetPreviewClient } from "@/components/dev/ResetPreviewClient";

export const dynamic = "force-dynamic";

/** Development-only preview of the Reset demo data confirmation dialog. */
export default function ResetPreviewPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }
  return <ResetPreviewClient />;
}
