/**
 * Presentation for one Home To Do row.
 *
 * Adapted from Figma Make file JjbPFessL9ow9nKYCxc8Vn (faithful variant).
 * Reads canonical To Do fields only. Does not persist, and does not invent
 * priority, urgency, or an owner.
 */
import type { TodoItem } from "@/lib/types";

export type HomeTodoDensity = "comfortable" | "compact";

export type HomeTodoRowSource = Pick<
  TodoItem,
  "id" | "title" | "dueAt" | "done" | "waitingOn"
>;

/** Calendar relation of a stored due instant. Not a priority. */
export type HomeTodoDueTone = "today" | "overdue" | "later";

export type HomeTodoRowModel = {
  id: string;
  title: string;
  dueLabel: string | null;
  dueTone: HomeTodoDueTone | null;
  tags: string[];
  /** Legacy single waiting-on string. Not a resolved person. */
  waitingOn: string | null;
  done: boolean;
};

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/** Same 24-hour window as `daysUntil` in selectors, with an injected clock. */
export function homeTodoDaysUntil(
  iso: string | undefined,
  now: number,
): number | null {
  if (!iso) return null;
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return null;
  return Math.ceil((then - now) / 86400000);
}

function utcCalendarLabel(iso: string): string | null {
  const then = new Date(iso);
  if (!Number.isFinite(then.getTime())) return null;
  return `${then.getUTCDate()} ${MONTHS[then.getUTCMonth()]}`;
}

export function homeTodoRowModel(args: {
  todo: HomeTodoRowSource;
  /** Retrieval tags already attached to this To Do. Omitted means none. */
  tagLabels?: readonly string[];
  now?: number;
}): HomeTodoRowModel {
  const now = args.now ?? Date.now();
  const dueAt = args.todo.dueAt;
  const days = homeTodoDaysUntil(dueAt, now);
  let dueLabel: string | null = null;
  let dueTone: HomeTodoDueTone | null = null;

  if (dueAt && days !== null) {
    const when = utcCalendarLabel(dueAt);
    if (days < 0) {
      dueTone = "overdue";
      dueLabel = when ? `Overdue · ${when}` : "Overdue";
    } else if (days === 0) {
      dueTone = "today";
      dueLabel = "Due today";
    } else {
      dueTone = "later";
      dueLabel = when ? `Due ${when}` : null;
    }
  }

  const waiting = args.todo.waitingOn?.trim() ?? "";
  const tags = (args.tagLabels ?? [])
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);

  return {
    id: args.todo.id,
    title: args.todo.title,
    dueLabel,
    dueTone,
    tags,
    waitingOn: waiting.length > 0 ? waiting : null,
    done: args.todo.done,
  };
}
