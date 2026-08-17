/**
 * Structural + unit checks for the refresh hydrate session race fix.
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { waitForBrowserUser } from "../src/lib/supabase/wait-for-browser-user";

let passed = 0;
function check(name: string, fn: () => void | Promise<void>) {
  return (async () => {
    try {
      await fn();
      passed += 1;
      console.log(`✓ ${name}`);
    } catch (err) {
      console.error(`✗ ${name}`);
      throw err;
    }
  })();
}

async function main() {
  const root = path.resolve(__dirname, "..");
  const storePath = path.join(root, "src/lib/store.tsx");
  const waitPath = path.join(
    root,
    "src/lib/supabase/wait-for-browser-user.ts",
  );

  await check("wait-for-browser-user helper exists", () => {
    assert.equal(fs.existsSync(waitPath), true);
    const src = fs.readFileSync(waitPath, "utf8");
    assert.match(src, /onAuthStateChange/);
    assert.match(src, /INITIAL_SESSION/);
  });

  await check("MissionProvider waits for browser session before load", () => {
    const store = fs.readFileSync(storePath, "utf8");
    assert.match(store, /waitForBrowserUser/);
    assert.match(store, /supabase hydrate attempt/);
    assert.match(store, /hydrate recovery failed|hydrateFromSupabase/);
    // Must not silently fall through to empty local on first supabase failure
    // without retries when /api/auth/me already returned a user.
    assert.match(store, /attempt < 3/);
  });

  await check("waitForBrowserUser resolves from auth event", async () => {
    type Listener = (
      event: string,
      session: { user: { id: string } } | null,
    ) => void;
    const listeners: Listener[] = [];
    const fakeUser = { id: "user-1" };
    const client = {
      auth: {
        onAuthStateChange(cb: Listener) {
          listeners.push(cb);
          return {
            data: {
              subscription: {
                unsubscribe() {
                  const idx = listeners.indexOf(cb);
                  if (idx >= 0) listeners.splice(idx, 1);
                },
              },
            },
          };
        },
        async getUser() {
          return { data: { user: null }, error: null };
        },
        async getSession() {
          return { data: { session: null }, error: null };
        },
      },
    };

    const pending = waitForBrowserUser(client as never, {
      timeoutMs: 2000,
      pollMs: 50,
    });

    await new Promise((r) => setTimeout(r, 20));
    assert.ok(listeners.length >= 1, "subscribed before resolve");
    listeners[0]!("INITIAL_SESSION", { user: fakeUser });

    const user = await pending;
    assert.equal(user.id, "user-1");
  });

  await check("waitForBrowserUser times out without session", async () => {
    const client = {
      auth: {
        onAuthStateChange() {
          return {
            data: {
              subscription: { unsubscribe() {} },
            },
          };
        },
        async getUser() {
          return { data: { user: null }, error: null };
        },
        async getSession() {
          return { data: { session: null }, error: null };
        },
      },
    };

    await assert.rejects(
      () =>
        waitForBrowserUser(client as never, {
          timeoutMs: 120,
          pollMs: 40,
        }),
      /Timed out waiting for Supabase browser session/,
    );
  });

  console.log(`\n${passed} checks passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
