/**
 * Desert theme — token architecture, Settings switch, persistence.
 * Does not fork components.
 *
 * Run: npx tsx scripts/verify-desert-theme.ts
 */
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import {
  appearanceToTheme,
  themeToDataset,
  themeToStorage,
} from "../src/lib/appearance";

function check(name: string, fn: () => void) {
  fn();
  console.log(`✓ ${name}`);
}

function walkTsx(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walkTsx(full, acc);
    else if (/\.(tsx|ts|css)$/.test(name)) acc.push(full);
  }
  return acc;
}

function main() {
  const globals = readFileSync("src/app/globals.css", "utf8");
  const appearance = readFileSync("src/lib/appearance.tsx", "utf8");
  const layout = readFileSync("src/app/layout.tsx", "utf8");
  const account = readFileSync("src/app/account/page.tsx", "utf8");
  const picker = readFileSync(
    "src/components/app-shell/LumeThemePicker.tsx",
    "utf8",
  );

  check("token mapping helpers", () => {
    assert.equal(appearanceToTheme("desert"), "desert");
    assert.equal(appearanceToTheme("ocean"), "ocean");
    assert.equal(appearanceToTheme("dark"), "ocean");
    assert.equal(appearanceToTheme(null), "ocean");
    assert.equal(themeToDataset("ocean"), "dark");
    assert.equal(themeToDataset("desert"), "desert");
    assert.equal(themeToStorage("desert"), "desert");
    assert.equal(themeToStorage("ocean"), "ocean");
  });

  check("Ocean tokens remain and Desert tokens exist", () => {
    assert.match(globals, /:root,\s*\[data-theme="dark"\]/);
    assert.match(globals, /\[data-theme="desert"\]/);
    assert.match(globals, /--bg-app: #16110d/);
    assert.match(globals, /--bg-app: #0d1117/);
    assert.match(globals, /--success: #35b97f/);
    assert.match(globals, /--danger: #e45b5b/);
    assert.match(globals, /--accent-primary: #7c5cfc/);
  });

  check("boot script persists Desert and defaults to Ocean", () => {
    assert.match(layout, /mc-appearance-v1/);
    assert.match(layout, /v === 'desert'/);
    assert.doesNotMatch(
      layout,
      /localStorage\.setItem\('mc-appearance-v1', 'dark'\)/,
    );
  });

  check("Account Settings can choose Ocean or Desert", () => {
    assert.match(account, /LumeThemePicker/);
    assert.match(picker, /Ocean/);
    assert.match(picker, /Desert/);
    assert.match(picker, /lume-theme-\$\{option\.id\}/);
    assert.match(picker, /id: "ocean"/);
    assert.match(picker, /id: "desert"/);
  });

  check("no Desert-specific screen/component forks", () => {
    const files = walkTsx("src/components");
    for (const file of files) {
      const base = file.replace(/\\/g, "/");
      if (base.endsWith("LumeThemePicker.tsx")) continue;
      const text = readFileSync(file, "utf8");
      assert.doesNotMatch(
        text,
        /Desert[A-Z]\w+|desert-only|if \(theme === "desert"\)/,
        `fork in ${base}`,
      );
    }
  });

  check("appearance provider writes storage without forcing dark", () => {
    assert.doesNotMatch(appearance, /forceDarkDocument/);
    assert.match(appearance, /applyLumeTheme/);
    assert.match(appearance, /APPEARANCE_STORAGE_KEY/);
  });

  console.log("verify-desert-theme: OK");
}

main();
