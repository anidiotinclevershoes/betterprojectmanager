import { notFound } from "next/navigation";
import { ReviewWorkspacePreviewClient } from "@/components/dev/ReviewWorkspacePreviewClient";

export const dynamic = "force-dynamic";

/** Development-only preview of the Capture review workspace. */
export default function ReviewPreviewPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }
  return <ReviewWorkspacePreviewClient />;
}
