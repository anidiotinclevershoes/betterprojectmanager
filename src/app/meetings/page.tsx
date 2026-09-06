import { redirect } from "next/navigation";

/**
 * Retired Meeting Prep index. Bookmarks must not paint stored Meeting.prep.
 * Home already opens the current Knowledge Centre (or New Project).
 */
export default function RetiredMeetingsRoute() {
  redirect("/");
}
