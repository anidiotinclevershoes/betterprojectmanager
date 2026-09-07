import { redirect } from "next/navigation";

/** Retired leftover Coach route. Coach is hidden in V1. */
export default function RetiredCoachingRoute() {
  redirect("/");
}
