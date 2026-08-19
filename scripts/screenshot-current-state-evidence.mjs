/**
 * Read-only current-state screenshot pack. Does not modify application code.
 */
import fs from "node:fs";
import path from "node:path";
import puppeteer from "puppeteer-core";

const OUT = "/workspace/docs/current-state";
const MIRROR = "/opt/cursor/artifacts/screenshots/current-state";
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(MIRROR, { recursive: true });

async function save(page, name, opts = {}) {
  const file = name.endsWith(".png") ? name : `${name}.png`;
  const dest = path.join(OUT, file);
  await page.screenshot({ path: dest, fullPage: opts.fullPage ?? false });
  fs.copyFileSync(dest, path.join(MIRROR, file));
  console.log("saved", file);
}

async function go(page, url) {
  await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
  await new Promise((r) => setTimeout(r, 600));
}

async function selectProject(page, code) {
  await page.waitForSelector(".sidebar-project", { timeout: 15000 });
  await page.evaluate((c) => {
    const links = Array.from(document.querySelectorAll("a.sidebar-project"));
    links.find((a) => new RegExp(c, "i").test(a.textContent || ""))?.click();
  }, code);
  await page.waitForSelector(".project-owned-workspace", { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 700));
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: "/usr/local/bin/google-chrome",
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      "--window-size=1440,900",
    ],
    defaultViewport: { width: 1440, height: 900 },
  });
  const page = await browser.newPage();

  // --- A: Main project workspace ---
  await go(page, "http://localhost:3000/");
  await selectProject(page, "HORIZON");
  await save(page, "01-main-project-workspace");

  // --- G: Narrow laptop ---
  await page.setViewport({ width: 1280, height: 720 });
  await new Promise((r) => setTimeout(r, 400));
  await save(page, "07-main-project-narrow");
  await page.setViewport({ width: 1440, height: 900 });

  // --- E: Overview ---
  await go(page, "http://localhost:3000/");
  await page.waitForSelector(".workspace-page", { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 500));
  await save(page, "05-overview");

  // --- F: Sidebar focus (clip left) ---
  const sidebarBox = await page.$eval(".app-sidebar", (el) => {
    const r = el.getBoundingClientRect();
    return {
      x: Math.max(0, r.x),
      y: Math.max(0, r.y),
      width: Math.min(r.width + 8, 320),
      height: Math.min(r.height, 900),
    };
  });
  await page.screenshot({
    path: path.join(OUT, "06-sidebar-navigation.png"),
    clip: sidebarBox,
  });
  fs.copyFileSync(
    path.join(OUT, "06-sidebar-navigation.png"),
    path.join(MIRROR, "06-sidebar-navigation.png"),
  );
  console.log("saved 06-sidebar-navigation.png");

  // --- B: Capture after analysis ---
  // Prefer populated review preview (representative of current Capture review UI)
  // plus attempt a live Analyse in local mode for honesty.
  await go(page, "http://localhost:3000/dev/review-preview");
  const previewOk = await page
    .waitForSelector(".capture-review, .capture-workspace, .suggestion-card", {
      timeout: 8000,
    })
    .then(() => true)
    .catch(() => false);
  if (previewOk) {
    await new Promise((r) => setTimeout(r, 800));
    await save(page, "02a-capture-analysis-top");
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise((r) => setTimeout(r, 400));
    await save(page, "02b-capture-analysis-bottom");
    // Also a combined full-page if useful
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: path.join(OUT, "02-capture-analysis.png"),
      fullPage: true,
    });
    fs.copyFileSync(
      path.join(OUT, "02-capture-analysis.png"),
      path.join(MIRROR, "02-capture-analysis.png"),
    );
    console.log("saved 02-capture-analysis.png (review-preview fullPage)");
  } else {
    console.log("review-preview unavailable — trying live Analyse");
    await go(page, "http://localhost:3000/");
    await page.waitForSelector("#capture-input", { timeout: 10000 });
    await page.click("#capture-input", { clickCount: 3 });
    await page.type(
      "#capture-input",
      "HORIZON: Create a To Do to chase the vendor for OAuth scopes. Update the launch milestone to 8 November. Resolve the identity provider risk if testing is unblocked. Remember that CAB needs the pack 48 hours before the board. We're worried data migration may slip.",
    );
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find((b) =>
        /^Analyse$/i.test(b.textContent || ""),
      );
      btn?.click();
    });
    await page
      .waitForSelector(".capture-review, .suggestion-card", { timeout: 45000 })
      .catch(() => null);
    await new Promise((r) => setTimeout(r, 1000));
    await save(page, "02-capture-analysis");
  }

  // --- C: New Project flow ---
  await go(page, "http://localhost:3000/projects/new");
  await page.waitForSelector(".np-experience, .np-path-grid", { timeout: 15000 });
  await new Promise((r) => setTimeout(r, 500));
  await save(page, "03-new-project-start");

  // Talk path
  await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll("button")).find((b) =>
      /Talk it through/i.test(b.textContent || ""),
    );
    btn?.click();
  });
  await page.waitForSelector(".np-talk", { timeout: 8000 }).catch(() => null);
  await new Promise((r) => setTimeout(r, 500));
  if (await page.$(".np-talk")) {
    await save(page, "03a-new-project-talk");
    // Build review from example text without recording
    const example = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find((b) =>
        /Show me an example/i.test(b.textContent || ""),
      );
      btn?.click();
      return document.querySelector(".np-example-body")?.textContent || "";
    });
    await page.waitForSelector(".np-transcript-field textarea", { timeout: 5000 });
    await page.$eval(
      ".np-transcript-field textarea",
      (el, text) => {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype,
          "value",
        ).set;
        setter.call(
          el,
          text ||
            "This is the Horizon Customer Portal project. Sarah owns the business side and Marcus is leading technical delivery. Security sign-off is due on the 12th. We're worried the identity provider may delay testing. CAB needs the pack 48 hours before the meeting.",
        );
        el.dispatchEvent(new Event("input", { bubbles: true }));
      },
      example,
    );
    await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll("button")).find((b) =>
        /Build My Project/i.test(b.textContent || ""),
      );
      btn?.click();
    });
    await page.waitForSelector(".np-review", { timeout: 20000 }).catch(() => null);
    await new Promise((r) => setTimeout(r, 700));
    if (await page.$(".np-review")) {
      await save(page, "03b-new-project-review");
    }
  }

  // --- D: Zero-project first run ---
  await go(page, "http://localhost:3000/");
  await page.evaluate(() => {
    const empty = {
      projects: [],
      releases: [],
      meetings: [],
      recommendations: [],
      todos: [],
      memories: [],
      knowledge: [],
      timeline: [],
      history: [],
      analysesThisMonth: 0,
      analysesMonthKey: new Date().toISOString().slice(0, 7),
      lastAnalyzedAt: null,
    };
    localStorage.setItem("mission-control-state-v5", JSON.stringify(empty));
  });
  await go(page, "http://localhost:3000/");
  await page.waitForSelector(".np-experience, .np-first-run-page, .np-choose", {
    timeout: 15000,
  });
  await new Promise((r) => setTimeout(r, 600));
  await save(page, "04-zero-project-first-run");

  // Restore seed for any further local browsing (session only — no app code change)
  await page.evaluate(() => {
    localStorage.removeItem("mission-control-state-v5");
  });

  await browser.close();
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
