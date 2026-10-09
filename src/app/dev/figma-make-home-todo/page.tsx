import { notFound } from "next/navigation";
import { HomeTodoPreview } from "@/components/home/HomeTodoPreview";

export const dynamic = "force-dynamic";

/** Development-only spike for the faithful Make Home To Do row. */
export default function FigmaMakeHomeTodoPage() {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  return (
    <div className="ocean-project-page" data-testid="figma-make-home-todo-page">
      <h1 style={{ fontSize: 17, margin: "0 0 8px" }}>Home To Do row</h1>
      <HomeTodoPreview />
    </div>
  );
}
