/**
 * D-036 — same-browser logout/login must not render the previous user's truth.
 *
 * Reproduces the live sequence as a pure ownership transition, then checks
 * that login/logout force a document remount and MissionProvider does not
 * ignore SIGNED_IN after the first hydrate.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { emptyMissionState } from "../src/lib/data/supabase/load-mission-state";
import {
  missionAuthTransition,
  missionStateContainsMarkers,
  safeAuthNextPath,
} from "../src/lib/auth-mission-ownership";
import type { MissionState } from "../src/lib/types";

let passed = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}`);
    throw err;
  }
}

const B_MARKERS = [
  "TENANT-B Redwood Archive",
  "Brian Boundary",
  "Digitise red ledger",
  "Scanner procurement delay",
] as const;

const A_MARKERS = [
  "TENANT-A Lighthouse Launch",
  "Alice Isolation",
  "Order blue lighthouse lens",
] as const;

function tenantBState(): MissionState {
  const empty = emptyMissionState();
  return {
    ...empty,
    projects: [
      {
        id: "2b691efb-765f-492f-8728-a4ac2ee0e0e4",
        name: "TENANT-B Redwood Archive",
        code: "TBR",
        summary: "Archive opening",
        status: "watch",
        currentFocus: "Digitise red ledger",
        stakeholders: [
          {
            id: "person-b",
            name: "Brian Boundary",
            role: "Lead",
          },
        ],
      },
    ],
    todos: [
      {
        id: "todo-b",
        projectId: "2b691efb-765f-492f-8728-a4ac2ee0e0e4",
        title: "Digitise red ledger",
        done: false,
        createdAt: "2026-08-28T00:00:00.000Z",
      },
    ],
    risks: [
      {
        id: "risk-b",
        projectId: "2b691efb-765f-492f-8728-a4ac2ee0e0e4",
        title: "Scanner procurement delay",
        status: "open",
      },
    ],
  };
}

function tenantAState(): MissionState {
  const empty = emptyMissionState();
  return {
    ...empty,
    projects: [
      {
        id: "a84a7601-ecdb-4e01-bf67-137ab83acb19",
        name: "TENANT-A Lighthouse Launch",
        code: "TAL",
        summary: "Beacon",
        status: "healthy",
        currentFocus: "Order blue lighthouse lens",
        stakeholders: [
          {
            id: "person-a",
            name: "Alice Isolation",
            role: "Lead",
          },
        ],
      },
    ],
    todos: [
      {
        id: "todo-a",
        projectId: "a84a7601-ecdb-4e01-bf67-137ab83acb19",
        title: "Order blue lighthouse lens",
        done: false,
        createdAt: "2026-08-28T00:00:00.000Z",
      },
    ],
  };
}

type Owned = { ownerUserId: string | null; state: MissionState };

function apply(
  current: Owned,
  event: string,
  sessionUserId: string | null,
): Owned & { action: ReturnType<typeof missionAuthTransition> } {
  const action = missionAuthTransition({
    event,
    sessionUserId,
    ownerUserId: current.ownerUserId,
  });
  if (action === "keep") return { ...current, action };
  return { ownerUserId: null, state: emptyMissionState(), action };
}

check("B loaded then SIGNED_OUT clears B facts", () => {
  let owned: Owned = { ownerUserId: "user-b", state: tenantBState() };
  assert.equal(missionStateContainsMarkers(owned.state, B_MARKERS), true);

  const afterLogout = apply(owned, "SIGNED_OUT", null);
  assert.equal(afterLogout.action, "reset");
  assert.equal(afterLogout.ownerUserId, null);
  assert.equal(afterLogout.state.projects.length, 0);
  assert.equal(afterLogout.state.todos.length, 0);
  assert.equal(missionStateContainsMarkers(afterLogout.state, B_MARKERS), false);
  owned = afterLogout;
});

check("SIGNED_IN as A after B does not keep B truth", () => {
  const afterB = apply(
    { ownerUserId: "user-b", state: tenantBState() },
    "SIGNED_OUT",
    null,
  );
  const switching = apply(afterB, "SIGNED_IN", "user-a");
  assert.equal(switching.action, "reset-and-hydrate");
  assert.equal(missionStateContainsMarkers(switching.state, B_MARKERS), false);
  assert.equal(switching.state.projects.length, 0);

  const hydratedA: Owned = { ownerUserId: "user-a", state: tenantAState() };
  assert.equal(missionStateContainsMarkers(hydratedA.state, A_MARKERS), true);
  assert.equal(missionStateContainsMarkers(hydratedA.state, B_MARKERS), false);
});

check("SIGNED_IN as A while B is still owner resets without waiting for SIGNED_OUT", () => {
  const leakedSpaLogin = apply(
    { ownerUserId: "user-b", state: tenantBState() },
    "SIGNED_IN",
    "user-a",
  );
  assert.equal(leakedSpaLogin.action, "reset-and-hydrate");
  assert.equal(missionStateContainsMarkers(leakedSpaLogin.state, B_MARKERS), false);
  assert.equal(leakedSpaLogin.state.projects.length, 0);
});

check("same-user TOKEN_REFRESHED does not reset", () => {
  const same = apply(
    { ownerUserId: "user-a", state: tenantAState() },
    "TOKEN_REFRESHED",
    "user-a",
  );
  assert.equal(same.action, "keep");
  assert.equal(missionStateContainsMarkers(same.state, A_MARKERS), true);
});

check("A then B symmetric switch", () => {
  const afterA = apply(
    { ownerUserId: "user-a", state: tenantAState() },
    "SIGNED_IN",
    "user-b",
  );
  assert.equal(afterA.action, "reset-and-hydrate");
  assert.equal(missionStateContainsMarkers(afterA.state, A_MARKERS), false);
});

check("safeAuthNextPath rejects open redirects", () => {
  assert.equal(safeAuthNextPath("/projects/abc"), "/projects/abc");
  assert.equal(safeAuthNextPath("//evil.example"), "/");
  assert.equal(safeAuthNextPath("https://evil.example"), "/");
  assert.equal(safeAuthNextPath(null), "/");
});

const root = path.resolve(__dirname, "..");

check("login/logout/signup use a document navigation auth boundary", () => {
  const login = fs.readFileSync(path.join(root, "src/app/login/page.tsx"), "utf8");
  const shell = fs.readFileSync(
    path.join(root, "src/components/AppShell.tsx"),
    "utf8",
  );
  const account = fs.readFileSync(
    path.join(root, "src/app/account/page.tsx"),
    "utf8",
  );
  const signup = fs.readFileSync(
    path.join(root, "src/app/signup/page.tsx"),
    "utf8",
  );
  assert.match(login, /navigateAuthBoundary/);
  assert.doesNotMatch(login, /router\.replace\(next/);
  assert.match(shell, /navigateAuthBoundary/);
  assert.match(account, /navigateAuthBoundary/);
  assert.match(signup, /navigateAuthBoundary/);
});

check("MissionProvider rehydrates on user change even after first hydrate", () => {
  const store = fs.readFileSync(path.join(root, "src/lib/store.tsx"), "utf8");
  assert.match(store, /missionAuthTransition/);
  assert.match(store, /reset-and-hydrate/);
  assert.doesNotMatch(
    store,
    /cancelled \|\| hydrateSucceeded \|\| !session\?\.user/,
  );
  assert.match(store, /cachePaintAllowedForUser/);
  assert.match(store, /writeHydratedAuthUserId/);
});

check("session cleanup clears hydrated-user ownership key", () => {
  const cleanup = fs.readFileSync(
    path.join(root, "src/lib/session-cleanup.ts"),
    "utf8",
  );
  assert.match(cleanup, /lume-hydrated-auth-user-id/);
});

console.log(`\n${passed} D-036 session-switch checks passed`);
