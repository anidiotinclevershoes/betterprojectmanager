import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { historyEventsForItem } from "../src/lib/knowledge-centre/item-history";
import type { MissionState } from "../src/lib/types";

const migration = readFileSync(
  "supabase/migrations/20260928163000_issue_notes_and_item_history.sql",
  "utf8",
);

assert.match(
  migration,
  /alter table public\.risks[\s\S]*add column if not exists notes text/i,
);
assert.match(migration, /add column if not exists target_kind text/i);
assert.match(migration, /add column if not exists target_id text/i);
assert.match(migration, /update_risk_with_history/i);
assert.match(migration, /set_risk_status_with_history/i);
assert.match(migration, /security invoker/i);
assert.match(migration, /is_workspace_member/i);
assert.match(migration, /project_belongs_to_workspace/i);
assert.doesNotMatch(migration, /drop\s+table\s+public\.risks/i);
assert.doesNotMatch(
  migration,
  /alter\s+column\s+notes\s+set\s+not\s+null/i,
);

const state = {
  history: [
    {
      id: "h-risk",
      type: "risk_updated",
      title: "Issue notes updated",
      detail: "Notes:\nold → new",
      projectId: "project-a",
      targetKind: "risk",
      targetId: "risk-a",
      createdAt: "2026-09-28T12:00:00.000Z",
      source: "user",
    },
    {
      id: "h-project-only",
      type: "risk_updated",
      title: "Legacy project event",
      projectId: "project-a",
      createdAt: "2026-09-27T12:00:00.000Z",
      source: "user",
    },
    {
      id: "h-other-risk",
      type: "risk_updated",
      title: "Other issue",
      projectId: "project-a",
      targetKind: "risk",
      targetId: "risk-b",
      createdAt: "2026-09-26T12:00:00.000Z",
      source: "user",
    },
  ],
} as MissionState;

const read = historyEventsForItem(state, "project-a", {
  kind: "risk",
  riskId: "risk-a",
});
assert.equal(read.attributable, true);
assert.deepEqual(
  read.events.map((event) => event.id),
  ["h-risk"],
);
assert.match(read.notice, /Earlier project-level history/i);

console.log("issue fields/history verifier: OK");
