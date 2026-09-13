/**
 * Family F — mounted V1 edits must persist-first.
 *
 * If persistence fails, the UI must not leave a plausible durable-success
 * state. No offline-sync architecture.
 *
 * Run: npx tsx scripts/verify-mounted-persist-trust.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const store = readFileSync(join(process.cwd(), "src/lib/store.tsx"), "utf8");

let passed = 0;
function check(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

function functionBody(name: string): string {
  const start = store.indexOf(`const ${name} = useCallback`);
  assert.ok(start >= 0, `${name} must exist`);
  return store.slice(start, start + 8000);
}

function supabaseBlock(body: string): string {
  const idx = body.indexOf('meta.mode === "supabase"');
  assert.ok(idx >= 0, "supabase persist branch required");
  return body.slice(idx);
}

for (const name of [
  "toggleTodo",
  "removeTodo",
  "updateTodo",
  "setRiskStatus",
  "updateKnowledgeSection",
  "addKnowledgeBullet",
  "setKnowledgeOnlyRiskResolved",
  "replaceKnowledge",
  "confirmResponsibilityOwner",
]) {
  check(`${name} paints only after persist in supabase mode`, () => {
    const block = supabaseBlock(functionBody(name));
    const persistAt = block.search(
      /await persist(TodoUpdate|TodoDelete|RiskStatus|KnowledgeReconcile|KnowledgeBullet|EnsureStakeholder)/,
    );
    const paintAt = block.indexOf("applyLocal()");
    assert.ok(persistAt >= 0, `${name} must persist`);
    assert.ok(paintAt >= 0, `${name} must paint via applyLocal`);
    assert.ok(persistAt < paintAt, `${name} must persist before paint`);
    assert.match(block, /reportPersistFailure/);
  });
}

console.log(`\n${passed} checks passed`);
